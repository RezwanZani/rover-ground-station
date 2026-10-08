import serial
import struct
import sys

# Get COM port from command line args if provided, else default to COM21
COM_PORT = sys.argv[1] if len(sys.argv) > 1 else 'COM21'
# Connect to the other end of the com0com pair
ser = serial.Serial(COM_PORT, 115200)
print("Listening on " + COM_PORT +"...")

PACKET_FORMAT = '<cffb'
EXPECTED_SIZE = struct.calcsize(PACKET_FORMAT)

while True:
    if ser.in_waiting >= 1:
        sync = ser.read(1)
        if sync == b'$':
            remaining = ser.read(EXPECTED_SIZE - 1)
            if len(remaining) == EXPECTED_SIZE - 1:
                payload = sync + remaining
                try:
                    unpacked_data = struct.unpack(PACKET_FORMAT, payload)
                    print(f"Received -> Sync: {unpacked_data[0]}, Linear X: {unpacked_data[1]:.2f}, Angular Z: {unpacked_data[2]:.2f}, Flag: {unpacked_data[3]}")
                    
                    # Send ACK back so backend can calculate ping
                    ser.write(b'#\x00')
                except struct.error:
                    pass
