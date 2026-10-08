# backend/test/bridge_com_to_tcp.py (Run natively on Windows)
import serial
import socket
import time
import sys

# Get COM port from command line args if provided, else default to COM21
COM_PORT = sys.argv[1] if len(sys.argv) > 1 else 'COM21'
BAUD_RATE = 115200
WSL_HOST = '127.0.0.1'
WSL_PORT = 9870

print(f"[BRIDGE] Opening {COM_PORT} at {BAUD_RATE} baud...")
try:
    ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=0.01)
except serial.SerialException as e:
    print(f"[SERIAL ERROR] Could not open {COM_PORT}: {e}")
    sys.exit(1)

def connect_to_wsl():
    """Continuously attempts to connect with a clean socket instance."""
    while True:
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            client.connect((WSL_HOST, WSL_PORT))
            print("[BRIDGE] Connected to WSL 2! Bridging active...")
            client.setblocking(False)
            return client
        except (ConnectionRefusedError, OSError):
            client.close()
            print("[BRIDGE] Waiting for socat in WSL 2 to start...")
            time.sleep(1)

client = connect_to_wsl()

try:
    bytes_tx = 0
    bytes_rx = 0
    last_log = time.time()

    while True:
        # Serial (com0com) -> TCP (WSL 2)
        if ser.in_waiting > 0:
            data = ser.read(ser.in_waiting)
            try:
                client.sendall(data)
                bytes_tx += len(data)
            except (BrokenPipeError, ConnectionResetError):
                print("[BRIDGE] WSL connection lost. Reconnecting...")
                client.close()
                client = connect_to_wsl()

        # TCP (WSL 2) -> Serial (com0com)
        try:
            reply = client.recv(1024)
            if reply == b'':
                print("[BRIDGE] WSL closed connection. Reconnecting...")
                client.close()
                client = connect_to_wsl()
            elif reply:
                ser.write(reply)
                bytes_rx += len(reply)
        except (BlockingIOError, InterruptedError):
            pass
        except (ConnectionResetError, BrokenPipeError):
            print("[BRIDGE] WSL connection lost. Reconnecting...")
            client.close()
            client = connect_to_wsl()

        # Live activity log every 2 seconds if traffic is active
        now = time.time()
        if now - last_log > 2.0:
            if bytes_tx > 0 or bytes_rx > 0:
                print(f"[TRAFFIC] TX -> WSL: {bytes_tx} bytes | RX <- WSL: {bytes_rx} bytes")
                bytes_tx = 0
                bytes_rx = 0
            last_log = now

        time.sleep(0.001)

except KeyboardInterrupt:
    print("\n[BRIDGE] Stopped by user.")
finally:
    ser.close()
    if client:
        client.close()