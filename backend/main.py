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
import socket
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
import os as _os
sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), '..', '..'))
from comms_config import (
    GUI_XBEE_PORT, XBEE_BAUD_RATE, GUI_LOOP_HZ, GUI_DEADZONE, WS_PORT,
    UDP_STATUS_PORT, UDP_LISTEN_IP, UDP_JOY_PORT, MASTER_IP,
    scan_available_ports, AVAILABLE_BAUD_RATES,
)
# Get COM port from command line args if provided, else scan available ports
initial_detected_ports = scan_available_ports()
DEFAULT_SERIAL_PORT = sys.argv[1] if len(sys.argv) > 1 else (
    initial_detected_ports[0] if initial_detected_ports else GUI_XBEE_PORT
)
BAUD_RATE = XBEE_BAUD_RATE     # Must match XBee API mode baud rate
LOOP_HZ   = GUI_LOOP_HZ        # 20 Hz transmission rate (50ms period)
DEADZONE  = GUI_DEADZONE        # Analog stick deadzone to prevent drift spam
# WS_PORT already imported from comms_config (WebSocket port for React UI)

# ==========================================
# SHARED SYSTEM STATE (Multiplexer)
# ==========================================
# This dictionary bridges the physical loop, the UDP loop, and the WebSocket loop.
sys_state = {
    "joy_x": 0.0,           # Angular Z
    "joy_y": 0.0,           # Linear X
    "tx_active": False,     # Serial write status
    "rx_ping_ms": None,     # Heartbeat latency
    "cmd_flag": 0,          # 0 = Normal Teleop, >0 = Hardware Test Override
    "test_timeout": 0,      # Timestamp to automatically release the hardware test
    "joy_connected": False, # Gamepad hardware status
    "joy_name": "",         # Gamepad hardware name
    "target_port": DEFAULT_SERIAL_PORT,
    "current_port": None,
    "target_baud": BAUD_RATE,
    "current_baud": BAUD_RATE,
    "available_ports": initial_detected_ports,
    "available_bauds": AVAILABLE_BAUD_RATES,
    "master_active": False,
    "last_master_hb": 0.0,
    # Live Rover Telemetry (nominal realistic defaults)
    "battery": {"voltage": 24.2},
    "rover_state": {"active_flag": "NORMAL_TELEOP", "mission_time": "00:00:00"},
    "gps": {"lat": 23.8103, "lon": 90.4125, "heading": 0.0},
    "velocity": {"speed_mps": 0.0, "direction_deg": 0.0},
    "cmd_vel": {"linear_x": 0.0, "angular_z": 0.0},
    "arm": {"act1": 0.0, "act2": 0.0, "act3": 0.0, "wrist": 0.0, "gripper": 0.0},
    "imu": {"pitch": 0.0, "roll": 0.0, "yaw": 0.0},
    "motors": [
        {"name": "FRONT LEFT", "current_a": 1.2, "temp_c": 36.0},
        {"name": "FRONT RIGHT", "current_a": 1.3, "temp_c": 36.5},
        {"name": "MID LEFT", "current_a": 1.1, "temp_c": 35.8},
        {"name": "MID RIGHT", "current_a": 1.2, "temp_c": 36.1},
        {"name": "REAR LEFT", "current_a": 1.4, "temp_c": 37.0},
        {"name": "REAR RIGHT", "current_a": 1.3, "temp_c": 36.8},
    ],
    "last_telemetry_rx": 0.0,
    "connection": {
        "active_channel": "OFFLINE",
        "last_channel": "NONE",
        "xbee_connected": False,
        "xbee_port": "XBee 900MHz",
        "xbee_rx_pkts": 0,
        "gps_connected": False,
        "gps_fix": "NO FIX",
        "rtcm_received": False,
        "rtcm_count": 0,
        "rtcm_age_s": None,
    },
    "last_xbee_rx": 0.0,
    "last_udp_rx": 0.0,
    "last_channel": "NONE",
}

# ==========================================
# HELPER FUNCTIONS
# ==========================================
def apply_deadzone(value):
    """Zeroes out minor hardware stick drift."""
    if abs(value) < DEADZONE:
        return 0.0
    return float(value)


def process_incoming_telemetry(raw_data, is_xbee_hint=False):
    """Processes incoming telemetry bytes from UDP or XBee RF link."""
    try:
        is_xbee = is_xbee_hint
        if isinstance(raw_data, bytes):
            if raw_data.startswith(b'T'):
                raw_data = raw_data[1:]
                is_xbee = True
            elif raw_data.startswith(b'H'):
                # Base Master Heartbeat!
                try:
                    hb = json.loads(raw_data[1:].decode('utf-8'))
                    hb_port = hb.get("port", "XBee 900MHz")
                    hb_baud = hb.get("baud", sys_state.get("target_baud", BAUD_RATE))
                    hb_connected = hb.get("connected", False)
                    sys_state["connection"]["xbee_connected"] = hb_connected
                    sys_state["connection"]["xbee_port"] = hb_port
                    sys_state["connection"]["xbee_baud"] = hb_baud
                    sys_state["current_port"] = hb_port
                    sys_state["current_baud"] = hb_baud
                    sys_state["tx_active"] = hb_connected
                    sys_state["master_active"] = True
                    sys_state["last_master_hb"] = time.time()
                    return
                except Exception:
                    return
            elif raw_data.startswith(b'M') and len(raw_data) == 16:
                # Direct 16-byte MOTION Packet from Base Master or Teleop!
                try:
                    _, seq, vx, wz, a1, a2, a3, wr, gr = struct.unpack('<cBhhhhhhh', raw_data)
                    sys_state["cmd_vel"] = {
                        "linear_x": round(vx / 1000.0, 3),
                        "angular_z": round(wz / 1000.0, 3)
                    }
                    sys_state["arm"] = {
                        "act1": round(a1 / 1000.0, 1),
                        "act2": round(a2 / 1000.0, 1),
                        "act3": round(a3 / 1000.0, 1),
                        "wrist": round(wr / 1000.0, 1),
                        "gripper": round(gr / 1000.0, 1)
                    }
                    sys_state["joy_x"] = round(wz / 1000.0, 3)
                    sys_state["joy_y"] = round(vx / 1000.0, 3)
                    sys_state["joy_connected"] = True
                    return
                except Exception:
                    return
            text = raw_data.decode('utf-8', errors='ignore').strip()
        else:
            text = str(raw_data).strip()

        if not text or not (text.startswith('{') and text.endswith('}')):
            return

        data = json.loads(text)
        now = time.time()
        sys_state["last_telemetry_rx"] = now
        if is_xbee:
            sys_state["last_xbee_rx"] = now
            sys_state["last_channel"] = "XBEE"
        else:
            sys_state["last_udp_rx"] = now
            sys_state["last_channel"] = "UDP"

        # Update ping / latency if timestamp present
        if "timestamp" in data:
            dt = (now - data["timestamp"]) * 1000.0
            if 0 <= dt < 5000:
                sys_state["rx_ping_ms"] = round(dt, 1)

        # Merge telemetry fields
        if "battery" in data and isinstance(data["battery"], dict):
            sys_state["battery"] = data["battery"]

        if "gps" in data and isinstance(data["gps"], dict):
            sys_state["gps"] = data["gps"]

        if "velocity" in data and isinstance(data["velocity"], dict):
            sys_state["velocity"] = data["velocity"]

        if "cmd_vel" in data and isinstance(data["cmd_vel"], dict):
            sys_state["cmd_vel"] = data["cmd_vel"]

        if "arm" in data and isinstance(data["arm"], dict):
            sys_state["arm"] = data["arm"]

        if "imu" in data and isinstance(data["imu"], dict):
            sys_state["imu"] = data["imu"]

        if "motors" in data and isinstance(data["motors"], list):
            sys_state["motors"] = data["motors"]

        if "connection" in data and isinstance(data["connection"], dict):
            sys_state["connection"].update(data["connection"])

        if "rover_state" in data and isinstance(data["rover_state"], dict):
            if sys_state["cmd_flag"] == 0:
                sys_state["rover_state"]["active_flag"] = data["rover_state"].get("active_flag", "NORMAL_TELEOP")
            sys_state["rover_state"]["mission_time"] = data["rover_state"].get("mission_time", "00:00:00")

    except Exception:
        pass

# ==========================================
# ASYNC LOOP 1: HARDWARE & SERIAL ENGINE
# ==========================================
async def hardware_loop():
    """Reads gamepad, multiplexes UI commands, packs bytes, and writes to XBee."""
    last_ping_sent_time = 0.0
    last_ping_rx_time = 0.0
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
            sys_state["available_ports"] = scan_available_ports()
            last_port_scan = loop_start

        # Handle Serial Port and Baud Changes in Standalone Mode
        is_master_active = (time.time() - sys_state.get("last_master_hb", 0)) < 3.0
        if not is_master_active:
            target_p = sys_state["target_port"]
            target_b = sys_state.get("target_baud", BAUD_RATE)
            curr_p = sys_state["current_port"]
            curr_b = sys_state.get("current_baud", BAUD_RATE)

            if target_p != curr_p or target_b != curr_b:
                if ser:
                    ser.close()
                    ser = None
                if target_p:
                    try:
                        ser = serial.Serial(target_p, target_b, timeout=0.01)
                        log_event(f"[SERIAL] Connected to XBee on {target_p} at {target_b} baud.")
                    except serial.SerialException as e:
                        log_event(f"[SERIAL ERROR] Could not open {target_p} at {target_b} baud. Running in dry-run mode without radio.")
                        ser = None
                sys_state["current_port"] = target_p
                sys_state["current_baud"] = target_b
        else:
            # BaseMaster hub is managing radio: close local port if open to avoid locking conflicts
            if ser:
                try:
                    ser.close()
                except Exception:
                    pass
                ser = None

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
                # 1. API Mode Transmit framing via struct_packer
                payload = struct_packer.pack_command(linear_x, angular_z, active_flag)
                
                if ser and ser.is_open:
                    last_ping_sent_time = time.perf_counter()
                    ser.write(payload)
                    sys_state["tx_active"] = True

                    # 2. API Mode Receive Parsing (0x90 Frames) for low-latency ping
                    while ser.in_waiting > 0:
                        if ser.read(1) == b'\x7E':
                            length_data = ser.read(2)
                            if len(length_data) == 2:
                                frame_len = int.from_bytes(length_data, 'big')
                                frame_data = ser.read(frame_len + 1)
                                
                                if len(frame_data) == frame_len + 1:
                                    api_payload = frame_data[:-1] # Strip checksum
                                    
                                    # Identify RX Packet (0x90) or SIL Bridge Loopback (0x10)
                                    if api_payload and api_payload[0] in (0x90, 0x10):
                                        if api_payload[0] == 0x90:
                                            rx_data = api_payload[12:] # Physical XBee RF Rx
                                        else:
                                            rx_data = api_payload[14:] # SIL TCP Bridge (0x10 loopback)

                                        # Identify Telemetry packet (prefixed with 'T' or '{')
                                        if len(rx_data) > 0 and (rx_data[0:1] == b'T' or rx_data[0:1] == b'{'):
                                            process_incoming_telemetry(rx_data)

                                        if len(rx_data) > 0 and rx_data[0:1] == b'#':
                                            last_ping_rx_time = time.perf_counter()
                                            rtt_ms = (last_ping_rx_time - last_ping_sent_time) * 1000.0
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

        if time.perf_counter() - last_ping_rx_time > 0.5:
            sys_state["rx_ping_ms"] = None

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
                now = time.time()
                tel_age = now - sys_state.get("last_telemetry_rx", 0)
                link_qual = 100 if tel_age < 1.5 else max(0, int(100 - (tel_age - 1.5) * 20))

                xbee_alive = (now - sys_state.get("last_xbee_rx", 0)) < 3.0
                udp_alive = (now - sys_state.get("last_udp_rx", 0)) < 3.0

                if xbee_alive and udp_alive:
                    current_chan = "DUAL_ACTIVE"
                elif udp_alive:
                    current_chan = "UDP"
                elif xbee_alive:
                    current_chan = "XBEE"
                else:
                    current_chan = "OFFLINE"

                conn_status = dict(sys_state.get("connection", {}))
                conn_status["active_channel"] = current_chan
                conn_status["last_channel"] = sys_state.get("last_channel", "NONE")

                telemetry = {
                    "timestamp": now,
                    "joy": {
                        "axis_x": sys_state["joy_x"],
                        "axis_y": sys_state["joy_y"],
                        "connected": sys_state["joy_connected"],
                        "name": sys_state["joy_name"],
                        "deadband": DEADZONE
                    },
                    "radio": {
                        "tx_active": sys_state["tx_active"],
                        "rx_ping_ms": sys_state["rx_ping_ms"],
                        "port": sys_state.get("current_port") or sys_state.get("target_port"),
                        "baud": sys_state.get("current_baud") or sys_state.get("target_baud", BAUD_RATE),
                        "available_ports": sys_state.get("available_ports", []),
                        "available_bauds": sys_state.get("available_bauds", AVAILABLE_BAUD_RATES),
                        "link_quality": link_qual
                    },
                    "rover_state": {
                        "active_flag": "TEST_MODE" if sys_state["cmd_flag"] > 0 else sys_state["rover_state"].get("active_flag", "NORMAL_TELEOP"),
                        "mission_time": sys_state["rover_state"].get("mission_time", "00:00:00")
                    },
                    "battery": sys_state["battery"],
                    "gps": sys_state["gps"],
                    "velocity": sys_state["velocity"],
                    "cmd_vel": sys_state.get("cmd_vel", {
                        "linear_x": round(sys_state["joy_y"], 3),
                        "angular_z": round(sys_state["joy_x"], 3),
                    }),
                    "arm": sys_state.get("arm", {
                        "act1": 0.0,
                        "act2": 0.0,
                        "act3": 0.0,
                        "wrist": 0.0,
                        "gripper": 0.0,
                    }),
                    "imu": sys_state["imu"],
                    "motors": sys_state["motors"],
                    "connection": conn_status,
                }
                
                telemetry_json = json.dumps(telemetry)
                is_idle = (sys_state["joy_x"] == 0.0 and sys_state["joy_y"] == 0.0 and sys_state["cmd_flag"] == 0 and tel_age > 1.0)
                if not is_idle or not ws_idle_sent:
                    # Log sparse to prevent flooding the terminal
                    log_event(f"[MAIN EVENT] Live Telemetry -> Bat:{sys_state['battery']['voltage']}V | Lat:{sys_state['gps']['lat']:.4f} | Roll:{sys_state['imu']['roll']:.1f}° | Speed:{sys_state['velocity']['speed_mps']:.1f}m/s")
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
                        # Notify BaseMaster hub if active
                        try:
                            ctrl_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                            ctrl_pkt = b'K' + json.dumps({"action": "SET_PORT", "port": port}).encode('utf-8')
                            ctrl_sock.sendto(ctrl_pkt, (MASTER_IP, UDP_JOY_PORT))
                            ctrl_sock.close()
                        except Exception:
                            pass
                elif data.get("action") == "SET_BAUD":
                    try:
                        baud = int(data.get("baud", 115200))
                        sys_state["target_baud"] = baud
                        log_event(f"[UI COMMAND] Baud rate change requested to {baud}.")
                        # Notify BaseMaster hub if active
                        try:
                            ctrl_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                            ctrl_pkt = b'K' + json.dumps({"action": "SET_BAUD", "baud": baud}).encode('utf-8')
                            ctrl_sock.sendto(ctrl_pkt, (MASTER_IP, UDP_JOY_PORT))
                            ctrl_sock.close()
                        except Exception:
                            pass
                    except Exception as e:
                        log_event(f"[UI COMMAND ERROR] Invalid baud rate: {e}")
                elif data.get("action") == "SET_CONFIG":
                    try:
                        port = data.get("port")
                        baud = data.get("baud")
                        if port: sys_state["target_port"] = port
                        if baud: sys_state["target_baud"] = int(baud)
                        log_event(f"[UI COMMAND] Radio config change requested: Port={port}, Baud={baud}.")
                        try:
                            ctrl_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                            ctrl_pkt = b'K' + json.dumps({"action": "SET_CONFIG", "port": port, "baud": baud}).encode('utf-8')
                            ctrl_sock.sendto(ctrl_pkt, (MASTER_IP, UDP_JOY_PORT))
                            ctrl_sock.close()
                        except Exception:
                            pass
                    except Exception as e:
                        log_event(f"[UI COMMAND ERROR] Setting config failed: {e}")
                    
        except websockets.exceptions.ConnectionClosed as e:
            log_event(f"[MAIN EVENT FAILURE] WS Receive Error / Connection Closed -> {e}")

    await asyncio.gather(
        send_telemetry(),
        receive_commands()
    )
    log_event("[WEBSOCKET] React UI Disconnected.")

# ==========================================
# ASYNC LOOP 3: NETWORK UDP TELEMETRY RECEIVER
# ==========================================
async def telemetry_udp_loop():
    """Listens for UDP telemetry packets from the Rover over network."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((UDP_LISTEN_IP, UDP_STATUS_PORT))
        sock.setblocking(False)
        log_event(f"[UDP TELEMETRY] Listening for Rover Telemetry on {UDP_LISTEN_IP}:{UDP_STATUS_PORT}")
    except Exception as e:
        log_event(f"[UDP ERROR] Could not bind UDP telemetry socket on {UDP_STATUS_PORT}: {e}")
        return

    while True:
        try:
            while True:
                try:
                    data, addr = sock.recvfrom(4096)
                    if data:
                        process_incoming_telemetry(data)
                except (BlockingIOError, InterruptedError):
                    break
        except Exception:
            pass
        await asyncio.sleep(0.02)  # 50 Hz poll

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
        start_ws_server(),
        telemetry_udp_loop()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log_event("\n[SYSTEM] Base Station Shutting Down.")
        pygame.quit()
        sys.exit(0)
