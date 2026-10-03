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
import pygame
import websockets
import struct_packer
from csv_logger import log_event

# ==========================================
# CONFIGURATION
# ==========================================
SERIAL_PORT = "COM20"   # Change to your XBee COM port (or virtual COM port for testing)
BAUD_RATE = 115200      # Must match XBee API mode baud rate
LOOP_HZ = 20            # 20 Hz transmission rate (50ms period)
DEADZONE = 0.20         # 20% analog stick deadzone to prevent drift spam
WS_PORT = 8765          # Local WebSocket port for React UI

# ==========================================
# SHARED SYSTEM STATE (Multiplexer)
# ==========================================
# This dictionary bridges the physical loop and the WebSocket loop.
sys_state = {
    "joy_x": 0.0,           # Angular Z
    "joy_y": 0.0,           # Linear X
    "tx_active": False,     # Serial write status
    "rx_ping_ms": 0,        # Heartbeat latency
    "cmd_flag": 0,          # 0 = Normal Teleop, >0 = Hardware Test Override
    "test_timeout": 0,      # Timestamp to automatically release the hardware test
    "joy_connected": False, # Gamepad hardware status
    "joy_name": ""          # Gamepad hardware name
}

# ==========================================
# HELPER FUNCTIONS
# ==========================================
def apply_deadzone(value):
    """Zeroes out minor hardware stick drift."""
    if abs(value) < DEADZONE:
        return 0.0
    return float(value)

# ==========================================
# ASYNC LOOP 1: HARDWARE & SERIAL ENGINE
# ==========================================
async def hardware_loop():
    """Reads gamepad, multiplexes UI commands, packs bytes, and writes to XBee."""
    
    # 1. Initialize Serial Port
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.01)
        log_event(f"[SERIAL] Connected to XBee on {SERIAL_PORT} at {BAUD_RATE} baud.")
    except serial.SerialException as e:
        log_event(f"[SERIAL ERROR] Could not open {SERIAL_PORT}. Running in dry-run mode without radio.")
        ser = None

    # 2. Initialize Gamepad (or Keyboard Fallback)
    pygame.init()
    pygame.joystick.init()
    joystick = None
    # Note: Running fully headlessly. WASD fallback may only work if terminal has focus, 
    # but this prevents the OS from freezing joystick event polling due to a hidden unpumped window.
    
    log_event("[GAMEPAD] Waiting for controller... (Headless mode)")

    # 3. Main Transmission Loop (20 Hz)
    idle_sent = False
    while True:
        loop_start = time.time()
        
        # --- A. Read Inputs ---
        for event in pygame.event.get():
            if event.type == pygame.JOYDEVICEADDED:
                # Connect to the first available device (avoids overwriting real gamepads with ghosts)
                if joystick is None:
                    joystick = pygame.joystick.Joystick(event.device_index)
                    joystick.init()
                    sys_state["joy_connected"] = True
                    sys_state["joy_name"] = joystick.get_name()
                    log_event(f"[GAMEPAD] Hot-plug connected: {joystick.get_name()} (ID: {joystick.get_instance_id()})")
            elif event.type == pygame.JOYDEVICEREMOVED:
                # Only disconnect if the REMOVED device matches our ACTIVE joystick
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
                # Axis mapping varies by controller (typically Axis 1 is Y, Axis 0 is X)
                # Invert Y axis so pushing forward is positive
                linear_x = apply_deadzone(-joystick.get_axis(1)) 
                angular_z = apply_deadzone(joystick.get_axis(0))
            except Exception as e:
                log_event(f"[GAMEPAD ERROR] Hardware read failed, forcing disconnect: {e}")
                joystick.quit()
                joystick = None
                sys_state["joy_connected"] = False
                sys_state["joy_name"] = ""
        else:
            # Keyboard Fallback (WASD)
            keys = pygame.key.get_pressed()
            if keys[pygame.K_w]: linear_x = 1.0
            if keys[pygame.K_s]: linear_x = -1.0
            if keys[pygame.K_a]: angular_z = -1.0
            if keys[pygame.K_d]: angular_z = 1.0

        # Update state for the React UI to consume
        sys_state["joy_x"] = angular_z
        sys_state["joy_y"] = linear_x

        # --- B. Multiplex Command Flag ---
        # If the UI triggered a test, override the stick inputs for safety
        active_flag = sys_state["cmd_flag"]
        if active_flag > 0:
            linear_x = 0.0
            angular_z = 0.0
            # Auto-release the test if timeout expires
            if time.time() > sys_state["test_timeout"]:
                sys_state["cmd_flag"] = 0
                active_flag = 0

        is_idle = (linear_x == 0.0 and angular_z == 0.0 and active_flag == 0)

        if not is_idle or not idle_sent:
            log_event(f"[MAIN EVENT] Input Reading -> linear_x: {linear_x:.3f}, angular_z: {angular_z:.3f}")

            # --- C. Byte Serialization ---
            # Contract: 10 bytes -> <(Little Endian) c(char) f(float32) f(float32) b(int8)
            try:
                payload = struct_packer.pack_command(linear_x, angular_z, active_flag)
                
                # --- D. Transmit ---
                if ser and ser.is_open:
                    ser.write(payload)
                    sys_state["tx_active"] = True
                    log_event(f"[MAIN EVENT] Sent Data via Serial -> linear_x: {linear_x:.3f}, angular_z: {angular_z:.3f}, flag: {active_flag}")
                    
                    # Note: To implement rx_ping_ms, you would read ser.in_waiting here 
                    # and parse returning telemetry byte arrays from the Jetson.
                else:
                    sys_state["tx_active"] = False
                    log_event(f"[MAIN EVENT FAILURE] Serial port not open, couldn't send -> linear_x: {linear_x:.3f}, angular_z: {angular_z:.3f}, flag: {active_flag}")
                    
                idle_sent = is_idle

            except Exception as e:
                sys_state["tx_active"] = False
                log_event(f"[MAIN EVENT FAILURE] Transmission Error -> {e}")
        else:
            # Maintain tx_active status if we are just skipping idle transmissions
            if ser and ser.is_open:
                sys_state["tx_active"] = True
            else:
                sys_state["tx_active"] = False

        # --- E. Enforce 20 Hz Loop Rate ---
        elapsed = time.time() - loop_start
        sleep_time = max(0.0, (1.0 / LOOP_HZ) - elapsed)
        await asyncio.sleep(sleep_time)


# ==========================================
# ASYNC LOOP 2: WEBSOCKET BRIDGE
# ==========================================
async def handle_ws_client(websocket):
    """Handles bidirectional JSON communication with the React UI."""
    log_event(f"[WEBSOCKET] React UI Connected from {websocket.remote_address}")
    
    # Task 2a: Send telemetry to React
    async def send_telemetry():
        ws_idle_sent = False
        while True:
            try:
                # Package the shared state into JSON
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
                        "port": SERIAL_PORT
                    },
                    "rover_state": {
                        "active_flag": sys_state["cmd_flag"]
                    }
                }
                
                # Always broadcast to keep UI heartbeat and connection status fresh
                telemetry_json = json.dumps(telemetry)
                # Avoid spamming the local python log with identical idle frames
                is_idle = (sys_state["joy_x"] == 0.0 and sys_state["joy_y"] == 0.0 and sys_state["cmd_flag"] == 0)
                if not is_idle or not ws_idle_sent:
                    log_event(f"[MAIN EVENT] Sending Telemetry via WS -> {telemetry_json}")
                    ws_idle_sent = is_idle
                await websocket.send(telemetry_json)
                
                await asyncio.sleep(0.05) # Send at 20 Hz
            except websockets.exceptions.ConnectionClosed as e:
                log_event(f"[MAIN EVENT FAILURE] WS Send Error / Connection Closed -> {e}")
                break

    # Task 2b: Receive Hardware Test commands from React
    async def receive_commands():
        try:
            async for message in websocket:
                log_event(f"[MAIN EVENT] Received Data via WS -> {message}")
                data = json.loads(message)
                
                if data.get("action") == "TRIGGER_TEST":
                    test_id = data.get("test_id", 0)
                    timeout = data.get("timeout_ms", 3000)
                    
                    log_event(f"[UI COMMAND] Hardware Test {test_id} triggered.")
                    
                    # Lock out the joystick and set the multiplexer flag
                    sys_state["cmd_flag"] = test_id
                    sys_state["test_timeout"] = time.time() + (timeout / 1000.0)
                    
        except websockets.exceptions.ConnectionClosed as e:
            log_event(f"[MAIN EVENT FAILURE] WS Receive Error / Connection Closed -> {e}")

    # Run both WebSocket tasks concurrently
    await asyncio.gather(
        send_telemetry(),
        receive_commands()
    )
    log_event("[WEBSOCKET] React UI Disconnected.")

async def start_ws_server():
    """Initializes the WebSocket server."""
    async with websockets.serve(handle_ws_client, "localhost", WS_PORT):
        log_event(f"[WEBSOCKET] Server listening on ws://localhost:{WS_PORT}")
        await asyncio.Future()  # Run forever

# ==========================================
# MAIN EXECUTION
# ==========================================
async def main():
    log_event("--- ROVER GCS BACKEND INITIALIZING ---")
    
    # asyncio.gather runs both the hardware I/O and the network I/O simultaneously 
    # without them blocking each other on a single thread.
    await asyncio.gather(
        hardware_loop(),
        start_ws_server()
    )

if __name__ == "__main__":
    try:
        # For Python 3.10+, this is the standard way to run the async event loop
        asyncio.run(main())
    except KeyboardInterrupt:
        log_event("\n[SYSTEM] Base Station Shutting Down.")
        pygame.quit()
        sys.exit(0)