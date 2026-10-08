"""
struct_packer.py
Handles the high-efficiency binary serialization and API Mode 1 framing for the RF radio link.
"""
import struct

# ==========================================
# PACKET CONTRACT DEFINITION
# ==========================================
PAYLOAD_FORMAT = '<cffb'
SYNC_CHAR = b'$'

def pack_command(linear_x: float, angular_z: float, cmd_flag: int = 0) -> bytes:
    """
    Compresses inputs into the 10-byte struct and wraps them in an 
    XBee API Mode 1 Transmit Request (0x10) frame.
    """
    try:
        core_payload = struct.pack(PAYLOAD_FORMAT, SYNC_CHAR, float(linear_x), float(angular_z), int(cmd_flag))
    except struct.error as e:
        print(f"[PACKER ERROR] Failed to pack data: {e}")
        core_payload = struct.pack(PAYLOAD_FORMAT, SYNC_CHAR, 0.0, 0.0, 0)

    # Build XBee API Frame Type 0x10 (Transmit Request)
    # 0x10 : Frame Type
    # 0x00 : Frame ID (0 = No acknowledgment needed, reduces latency)
    # 0x000000000000FFFF : 64-bit Destination Address (Broadcast)
    # 0xFFFE : 16-bit Destination Address
    # 0x00 : Broadcast Radius (Maximum)
    # 0x01 : Transmit Options (Disable MAC retries for lowest latency teleop)
    api_header = b'\x10\x00\x00\x00\x00\x00\x00\x00\xFF\xFF\xFF\xFE\x00\x01'
    api_payload = api_header + core_payload
    
    # Calculate Checksum: 0xFF minus the 8-bit sum of bytes from Frame Type to end of data
    checksum = 0xFF - (sum(api_payload) & 0xFF)
    
    # Final API Frame: Start Delimiter (0x7E) + Length (2 bytes) + API Payload + Checksum
    frame_length = len(api_payload)
    return struct.pack('>BH', 0x7E, frame_length) + api_payload + bytes([checksum])

def unpack_command(payload: bytes) -> dict:
    """Deserializes the core 10-byte payload (used in mock receiver)."""
    unpacked_data = struct.unpack(PAYLOAD_FORMAT, payload)
    return {
        "sync": unpacked_data[0],
        "linear_x": unpacked_data[1],
        "angular_z": unpacked_data[2],
        "cmd_flag": unpacked_data[3]
    }