import time
import os
import random

OUTPUT_DIR = "factory_data"
DMO_FILE = os.path.join(OUTPUT_DIR, "inspection_latest.dmo")

def create_dmo_file():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    parts = {
        "UPPER_FLANGE": {"nom": 50.000, "dev": round(random.uniform(1.65, 2.25), 3), "tol": 2.000},
        "MAIN_BORE_HOLE": {"nom": 15.000, "dev": round(random.uniform(0.04, 0.15), 3), "tol": 0.100},
        "TURBINE_BLADE_ROOT": {"nom": 32.500, "dev": round(random.uniform(1.10, 1.80), 3), "tol": 1.500},
        "INLET_NOZZLE_RING": {"nom": 78.200, "dev": round(random.uniform(1.80, 2.90), 3), "tol": 2.500},
        "EXHAUST_STATOR_BOSS": {"nom": 24.000, "dev": round(random.uniform(1.00, 2.10), 3), "tol": 1.800},
    }
    
    lines = [
        "START_INSPECTION_ROUTINE/ AERO_BRACKET_V4",
        "DATE/ 2026-10-17",
        "MACHINE/ HEXAGON_GLOBAL_S",
        ""
    ]
    for name, data in parts.items():
        lines.extend([
            f"FILNAM/ {name}",
            f"NOMINAL/ {data['nom']:.3f}",
            f"MEASURED/ {data['nom'] + (data['dev']/1000.0):.4f}",
            f"DEVIATION/ {data['dev']:.3f}",
            f"TOLERANCE_ZONE/ {data['tol']:.3f}",
            ""
        ])
    lines.append("END_INSPECTION/")
    
    with open(DMO_FILE, 'w') as f:
        f.write("\n".join(lines).strip())
        
    print(f"Generated new mock DMO file at {DMO_FILE} for 5 aerospace parts.")

if __name__ == "__main__":
    print("Starting Factory Simulator for 5 aerospace parts...")
    while True:
        create_dmo_file()
        time.sleep(60)
