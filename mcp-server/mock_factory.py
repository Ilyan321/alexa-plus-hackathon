import time
import os
import random

OUTPUT_DIR = "factory_data"
DMO_FILE = os.path.join(OUTPUT_DIR, "inspection_latest.dmo")

def create_dmo_file():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Simulate slightly fluctuating metrology data
    upper_flange_dev = round(random.uniform(1.70, 2.10), 3)
    bore_hole_dev = round(random.uniform(0.01, 0.05), 3)
    
    dmo_content = f"""
START_INSPECTION_ROUTINE/ AERO_BRACKET_V4
DATE/ 2026-10-09
MACHINE/ HEXAGON_GLOBAL_S

FILNAM/ UPPER_FLANGE
NOMINAL/ 50.000
MEASURED/ {50.000 + upper_flange_dev}
DEVIATION/ {upper_flange_dev}
TOLERANCE_ZONE/ 2.000

FILNAM/ MAIN_BORE_HOLE
NOMINAL/ 15.000
MEASURED/ {15.000 + bore_hole_dev}
DEVIATION/ {bore_hole_dev}
TOLERANCE_ZONE/ 0.100

END_INSPECTION/
    """
    
    with open(DMO_FILE, 'w') as f:
        f.write(dmo_content.strip())
        
    print(f"Generated new mock DMO file at {DMO_FILE} | Upper Flange Dev: {upper_flange_dev}")

if __name__ == "__main__":
    print("Starting Factory Simulator...")
    while True:
        create_dmo_file()
        # Overwrite the file every 60 seconds to simulate a live factory
        time.sleep(60)
