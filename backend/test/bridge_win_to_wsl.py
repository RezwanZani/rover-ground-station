import serial
import socket

# Connect to com0com loopback
ser = serial.Serial('COM21', 115200, timeout=0.01)

# UDP socket directed into WSL 2 (Windows 11 forwards localhost directly into WSL)
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
WSL_TARGET = ("127.0.0.1", 9870)

print("[BRIDGE] Forwarding COM11 bytes -> WSL2 UDP 127.0.0.1:9870...")

while True:
    if ser.in_waiting >= 10:
        data = ser.read(10)
        sock.sendto(data, WSL_TARGET)