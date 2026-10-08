"""
main.py
Rover Base Station Headless Engine

Dependencies (Avoid version conflicts by installing exactly these or newer):
    pip install pygame>=2.5.0 pyserial>=3.5 websockets>=11.0.3

Usage:
    python main.py
"""

import asyncio
import json
import struct
import time
import sys
import serial
import serial.tools.list_ports
import pygame
import websockets

import struct_packer
from csv_logger import log_event

# ==========================================
# CONFIGURATION
# ==========================================
DEFAULT_SERIAL_PORT = "COM17"   # Change to your XBee COM port
BAUD_RATE = 115200      # Must match XBee API mode baud rate[cite: 6]
LOOP_HZ = 20            # 20 Hz transmission rate (50ms period)[cite: 4]
DEADZONE = 0.20         # 20% analog stick deadzone to prevent drift spam[cite: 4]
WS_PORT = 8765          # Local WebSocket port for React UI[cite: 4]

# ==========================================
# SHARED SYSTEM STATE (Multiplexer)
# ==========================================
# This dictionary bridges the physical loop and the WebSocket loop[cite: 4].
sys_state = {
    "joy_x": 0.0,           # Angular Z[cite: 4]
    "joy_y": 0.0,           # Linear X[cite: 4]
    "tx_active": False,     # Serial write status[cite: 4]
    "rx_ping_ms": 0,        # Heartbeat latency[cite: 4]
    "cmd_flag": 0,          # 0 = Normal Teleop, >0 = Hardware Test Override[cite: 4]
    "test_timeout": 0,      # Timestamp to automatically release the hardware test
    "joy_connected": False, # Gamepad hardware status[cite: 4]
    "joy_name": "",         # Gamepad hardware name
    "target_port": DEFAULT_SERIAL_PORT,
    "current_port": None,
    "available_ports": []
}

# ==========================================
# HELPER FUNCTIONS
# ==========================================
def apply_deadzone(value):
    """Zeroes out minor hardware stick drift[cite: 4]."""
    if abs(value) < DEADZONE:
        return 0.0
    return float(value)

# ==========================================
# ASYNC LOOP 1: HARDWARE & SERIAL ENGINE
# ==========================================
async def hardware_loop():
    """Reads gamepad, multiplexes UI commands, packs bytes, and writes to XBee[cite: 4]."""
    last_ping_sent_time = 0.0
    ser = None
    last_port_scan = 0

    pygame.init()
    pygame.joystick.init()
    joystick = None
    
    log_event("[GAMEPAD] Waiting for controller... (Headless mode)")

    idle_sent = False
    while True:
        loop_start = time.time()
        
        # Periodic Port Scanning
        if loop_start - last_port_scan > 2.0:
            ports = [p.device for p in serial.tools.list_ports.comports()]
            if sys.platform == 'win32':
                import winreg
                try:
                    key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DEVICEMAP\SERIALCOMM")
                    for i in range(256):
                        try:
                            val = winreg.EnumValue(key, i)
                            port_name = str(val[1])
                            if port_name not in ports:
                                ports.append(port_name)
                        except OSError:
                            break
                    winreg.CloseKey(key)
                except OSError:
                    pass
            
            sys_state["available_ports"] = ports
            last_port_scan = loop_start

        # Handle Serial Port Changes from UI
        if sys_state["target_port"] != sys_state["current_port"]:
            if ser:
                ser.close()
                ser = None
            new_port = sys_state["target_port"]
            if new_port:
                try:
                    ser = serial.Serial(new_port, BAUD_RATE, timeout=0.01)
                    log_event(f"[SERIAL] Connected to XBee on {new_port} at {BAUD_RATE} baud.")
                except serial.SerialException as e:
                    log_event(f"[SERIAL ERROR] Could not open {new_port}. Running in dry-run mode without radio.")
                    ser = None
            sys_state["current_port"] = new_port

        # --- A. Read Inputs ---
        for event in pygame.event.get():
            if event.type == pygame.JOYDEVICEADDED:
                if joystick is None:
                    joystick = pygame.joystick.Joystick(event.device_index)
                    joystick.init()
                    sys_state["joy_connected"] = True
                    sys_state["joy_name"] = joystick.get_name()
                    log_event(f"[GAMEPAD] Hot-plug connected: {joystick.get_name()} (ID: {joystick.get_instance_id()})")
            elif event.type == pygame.JOYDEVICEREMOVED:
                if joystick and getattr(event, 'instance_id', -1) == joystick.get_instance_id():
                    log_event(f"[GAMEPAD] Disconnected: {joystick.get_name()}")
                    joystick.quit()
                    joystick = None
                    sys_state["joy_connected"] = False
                    sys_state["joy_name"] = ""
                    log_event("[GAMEPAD] Falling back to WASD.")

        linear_x = 0.0
        angular_z = 0.0

        if joystick:
            try:
                linear_x = apply_deadzone(-joystick.get_axis(1)) 
                angular_z = apply_deadzone(joystick.get_axis(0))
            except Exception as e:
                log_event(f"[GAMEPAD ERROR] Hardware read failed, forcing disconnect: {e}")
                joystick.quit()
                joystick = None
                sys_state["joy_connected"] = False
                sys_state["joy_name"] = ""
        else:
            keys = pygame.key.get_pressed()
            if keys[pygame.K_w]: linear_x = 1.0
            if keys[pygame.K_s]: linear_x = -1.0
            if keys[pygame.K_a]: angular_z = -1.0
            if keys[pygame.K_d]: angular_z = 1.0

        sys_state["joy_x"] = angular_z
        sys_state["joy_y"] = linear_x

        # Multiplex UI Commands
        active_flag = sys_state["cmd_flag"]
        if active_flag > 0:
            linear_x = 0.0
            angular_z = 0.0
            if time.time() > sys_state["test_timeout"]:
                sys_state["cmd_flag"] = 0
                active_flag = 0

        is_idle = (linear_x == 0.0 and angular_z == 0.0 and active_flag == 0)

        if not is_idle or not idle_sent:
            if not is_idle:
                log_event(f"[MAIN EVENT] Input Reading -> linear_x: {linear_x:.3f}, angular_z: {angular_z:.3f}")

            try:
                # 1. API Mode Transmit framing via struct_packer[cite: 6]
                payload = struct_packer.pack_command(linear_x, angular_z, active_flag)
                
                if ser and ser.is_open:
                    last_ping_sent_time = time.perf_counter()
                    ser.write(payload)
                    sys_state["tx_active"] = True

                    # 2. API Mode Receive Parsing (0x90 Frames) for low-latency ping[cite: 6]
                    while ser.in_waiting > 0:
                        if ser.read(1) == b'\x7E':
                            length_data = ser.read(2)
                            if len(length_data) == 2:
                                frame_len = int.from_bytes(length_data, 'big')
                                frame_data = ser.read(frame_len + 1)
                                
                                if len(frame_data) == frame_len + 1:
                                    api_payload = frame_data[:-1] # Strip checksum
                                    
                                    # Identify RX Packet (0x90)
                                    if api_payload and api_payload[0] == 0x90:
                                        rx_data = api_payload[12:]
                                        if len(rx_data) > 0 and rx_data[0:1] == b'#':
                                            rtt_ms = (time.perf_counter() - last_ping_sent_time) * 1000.0
                                            sys_state["rx_ping_ms"] = round(rtt_ms, 1)

                    log_event(f"[MAIN EVENT] Sent Data via Serial -> linear_x: {linear_x:.3f}, angular_z: {angular_z:.3f}, flag: {active_flag}")
                else:
                    sys_state["tx_active"] = False
                    log_event(f"[MAIN EVENT FAILURE] Serial port not open, couldn't send -> linear_x: {linear_x:.3f}, angular_z: {angular_z:.3f}, flag: {active_flag}")
                    
                idle_sent = is_idle

            except Exception as e:
                sys_state["tx_active"] = False
                log_event(f"[MAIN EVENT FAILURE] Transmission Error -> {e}")
        else:
            if ser and ser.is_open:
                sys_state["tx_active"] = True
            else:
                sys_state["tx_active"] = False

        elapsed = time.time() - loop_start
        sleep_time = max(0.0, (1.0 / LOOP_HZ) - elapsed)
        await asyncio.sleep(sleep_time)


# ==========================================
# ASYNC LOOP 2: WEBSOCKET BRIDGE
# ==========================================
async def handle_ws_client(websocket):
    log_event(f"[WEBSOCKET] React UI Connected from {websocket.remote_address}")
    
    async def send_telemetry():
        ws_idle_sent = False
        while True:
            try:
                telemetry = {
                    "timestamp": time.time(),
                    "joy": {
                        "axis_x": sys_state["joy_x"],
                        "axis_y": sys_state["joy_y"],
                        "connected": sys_state["joy_connected"],
                        "name": sys_state["joy_name"]
                    },
                    "radio": {
                        "tx_active": sys_state["tx_active"],
                        "rx_ping_ms": sys_state["rx_ping_ms"],
                        "port": sys_state["current_port"],
                        "available_ports": sys_state["available_ports"]
                    },
                    "rover_state": {
                        "active_flag": sys_state["cmd_flag"]
                    }
                }
                
                telemetry_json = json.dumps(telemetry)
                is_idle = (sys_state["joy_x"] == 0.0 and sys_state["joy_y"] == 0.0 and sys_state["cmd_flag"] == 0)
                if not is_idle or not ws_idle_sent:
                    # Log sparse to prevent flooding the terminal[cite: 4]
                    log_event(f"[MAIN EVENT] Sending Telemetry via WS -> {telemetry_json}")
                    ws_idle_sent = is_idle
                await websocket.send(telemetry_json)
                
                await asyncio.sleep(0.05)
            except websockets.exceptions.ConnectionClosed as e:
                log_event(f"[MAIN EVENT FAILURE] WS Send Error / Connection Closed -> {e}")
                break

    async def receive_commands():
        try:
            async for message in websocket:
                log_event(f"[MAIN EVENT] Received Data via WS -> {message}")
                data = json.loads(message)
                
                if data.get("action") == "TRIGGER_TEST":
                    test_id = data.get("test_id", 0)
                    timeout = data.get("timeout_ms", 3000)
                    sys_state["cmd_flag"] = test_id
                    sys_state["test_timeout"] = time.time() + (timeout / 1000.0)
                elif data.get("action") == "SET_PORT":
                    port = data.get("port")
                    if port:
                        sys_state["target_port"] = port
                        log_event(f"[UI COMMAND] Port change requested to {port}.")
                    
        except websockets.exceptions.ConnectionClosed as e:
            log_event(f"[MAIN EVENT FAILURE] WS Receive Error / Connection Closed -> {e}")

    await asyncio.gather(
        send_telemetry(),
        receive_commands()
    )
    log_event("[WEBSOCKET] React UI Disconnected.")

async def start_ws_server():
    async with websockets.serve(handle_ws_client, "localhost", WS_PORT):
        log_event(f"[WEBSOCKET] Server listening on ws://localhost:{WS_PORT}")
        await asyncio.Future()

# ==========================================
# MAIN EXECUTION
# ==========================================
async def main():
    log_event("--- ROVER GCS BACKEND INITIALIZING ---")
    await asyncio.gather(
        hardware_loop(),
        start_ws_server()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log_event("\n[SYSTEM] Base Station Shutting Down.")
        pygame.quit()
        sys.exit(0)