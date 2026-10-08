import serial
import struct

# Connect to the receiving physical XBee
ser = serial.Serial('COM18', 115200)
print("Listening for API Mode packets on COM18...")

while True:
    # 1. Hunt for the API Start Delimiter (0x7E)
    if ser.in_waiting > 0:
        if ser.read(1) == b'\x7E':
            
            # 2. Extract the 2-byte length
            length_data = ser.read(2)
            if len(length_data) == 2:
                frame_length = int.from_bytes(length_data, 'big')
                
                # Protect against buffer overflows from corrupted length bytes
                if frame_length > 100:
                    continue
                
                # 3. Read the exact Frame Data + 1 Checksum byte
                frame_data = ser.read(frame_length + 1)
                
                if len(frame_data) == frame_length + 1:
                    api_payload = frame_data[:-1]
                    received_checksum = frame_data[-1]
                    
                    # 4. Validate Hardware Checksum (0xFF minus 8-bit sum)
                    calc_checksum = 0xFF - (sum(api_payload) & 0xFF)
                    if calc_checksum == received_checksum:
                        
                        # 5. Process RF Receive Packets (0x90)
                        if api_payload[0] == 0x90:
                            # Bypass the 12-byte API overhead (Frame Type, MAC, Network Address, Options)
                            rf_data = api_payload[12:]
                            
                            # Validate the inner struct matches our contract
                            if len(rf_data) == 10 and rf_data[0:1] == b'$':
                                unpacked = struct.unpack('<cffb', rf_data)
                                
                                print(f"Received -> Sync: {unpacked[0]}, Linear X: {unpacked[1]:.2f}, Angular Z: {unpacked[2]:.2f}, Flag: {unpacked[3]}")
                                
                                # 6. Fire the Heartbeat Ping back to main.py (0x10 Transmit Request)
                                ping_payload = struct.pack('<cb', b'#', unpacked[3])
                                
                                # Frame ID 0x00, Broadcast MAC, 0x01 Option (Disable MAC Retries)
                                tx_header = b'\x10\x00\x00\x00\x00\x00\x00\x00\xFF\xFF\xFF\xFE\x00\x01'
                                tx_frame = tx_header + ping_payload
                                tx_checksum = 0xFF - (sum(tx_frame) & 0xFF)
                                
                                out_packet = struct.pack('>BH', 0x7E, len(tx_frame)) + tx_frame + bytes([tx_checksum])
                                ser.write(out_packet)