import csv
from datetime import datetime
import os

# Ensure logs directory exists
LOG_DIR = "logs"
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

LOG_FILE = os.path.join(LOG_DIR, f"rover_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")

def _init_logger():
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, mode='w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow(["Timestamp", "Message"])

_init_logger()

def log_event(msg):
    """
    Prints the message to the terminal and logs it to a CSV file with a timestamp.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    # Print to terminal
    print(msg)
    
    # Log to CSV
    try:
        with open(LOG_FILE, mode='a', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow([timestamp, msg])
    except Exception as e:
        print(f"[LOGGER ERROR] Failed to write to CSV: {e}")
