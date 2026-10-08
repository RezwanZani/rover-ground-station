# Rover Teleoperation & Simulation Guide

This guide documents the end-to-end Software-In-The-Loop (SIL) simulation pipeline for the rover platform. It enables full teleoperation testing between a native Windows ground station and a ROS 2 Jazzy Gazebo simulation inside WSL 2 or a remote Linux workstation over SSH without physical XBee hardware.

---

## 1. System Architecture & Data Flow

The architecture decouples UI rendering and serial byte packing on Windows from the ROS 2 / Gazebo simulation running in Linux. By bridging the virtual serial stream across network boundaries into a pseudo-terminal (PTY), the production C++ receiver node executes without code alterations, preserving the POSIX `<termios.h>` configuration used on the physical NVIDIA Jetson Orin NX.

### 1.1 Local Simulation Architecture (Windows Host $\to$ WSL 2)

```text
+-----------------------------------------------------------------------------------------+
| WINDOWS HOST (Native Execution)                                                         |
|                                                                                         |
|  +--------------------+         WebSocket (JSON)         +---------------------------+  |
|  | React Dashboard UI | <==============================> | Python Headless Engine    |  |
|  | (Vite / Port 5173) |        ws://localhost:8765       | (backend/main.py)         |  |
|  +--------------------+                                  | - Gamepad / WASD fallback |  |
|                                                          | - 10-byte Serialization   |  |
|                                                          +-------------+-------------+  |
|                                                                        | COM20          |
|                                                                        v                |
|                                                          +---------------------------+  |
|                                                          | com0com Virtual Null Modem|  |
|                                                          | COM20 <=========> COM21   |  |
|                                                          +-------------+-------------+  |
|                                                                        | COM21          |
|                                                                        v                |
|                                                          +---------------------------+  |
|                                                          | bridge_com_to_tcp.py      |  |
|                                                          | (TCP Client -> WSL:9870)  |  |
+------------------------------------------------------------------------|----------------+
                                                                         | TCP Loopback
                                                                         | 127.0.0.1:9870
+------------------------------------------------------------------------|----------------+
| WSL 2 LINUX ENVIRONMENT (Ubuntu 24.04 / ROS 2 Jazzy)                   |                |
|                                                                        v                |
|                                                          +---------------------------+  |
|                                                          | tcp_pty_bridge.py         |  |
|                                                          | (TCP Server :9870 - RAW)  |  |
|                                                          +-------------+-------------+  |
|                                                                        | Slave PTY link |
|                                                                        v                |
|                                                                  /tmp/ttyUSB0           |
|                                                                        |                |
|  +---------------------------------------------------------------------+                |
|  | POSIX termios read (<termios.h> / cfmakeraw)                                         |
|  v                                                                                      |
|  +------------------------------+                                                       |
|  | serial_receiver_node (C++)   |                                                       |
|  | - Little-Endian unpacking    |                                                       |
|  | - 500 ms Watchdog Failsafe   |                                                       |
|  +--------------+---------------+                                                       |
|                 | ROS 2 Topic                                                           |
|                 v                                                                       |
|             /cmd_vel (geometry_msgs/msg/Twist)                                          |
|                 |                                                                       |
|                 v                                                                       |
|  +------------------------------+       GZ Transport      +--------------------------+  |
|  | ros_gz_bridge                | =====================> | Gazebo Harmonic Sim      |  |
|  | (parameter_bridge)           |                        | (rover_world / diff_drive|  |
|  +------------------------------+                        +--------------------------+  |
+-----------------------------------------------------------------------------------------+

```

### 1.2 Remote Offloaded Architecture (Windows Laptop $\to$ Remote Workstation via SSH)

When laptop GPU/CPU thermal throttling drops simulation Real-Time Factor (RTF) to unusable speeds (~20%), physics calculation and simulation rendering can be offloaded to a high-performance Linux workstation over an encrypted SSH tunnel:

```text
+-------------------------------------------------------------+
| LOCAL LAPTOP (Windows Host)                                 |
|                                                             |
|  [Gamepad / Keyboard]                                       |
|          |                                                  |
|          v                                                  |
|   backend/main.py  ------> COM20 === COM21 (com0com)        |
|                                     |                       |
|                                     v                       |
|                            bridge_com_to_tcp.py             |
|                                     |                       |
|   +---------------------------------+                       |
|   | Connects to 127.0.0.1:9870                              |
|   v                                                         |
|  SSH Tunnel (-L 9870:localhost:9870)                        |
+------------------------------+------------------------------+
                               | Encrypted Network Pipe
                               v
+-------------------------------------------------------------+
| REMOTE WORKSTATION (Linux / Dedicated GPU)                  |
|                                                             |
|  Port 9870 (Traffic exits SSH tunnel)                       |
|          |                                                  |
|          v                                                  |
|   tcp_pty_bridge.py  =====> Creates /tmp/ttyUSB0 (RAW PTY)  |
|                                     |                       |
|                                     v                       |
|                           serial_receiver_node (C++)        |
|                                     |                       |
|                                     v /cmd_vel              |
|                              ros_gz_bridge                  |
|                                     |                       |
|                                     v                       |
|                   Gazebo Harmonic (Headless / ~1.00 RTF)    |
+-------------------------------------------------------------+

```

### 1.3 Closed-Loop Telemetry Return Path

To render live dashboard feedback (GPS, heading, speed, link state) in the React UI, data flows back across the bridge in reverse:

```text
[ Gazebo Simulation ] (Harmonic / gz-sim)
  ├── NavSat plugin   ──> /gps/fix  (sensor_msgs/NavSatFix)
  ├── IMU plugin      ──> /imu      (sensor_msgs/Imu)
  └── Diff-Drive      ──> /odom     (nav_msgs/Odometry)
            │
            ▼
[ ROS 2 Telemetry Node (WSL / Remote PC) ]
  • Reads /gps/fix, /imu, /odom
  • Computes simulated battery, temp, and mission metrics[cite: 5]
  • Packs into binary telemetry packet
  • Writes to /tmp/ttyUSB0
            │
            ▼
[ tcp_pty_bridge.py ] (WSL / Remote PC)
            │ TCP Port 9870 (or SSH Tunnel)[cite: 1, 5]
            ▼
[ bridge_com_to_tcp.py ] (Windows Host)
            │ Writes to COM21[cite: 1, 5]
            ▼
[ com0com (COM21 -> COM20) ][cite: 1, 5]
            │
            ▼
[ backend/main.py ] (Windows)
  • Reads COM20 & deserializes packet[cite: 5]
  • Broadcasts JSON via WebSocket (ws://localhost:8765)[cite: 5]
            │
            ▼
[ React Dashboard (localhost:5173) ]
  • Live GPS Map, Compass Heading, Speed Gauge, Battery HUD[cite: 5]

```

---

## 2. Wire Protocol & Packet Contracts

### 2.1 Drive Control Teleop Packet (Base Station $\to$ Rover)

The base station packs control inputs into a tight 10-byte Little-Endian binary payload (`<cffb`) to avoid DDS network overhead over constrained links:

| Byte Offset | Field Name | Type | Size | Description |
| --- | --- | --- | --- | --- |
| `0` | Sync Character | `char` | 1 byte | Frame boundary marker: ASCII `$` (`0x24`). |
| `1 – 4` | Linear Velocity ($v_x$) | `float32` | 4 bytes | Forward / Reverse drive velocity in m/s. |
| `5 – 8` | Angular Velocity ($\omega_z$) | `float32` | 4 bytes | Yaw rate steering velocity in rad/s. |
| `9` | Command Flag | `int8` | 1 byte | `0` = Normal teleop, `1–255` = Hardware test override. |

### 2.2 Heartbeat Latency Acknowledgment (Rover $\to$ Base Station)

To track round-trip latency without cross-system clock sync, the C++ receiver echoes a 2-byte acknowledgment back to `/tmp/ttyUSB0` upon receipt of every valid frame:

| Byte Offset | Field Name | Type | Size | Description |
| --- | --- | --- | --- | --- |
| `0` | Echo Identifier | `char` | 1 byte | Constant echo character `#` (`0x23`). |
| `1` | Command Flag Echo | `int8` | 1 byte | Mirrors received `cmd_flag`. |

---

## 3. Directory Structure

```text
E:\_Project\ROVER71\                        <-- Windows Host
├── rover_base_station/
│   ├── backend/
│   │   ├── main.py                         # Base station engine & WebSocket server[cite: 4]
│   │   ├── struct_packer.py                # Binary serialization (<cffb)[cite: 4]
│   │   ├── requirements.txt                # pygame, pyserial, websockets[cite: 4]
│   │   └── test/
│   │       └── bridge_com_to_tcp.py        # COM21-to-TCP client forwarder[cite: 1, 4]
│   └── frontend/                           # React GCS Dashboard[cite: 4]

~/rover_ws/                                 <-- WSL 2 / Remote Linux Environment
└── src/
    └── rover_simplified/
        ├── CMakeLists.txt                  # Build configuration[cite: 4]
        ├── package.xml                     # ROS 2 dependencies[cite: 4]
        ├── launch/
        │   └── gazebo.launch.py            # Simulation world, robot publisher & bridge[cite: 4]
        ├── scripts/
        │   ├── tcp_pty_bridge.py           # Persistent RAW PTY (/tmp/ttyUSB0) server[cite: 1, 4]
        │   ├── sim_telemetry_node.py       # Sensor telemetry aggregation publisher[cite: 5]
        │   └── wsl_serial_test.py          # Standalone packet verification script[cite: 1, 4]
        ├── src/
        │   └── serial_receiver_node.cpp    # POSIX serial receiver node with cfmakeraw[cite: 1, 4]
        ├── urdf/                           # Robot description & xacro files[cite: 4]
        └── worlds/
            └── rover_world.sdf             # Gazebo simulation world[cite: 4]

```

---

## 4. Setup and Configuration

### 4.1 Windows Host Setup

1. **Configure com0com Virtual Port Pair:**
* Open the **com0com Setup** utility as Administrator.
* Configure or rename a port pair to `COM20` and `COM21`.
* Check **"Enable buffer overrun"** on both endpoints to mirror hardware UART behavior.
* Click **Apply**.

2. **Install Python Dependencies:**
```powershell
cd E:\_Project\ROVER71\rover_base_station\backend
pip install -r requirements.txt

```


3. **Verify Port in `main.py`:**
Confirm the port defaults to `COM20`:

```python
DEFAULT_SERIAL_PORT = "COM20"
BAUD_RATE = 115200
```

---

### 4.2 Linux / WSL 2 / Remote PC Setup

1. **Install Serial Dependencies:**
```bash
sudo apt-get update && sudo apt-get install -y python3-serial
```

2. **Configure `CMakeLists.txt`:**
Ensure `serial_receiver_node` is declared in `~/rover_ws/src/rover_simplified/CMakeLists.txt`:

```cmake
cmake_minimum_required(VERSION 3.8)
project(rover_simplified)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic -O3)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)

add_executable(serial_receiver_node src/serial_receiver_node.cpp)
ament_target_dependencies(serial_receiver_node
  rclcpp
  geometry_msgs
)

install(TARGETS
  serial_receiver_node
  DESTINATION lib/${PROJECT_NAME}
)

install(DIRECTORY launch urdf worlds
  DESTINATION share/${PROJECT_NAME}
)

ament_package()

```


3. **Build the Workspace:**
```bash
cd ~/rover_ws
colcon build --packages-select rover_simplified --symlink-install
source install/setup.bash
```

---

## 5. Execution Scripts

### 5.1 Windows COM-to-TCP Bridge (`backend/test/bridge_com_to_tcp.py`)

Run this natively on Windows to forward `COM21` data to the TCP socket listener:

```python
import serial
import socket
import time
import sys

COM_PORT = 'COM21'
BAUD_RATE = 115200
TARGET_HOST = '127.0.0.1'  # 127.0.0.1 works for WSL 2 and SSH tunnels
TARGET_PORT = 9870

print(f"[BRIDGE] Opening {COM_PORT} at {BAUD_RATE} baud...")
try:
    ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=0.01)
except serial.SerialException as e:
    print(f"[SERIAL ERROR] Could not open {COM_PORT}: {e}")
    sys.exit(1)

def connect_socket():
    while True:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.connect((TARGET_HOST, TARGET_PORT))
            print(f"[BRIDGE] Connected to TCP endpoint {TARGET_HOST}:{TARGET_PORT}!")
            s.setblocking(False)
            return s
        except (ConnectionRefusedError, OSError):
            s.close()
            print("[BRIDGE] Waiting for Linux tcp_pty_bridge to listen...")
            time.sleep(1.0)

sock = connect_socket()

try:
    bytes_tx, bytes_rx = 0, 0
    last_log = time.time()

    while True:
        # Serial (COM21) -> TCP (Linux)
        if ser.in_waiting > 0:
            tx_data = ser.read(ser.in_waiting)
            try:
                sock.sendall(tx_data)
                bytes_tx += len(tx_data)
            except (BrokenPipeError, ConnectionResetError):
                print("[BRIDGE] Connection lost. Reconnecting...")
                sock.close()
                sock = connect_socket()

        # TCP (Linux) -> Serial (COM21)
        try:
            rx_data = sock.recv(1024)
            if rx_data == b'':
                print("[BRIDGE] Socket closed by Linux host. Reconnecting...")
                sock.close()
                sock = connect_socket()
            elif rx_data:
                ser.write(rx_data)
                bytes_rx += len(rx_data)
        except (BlockingIOError, InterruptedError):
            pass
        except (ConnectionResetError, BrokenPipeError):
            print("[BRIDGE] Connection lost. Reconnecting...")
            sock.close()
            sock = connect_socket()

        now = time.time()
        if now - last_log > 2.0:
            if bytes_tx > 0 or bytes_rx > 0:
                print(f"[TRAFFIC] TX -> Linux: {bytes_tx} bytes | RX <- Linux: {bytes_rx} bytes")
                bytes_tx, bytes_rx = 0, 0
            last_log = now

        time.sleep(0.001)

except KeyboardInterrupt:
    print("\n[BRIDGE] Stopped by operator.")
finally:
    ser.close()
    if sock:
        sock.close()

```

### 5.2 Linux Persistent RAW PTY Bridge (`scripts/tcp_pty_bridge.py`)

Run this in Linux/WSL to expose a raw pseudo-terminal endpoint at `/tmp/ttyUSB0`. It uses `tty.setraw` to disable line buffering, special-character escaping, and accidental session hangs:

```python
#!/usr/bin/env python3
import os
import pty
import socket
import select
import sys
import tty
import termios

VIRTUAL_TTY = "/tmp/ttyUSB0"
LISTEN_PORT = 9870

# 1. Allocate pseudo-terminal
master_fd, slave_fd = pty.openpty()
slave_name = os.ttyname(slave_fd)

# 2. Put PTY slave into RAW mode immediately
tty.setraw(slave_fd)

# 3. Create persistent symlink
if os.path.exists(VIRTUAL_TTY) or os.path.islink(VIRTUAL_TTY):
    os.unlink(VIRTUAL_TTY)
os.symlink(slave_name, VIRTUAL_TTY)
os.chmod(VIRTUAL_TTY, 0o666)

print(f"[PTY BRIDGE] Virtual raw serial port active at {VIRTUAL_TTY} -> {slave_name}")

# 4. Bind persistent TCP listener
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(('0.0.0.0', LISTEN_PORT))
server.listen(1)
print(f"[PTY BRIDGE] Waiting for Windows bridge on port {LISTEN_PORT}...")

try:
    while True:
        conn, addr = server.accept()
        print(f"[PTY BRIDGE] Host connected from {addr}!")
        conn.setblocking(False)

        while True:
            r_fds, _, _ = select.select([conn, master_fd], [], [], 0.02)

            # Windows TCP -> Linux PTY
            if conn in r_fds:
                try:
                    data = conn.recv(1024)
                    if not data:
                        print("[PTY BRIDGE] Windows disconnected. Waiting for reconnect...")
                        break
                    os.write(master_fd, data)
                except (ConnectionResetError, BlockingIOError):
                    break

            # Linux PTY -> Windows TCP
            if master_fd in r_fds:
                try:
                    data = os.read(master_fd, 1024)
                    if data:
                        conn.sendall(data)
                except (BlockingIOError, OSError):
                    pass

        conn.close()

except KeyboardInterrupt:
    print("\n[PTY BRIDGE] Shutting down...")
finally:
    if os.path.islink(VIRTUAL_TTY):
        os.unlink(VIRTUAL_TTY)
    os.close(master_fd)
    os.close(slave_fd)
    server.close()

```

Make it executable:

```bash
chmod +x ~/rover_ws/src/rover_simplified/scripts/tcp_pty_bridge.py

```

---

## 6. Production Step-by-Step Launch Procedures

### 6.1 Mode A: Local Execution (Inside WSL 2)

| Step | Environment | Terminal | Command / Action | Expected Output / State |
| --- | --- | --- | --- | --- |
| **1** | WSL 2 | Terminal 1 | `python3 ~/rover_ws/src/rover_simplified/scripts/tcp_pty_bridge.py` | `[PTY BRIDGE] Virtual raw serial port active at /tmp/ttyUSB0`. |
| **2** | Windows | PowerShell 1 | `cd backend && python test/bridge_com_to_tcp.py` | `[BRIDGE] Connected to TCP endpoint 127.0.0.1:9870!`. |
| **3** | Windows | PowerShell 2 | `cd backend && python main.py` | `[SERIAL] Connected to XBee on COM20 at 115200 baud`. |
| **4** | WSL 2 | Terminal 2 | `cd ~/rover_ws && source install/setup.bash && ros2 launch rover_simplified gazebo.launch.py` | Spawns Gazebo world, robot URDF, and topic bridges. |
| **5** | WSL 2 | Terminal 3 | `cd ~/rover_ws && source install/setup.bash && ros2 run rover_simplified serial_receiver_node --ros-args -p port:=/tmp/ttyUSB0` | Connects to `/tmp/ttyUSB0` and publishes `/cmd_vel`. |
| **6** | WSL 2 | Terminal 4 | `python3 ~/rover_ws/src/rover_simplified/scripts/sim_telemetry_node.py` *(Optional)* | Starts publishing sensor feedback to `/tmp/ttyUSB0`. |
| **7** | Windows | PowerShell 3 | `cd frontend && npm run dev` *(Optional)* | Starts Vite React UI at `http://localhost:5173`. |

---

### 6.2 Mode B: Remote Workstation Execution (High RTF Simulation)

Use this method when laptop hardware cannot sustain real-time simulation speeds ($<0.50$ RTF):

1. **Establish SSH Port Tunnel (Windows PowerShell):**
```powershell
ssh -L 9870:localhost:9870 <remote_user>@<remote_workstation_ip>
```

Keep this session running; any data sent to `127.0.0.1:9870` on the laptop is forwarded to the remote host.

2. **Start Remote PTY Server (Remote Host - Terminal 1):**
```bash
python3 ~/rover_ws/src/rover_simplified/scripts/tcp_pty_bridge.py
```

3. **Start Local Serial Bridge (Windows Laptop - PowerShell 1):**
```powershell
cd E:\_Project\ROVER71\rover_base_station\backend
python test/bridge_com_to_tcp.py
```

Connects through the active SSH tunnel; Remote Terminal 1 logs host connection.

4. **Launch Local Base Station (Windows Laptop - PowerShell 2):**
```powershell
cd E:\_Project\ROVER71\rover_base_station\backend
python main.py
```

5. **Start Headless Gazebo Simulation (Remote Host - Terminal 2):**
```bash
cd ~/rover_ws && source install/setup.bash
ros2 launch rover_simplified gazebo.launch.py gz_args:="-r -s rover_world.sdf"
```

The server-only flag `-s` runs Gazebo headlessly without X11 overhead, yielding $\text{RTF} \ge 0.98$.

6. **Start Remote ROS 2 Receiver (Remote Host - Terminal 3):**
```bash
cd ~/rover_ws && source install/setup.bash
ros2 run rover_simplified serial_receiver_node --ros-args -p port:=/tmp/ttyUSB0
```

---

## 7. Diagnostics and Safety Verification

```text
                  +--------------------------------+
                  |  serial_receiver_node Running  |
                  +---------------+----------------+
                                  |
                                  v
                        [Incoming Packet?]
                        /                \
                  YES  /                  \  NO
                      v                    v
          +-----------------------+   +------------------------+
          | Reset Watchdog Timer  |   | Elapsed Time > 0.5s ?  |
          | Publish /cmd_vel Twist|   +-----------+------------+
          | Echo '#' ACK to PTY   |          YES  |
          +-----------------------+               v
                                      +------------------------+
                                      | [WATCHDOG TIMEOUT]     |
                                      | Publish Twist(0.0, 0.0)|
                                      | Force Safe Rover Halt  |
                                      +------------------------+

```

1. **Verify Live Topic Velocities:**
Echo the topic in Linux while holding **W/A/S/D** or moving the joystick in the Pygame window:


```bash
ros2 topic echo /cmd_vel
```

Note: `main.py` suppresses writes when input is neutral (`0.0, 0.0`) to avoid flooding serial buffers; active input is required to stream packets.

2. **Verify Watchdog Safety Failsafe:**
* Terminate `main.py` on Windows using `Ctrl+C`.
* Within **500 ms**, the Linux receiver node must log:

```text
[WATCHDOG TIMEOUT] No packet received for 0.50 seconds! Forcing rover halt (0.0, 0.0).
```

* Confirm the Gazebo model halts immediately and velocity drops to zero.

3. **Verify Simulation Real-Time Factor (RTF):**
In a Linux terminal, monitor physics performance:

```bash
gz topic -e -t /stats
```

Inspect `real_time_factor`. On the remote workstation, this should remain between **0.95 and 1.00**, resolving the slowdown seen on resource-constrained laptops.

4. **Verify Bidirectional Traffic:**
Observe the terminal running `bridge_com_to_tcp.py`:

```text
[TRAFFIC] TX -> Linux: 200 bytes | RX <- Linux: 40 bytes
```

Non-zero RX bytes confirm that acknowledgment packets and sensor telemetry are making the return trip back to Windows.