# Telemetry & Data Flow Architecture

This document describes the telemetry pipeline for the ROVER71 Base Station, detailing how data is sourced, bridged, and visualized across the system.

## 📡 System Overview

The application relies on a **Headless Python Engine** (`backend/main.py`) acting as a multiplexer, and a **React Dashboard** (`frontend/src/App.tsx`) acting as the visualization layer.

1. **Hardware Ingestion (Python)**: Reads physical gamepad inputs via PyGame.
2. **RF Transmission (Python)**: Packs the input data into a struct and writes it over a serial COM port to an attached XBee radio module.
3. **WebSocket Bridge (Python ⟷ React)**: Broadcasts a consolidated JSON telemetry payload at 20 Hz (port `8765`) containing both the state of the backend bridge and any returning data from the rover.
4. **UI Rendering (React)**: The frontend listens to the WebSocket and routes the payload to the respective dashboard components.

---

## 🎛️ UI Sections & Data Sources

### 1. Top Bar / Status Blocks
Displays the core operational state of the base station's bridge to the rover.
* **WEBSOCKET**: Validates the local network connection between the React UI and Python backend. Calculates packet freshness/latency on the frontend using timestamps.
* **XBee TX**: Indicates if the Python engine is successfully writing bytes to the local XBee module. Data source: `telemetry.radio.tx_active` and `telemetry.radio.port` (e.g., `COM20`).
* **XBee RX LATENCY**: Displays the round-trip latency (ping) between the base station and the rover. Data source: `telemetry.radio.rx_ping_ms`.
* **MAIN BATTERY**: Voltage of the rover's primary power source. Data source: `telemetry.battery.voltage`.
* **OPERATIONAL MODE**: Displays the current command state of the rover (e.g., Normal Teleop or Hardware Override). Data source: `telemetry.rover_state.active_flag` (mapped from `sys_state["cmd_flag"]` in Python).

### 2. Visual Feed (Center Column)
Displays primary and auxiliary camera streams sent from the rover.
* **Source**: `telemetry.camera.primary_url` and `telemetry.camera.secondary_url`.
* **Behavior**: Renders image feeds natively. Features a "SWAP FEEDS" button handled entirely via local React state (`swapped`), which flips the primary and PiP video sources.

### 3. Center Readouts
Critical numerical metrics grouped beneath the camera view.
* **Velocity**: Raw speed (m/s) and trajectory. Data source: `telemetry.velocity.speed_mps` and `telemetry.velocity.direction_deg`.
* **Heading**: Derived from `telemetry.gps.heading`.
* **Link Quality**: Calculated dynamically on the frontend based on `rx_ping_ms` latency, falling to 0% if the websocket disconnects. (Can also accept a hard `telemetry.radio.link_quality` value).
* **Mission Time**: Operational uptime. Data source: `telemetry.rover_state.mission_time`.

### 4. Position / GPS (Left Column)
Live tracking of the rover on a local Leaflet coordinate map.
* **Source**: `telemetry.gps.lat`, `telemetry.gps.lon`, `telemetry.gps.heading`.
* **Behavior**: Instantiates an offline-capable Leaflet map that automatically pans and rotates a custom marker using the GPS coordinates and magnetic heading.

### 5. Attitude / IMU (Left Column)
An Artificial Horizon indicating spatial orientation.
* **Source**: `telemetry.imu.pitch`, `telemetry.imu.roll`, `telemetry.imu.yaw`.
* **Behavior**: Applies CSS transforms to translate pitch and rotate roll. Automatically triggers a visual hazard warning if pitch or roll exceeds ±25 degrees to warn of rollover risk.

### 6. Motor Diagnostics (Left Column)
Detailed breakdown of the 6-wheel drive train.
* **Source**: Array of motor objects at `telemetry.motors`.
* **Metrics**: Current Draw (`current_a`) and Temperature (`temp_c`).
* **Behavior**: UI automatically flags temperature readouts as red/critical if they exceed 70°C.

### 7. Joystick Input (Right Column)
Visual echo of the physical operator input.
* **Source**: PyGame reads the controller on the backend and broadcasts `telemetry.joy.axis_x` and `telemetry.joy.axis_y`.
* **Behavior**: Renders a graphical target moving across an X/Y grid. Visually depicts the backend's analog deadband threshold (`telemetry.joy.deadband`) and actively flags when the stick is resting inside it.

### 8. Hardware Tests (Right Column)
Allows the operator to override physical inputs and dispatch automated diagnostic routines.
* **Action (React ⟷ Python)**: Clicking a button dispatches a JSON command (`{ action: "TRIGGER_TEST", test_id: N }`) upstream to the Python backend.
* **Execution**: The Python backend intercepts this command, sets the internal `cmd_flag`, zeroes out physical joystick inputs for safety, and transmits the specific diagnostic byte sequence to the rover via the XBee.
