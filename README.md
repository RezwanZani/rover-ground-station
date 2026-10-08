# Rover Teleoperation & Ground Control Station (GCS)

A high-reliability, low-latency teleoperation and diagnostics base station designed for University Rover Challenge (URC) field operations.

This repository implements the ground station subsystem, featuring a native Windows hardware control engine and a real-time web-based mission control interface. The design decouples local UI rendering from real-time radio serialization, ensuring deterministic motor command transmission over bandwidth-limited 900 MHz XBee serial links to the onboard NVIDIA Jetson Orin NX.

---

## 1. System Architecture

```text
+---------------------------------------------------------------------------------------+
| BASE STATION (Windows Host)                                                           |
|                                                                                       |
|  +--------------------+         WebSockets (JSON)         +------------------------+  |
|  | React Dashboard UI | <===============================> | Python Headless Engine |  |
|  | - Joy Indicator    |        ws://localhost:8765        | - pygame (Gamepad I/O) |  |
|  | - XBee TX/RX State |                                   | - struct Serialization |  |
|  | - Hardware Tests   |                                   | - pyserial Bridge      |  |
|  +--------------------+                                   +-----------+------------+  |
+-----------------------------------------------------------------------|---------------+
                                                                        | Serial / UART
                                                                        v (115200 baud)
                                                             +---------------------+
                                                             |  XBee Transmitter   |
                                                             +----------+----------+
                                                                        |
                                          RF Link (900 MHz API Mode)   ~~~
                                                                        |
                                                             +----------v----------+
                                                             |    XBee Receiver    |
                                                             +----------+----------+
                                                                        |
+-----------------------------------------------------------------------|---------------+
| ONBOARD ROVER (NVIDIA Jetson Orin NX)                                 | UART          |
|                                                                       v               |
|  +-------------------+        ROS 2 /cmd_vel       +---------------------+            |
|  | Driver Node       | <========================== | Receiver ROS 2 Node |            |
|  | (Kinematics)      |                             +---------------------+            |
|  +---------+---------+                                                                |
|            |                                                                          |
|     +------+---------------------------------+                                        |
|     |                                        |                                        |
|     v CAN / PWM                              v Serial                                 |
|  +----------------------+                 +--------------------+                      |
|  | Wheel Interface      |                 | Steering Interface |                      |
|  +----------+-----------+                 +----------+---------+                      |
|             |                                        |                                |
|             v                                        v                                |
|     [ 4x Drive Motors ]                          [ Arduino ]                          |
|                                                      |                                |
|                                                      v                                |
|                                             [ Steering Actuators ]                    |
+---------------------------------------------------------------------------------------+
```

### Key Architectural Decisions

* **Native Windows Execution:** Avoids virtualization and hypervisor USB-passthrough instability (`usbipd-win` via WSL 2). Gamepad interrupts and serial ports map directly to host kernel drivers for sub-millisecond I/O latency.
* **Separation of Concerns:** UI crashes or heavy frontend rendering passes cannot block the 20 Hz transmission thread. Physical joystick telemetry continues transmitting even if the browser process is terminated.
* **Binary Serialization:** Eliminates bulky ROS 2 DDS middleware overhead across the RF link. Target velocities compress into fixed-width binary packets sent via raw UART.

---

## 2. Communication Protocols

### A. RF Link Byte Contract (Laptop $\rightarrow$ Jetson Orin NX)

The serial link operates in **XBee API Mode 1** at **115200 baud**, which provides robust packet framing and addressing without the overhead of DDS middleware. 

#### 1. Transmit Request (Base $\rightarrow$ Rover)
Commands are wrapped in an **API Frame Type `0x10` (Transmit Request)**, bypassing MAC retries for minimal latency (`0x01` transmit options). The core RF payload is a 10-byte struct serialized with Little-Endian ordering (`<cffb`).

**Core Teleop Payload (10 Bytes):**
| Byte Offset | Field                           | Data Type        | Description                                   |
| ----------- | ------------------------------- | ---------------- | --------------------------------------------- |
| `0`       | Header / Sync                   | `char` (1B)    | Frame start identifier: ASCII`$` (`0x24`) |
| `1 - 4`   | Linear Velocity ($v_x$)       | `float32` (4B) | Normalized drive velocity:`[-1.0, 1.0]`     |
| `5 - 8`   | Angular Velocity ($\omega_z$) | `float32` (4B) | Normalized yaw rate:`[-1.0, 1.0]`           |
| `9`       | Command Flag                    | `int8` (1B)    | Operating mode / Hardware test ID             |

#### 2. Receive Packet (Rover $\rightarrow$ Base)
The base station listens for **API Frame Type `0x90` (Receive Packet)**. It parses the incoming packet for a payload starting with `#` to calculate millisecond-accurate round-trip ping latency.

#### Command Flags (`cmd_flag`)

* `0x00`: Normal Teleoperation (Joystick drives rover).
* `0x01`: Hardware Test — Wheel Motors Drive Sweep.
* `0x02`: Hardware Test — Steering Calibration Sweep.
* `0x03`: Hardware Test — Arm / Auxiliary Actuator Test.
* `0xFF`: Software Emergency Stop (Forces zero velocity).

### B. Local WebSocket JSON Protocol (`ws://localhost:8765`)

The Python engine serves bidirectional WebSocket communication for the React UI.

#### Outbound Telemetry (Backend $\rightarrow$ React UI @ 20 Hz)

```json
{
  "timestamp": 1712048400.125,
  "joy": {
    "connected": true,
    "axis_x": 0.00,
    "axis_y": 0.85
  },
  "radio": {
    "tx_active": true,
    "rx_ping_ms": 32,
    "port": "COM3"
  },
  "rover_state": {
    "mode": "TELEOP",
    "active_flag": 0
  }
}
```

#### Inbound Commands (React UI $\rightarrow$ Backend)

```json
{
  "action": "TRIGGER_TEST",
  "test_id": 2,
  "timeout_ms": 3000
}
```

---

## 3. Fail-Safe & Safety Constraints

* **Software Deadzones:** The backend enforces an absolute deadband of 5% to 10% on analog joystick axes to eliminate mechanical stick drift.
* **Hardware Dead-Man Watchdog:** The onboard Jetson ROS 2 node implements a strict 500 ms watchdog timer. If no valid frame starting with `$` is decoded within 500 ms, the Jetson automatically pulls `/cmd_vel` to zero and issues an immediate halt to the wheel and steering interfaces.
* **Command Multiplexing:** Hardware test triggers from the UI temporarily override joystick inputs at the backend level, preventing conflicting inputs between operators and automated routines.

---

## 4. Repository Structure

```text
rover_base_station/
├── backend/
│   ├── tests/
│   │   ├── mock_receiver.py      # Loopback byte verification script
│   │   └── mock_gamepad.py       # Virtual input synthesizer
│   ├── config.py                 # Baud rates, deadzones, and port mapping
│   ├── engine.py                 # Asynchronous main execution loop
│   ├── joystick.py               # pygame HID gamepad handler
│   ├── requirements.txt          # Python dependencies
│   ├── serializer.py             # Binary struct packaging utilities
│   └── ws_server.py              # WebSocket telemetry distribution server
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HardwareTests.tsx # Manual override and diagnostic trigger grid
│   │   │   ├── JoystickPad.tsx   # Visual 2D crosshair and axis telemetry
│   │   │   └── StatusLights.tsx  # TX/RX radio and ping monitors
│   │   ├── hooks/
│   │   │   └── useTelemetry.ts   # WebSocket persistent connection manager
│   │   ├── App.tsx               # Ground station root view
│   │   └── main.tsx              # Application entry point
│   ├── package.json              # Vite, React, and UI dependencies
│   ├── tsconfig.json             # TypeScript compiler settings
│   └── vite.config.ts            # Vite bundler configuration
├── .gitignore                    # Ignores /venv, /node_modules, and build dists
└── README.md                     # Base station documentation
```

---

## 5. Getting Started

### Prerequisites

* Windows 10/11 (Host OS)
* Python 3.10+ (64-bit)
* Node.js 18+ & `npm`
* USB Gamepad (DirectInput or XInput compatible)
* XBee 900MHz RF Module mounted on USB-UART adapter

---

### Backend Setup (Terminal 1)

1. Open PowerShell or Command Prompt in the repository root:

```cmd
cd backend
```

2. Create and activate a Python virtual environment:

```cmd
python -m venv venv
venv\Scripts\activate
```

3. Install required packages:

```cmd
pip install -r requirements.txt
```

*(Dependencies: `pygame`, `pyserial`, `websockets`)*

4. Run the teleoperation engine:

```cmd
python engine.py --port COM3 --baud 115200
```

*Note: If no gamepad is plugged in, the script falls back to an integrated WASD keyboard simulator for offline testing.*

---

### Frontend Dashboard Setup (Terminal 2)

1. Open a second terminal window:

```cmd
cd frontend
```

2. Install dependencies:

```cmd
npm install
```

3. Launch the development server:

```cmd
npm run dev
```

4. Open `http://localhost:5173` in any modern web browser to access the mission control dashboard.

---

## 6. Software-In-The-Loop (SIL) Testing

You can validate the entire pipeline locally on Windows without physical XBee radios or a controller connected:

```text
[Keyboard/WASD] -> [engine.py] -> [Virtual COM10] ==== [Virtual COM11] -> [mock_receiver.py]
                          |
                  (WebSocket :8765)
                          v
                 [React UI Dashboard]
```

1. **Virtual Serial Loopback:** Install [com0com](https://sourceforge.net/projects/com0com/) and generate an interconnected virtual port pair (e.g., `COM10` $\leftrightarrow$ `COM11`).
2. **Start Backend on `COM10`:**

```cmd
python engine.py --port COM10
```

3. **Start Mock Rover on `COM11`:**

```cmd
python tests/mock_receiver.py --port COM11
```

4. Verify that stick inputs or WASD presses print correctly decoded float values (`linear_x`, `angular_z`) and command flags in the mock receiver terminal.

---

## 7. Field Operations Checklist (URC Mission Day)

| Step | Action                                               | Expected State                                                       |
| ---- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| 1    | Insert Gamepad and XBee USB dongles.                 | Windows assigns COM port (verify in Device Manager).                 |
| 2    | Launch backend via batch runner (`start_gcs.bat`). | Terminal logs:`XBee Connected on COMx`, `Gamepad Initialized`.   |
| 3    | Launch React UI.                                     | All three status indicators show green (TX Active, Gamepad Ready).   |
| 4    | Check receiver ping.                                 | `RX Ping` indicator reports stable latency ($< 50\text{ ms}$).   |
| 5    | Verify joystick deadband.                            | Centered stick outputs strictly`0.00` linear and `0.00` angular. |
| 6    | Execute Hardware Test sequence.                      | Actuators cycle through test routines without manual joystick input. |
