"""
struct_packer.py
Handles the high-efficiency binary serialization for the RF radio link.
"""
import struct
from csv_logger import log_event

# ==========================================
# PACKET CONTRACT DEFINITION
# ==========================================
# Format String: '<cffb'
# '<' : Little-Endian byte order (standard for most microcontrollers and Jetson)
# 'c' : char (1 byte)    - Synchronization character to identify the start of a frame
# 'f' : float32 (4 bytes)- Linear Velocity X (forward/reverse)
# 'f' : float32 (4 bytes)- Angular Velocity Z (steering)
# 'b' : int8 (1 byte)    - Command Flag (0=Teleop, 1-255=Hardware Tests)
# Total Size: 10 bytes
# ==========================================

PACKET_FORMAT = '<cffb'
SYNC_CHAR = b'$'
EXPECTED_SIZE = struct.calcsize(PACKET_FORMAT)

def pack_command(linear_x: float, angular_z: float, cmd_flag: int = 0) -> bytes:
    """
    Compresses the joystick inputs and command flags into a fixed 10-byte array.
    This guarantees zero network bloat across the XBee serial link.
    """
    log_event(f"[STRUCT PACKER EVENT] Packing data -> linear_x: {linear_x:.3f}, angular_z: {angular_z:.3f}, cmd_flag: {cmd_flag}")
    try:
        # Cast values to ensure they match the strict C-struct formatting
        packed = struct.pack(
            PACKET_FORMAT, 
            SYNC_CHAR, 
            float(linear_x), 
            float(angular_z), 
            int(cmd_flag)
        )
        log_event("[STRUCT PACKER EVENT] Successfully packed payload")
        return packed
    except struct.error as e:
        log_event(f"[PACKER EVENT FAILURE] Failed to pack data: {e}")
        # Return a zero-velocity failsafe packet if packing fails
        packed_failsafe = struct.pack(PACKET_FORMAT, SYNC_CHAR, 0.0, 0.0, 0)
        log_event("[STRUCT PACKER EVENT] Packed failsafe payload (zeroed)")
        return packed_failsafe

def unpack_command(payload: bytes) -> dict:
    """
    Deserializes the 10-byte payload back into usable variables.
    This function is primarily used for your local Mock Receiver (SIL testing).
    """
    log_event("[STRUCT PACKER EVENT] Unpacking payload")
    if len(payload) != EXPECTED_SIZE:
        log_event(f"[PACKER EVENT FAILURE] Unpack error: Expected {EXPECTED_SIZE} bytes, received {len(payload)}")
        raise ValueError(f"[UNPACK ERROR] Expected {EXPECTED_SIZE} bytes, received {len(payload)}")
    
    try:
        unpacked_data = struct.unpack(PACKET_FORMAT, payload)
        result = {
            "sync": unpacked_data[0],
            "linear_x": unpacked_data[1],
            "angular_z": unpacked_data[2],
            "cmd_flag": unpacked_data[3]
        }
        log_event(f"[STRUCT PACKER EVENT] Unpacked data -> {result}")
        return result
    except Exception as e:
        print(f"[PACKER EVENT FAILURE] Failed to unpack data: {e}")
        raise