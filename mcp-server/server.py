import os
import re
import json
import threading
import time
import uvicorn
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.responses import JSONResponse
from mcp.server.mcpserver import MCPServer
from mcp.server.sse import SseServerTransport
from mcp.server.transport_security import TransportSecuritySettings

mcp = MCPServer("EchoForge Metrology Bridge")
DMO_FILE_PATH = os.path.join("factory_data", "inspection_latest.dmo")

PARTS_METROLOGY = {
    "UPPER_FLANGE": {
        "nominal": 50.000,
        "tolerance": 2.0,
        "unit": "microns",
        "procedure": lambda dev: f"CNC RE-MILLING (Program 4A): Shave off {dev:.3f} microns using 1mm carbide end mill. Recalibrate robotic welder offset by -0.05mm."
    },
    "MAIN_BORE_HOLE": {
        "nominal": 15.000,
        "tolerance": 0.1,
        "unit": "microns",
        "procedure": lambda dev: f"PRECISION DIAMOND HONING: Bore out cylinder bore by an additional {dev:.3f} microns using titanium boring bar T-12 at 3200 RPM."
    },
    "TURBINE_BLADE_ROOT": {
        "nominal": 32.500,
        "tolerance": 1.5,
        "unit": "microns",
        "procedure": lambda dev: f"EDM SPARK EROSION (Cycle E-9): Submerge in dielectric fluid and run spark erosion pass at 45A to re-profile fir-tree root tangs by {dev:.3f} microns."
    },
    "INLET_NOZZLE_RING": {
        "nominal": 78.200,
        "tolerance": 2.5,
        "unit": "microns",
        "procedure": lambda dev: f"MICRO-ABRASIVE CNC BLENDING: Perform 3-axis orbital lap on nozzle throat surface to reduce deviation of {dev:.3f} microns, followed by ceramic passivation coat."
    },
    "EXHAUST_STATOR_BOSS": {
        "nominal": 24.000,
        "tolerance": 1.8,
        "unit": "microns",
        "procedure": lambda dev: f"FACING & RE-THREAD CHASING: CNC face skim cut of 0.02mm on boss seating surface and chase M24 threads with high-speed toolholder."
    }
}

def get_deviation(feature_name: str) -> str:
    if not os.path.exists(DMO_FILE_PATH):
        return f"Error: Could not find DMO file."
    try:
        clean_name = feature_name.strip().upper().replace(" ", "_")
        with open(DMO_FILE_PATH, 'r') as file:
            content = file.read()
        blocks = content.split('FILNAM/')
        for block in blocks:
            lines = [l.strip() for l in block.strip().split('\n') if l.strip()]
            if lines and (lines[0] == clean_name or clean_name in lines[0]):
                dev_match = re.search(r'DEVIATION/\s*([\d\.\-]+)', block)
                tol_match = re.search(r'TOLERANCE_ZONE/\s*([\d\.\-]+)', block)
                if dev_match:
                    dev_val = float(dev_match.group(1))
                    tol_info = f" (Tolerance Zone: {float(tol_match.group(1))} microns)" if tol_match else ""
                    return f"The deviation for {clean_name} is {dev_val:.3f} microns{tol_info}."
        return f"Feature '{feature_name}' not found. Supported parts: {', '.join(PARTS_METROLOGY.keys())}."
    except Exception as e:
        return f"Failed: {str(e)}"

@mcp.tool()
def query_dmo_deviation(feature_name: str) -> str:
    """Reads the local .DMO legacy inspection file and returns the deviation for a specific feature."""
    return get_deviation(feature_name)

@mcp.tool()
def get_repair_procedure(feature_name: str, deviation_microns: float) -> str:
    """Gets the standard engineering repair procedure for a feature that is out of tolerance."""
    clean_name = feature_name.strip().upper().replace(" ", "_")
    part = PARTS_METROLOGY.get(clean_name)
    if part:
        return f"REPAIR PROCEDURE FOR {clean_name}: {part['procedure'](deviation_microns)}"
    
    # Fallback heuristics
    if "FLANGE" in clean_name:
        return f"REPAIR PROCEDURE FOR {clean_name}: Apply CNC re-milling program 4A to shave off {deviation_microns:.3f} microns."
    elif "HOLE" in clean_name or "BORE" in clean_name:
        return f"REPAIR PROCEDURE FOR {clean_name}: Bore out hole by an additional {deviation_microns:.3f} microns using titanium boring tool."
    elif "BLADE" in clean_name:
        return f"REPAIR PROCEDURE FOR {clean_name}: EDM spark erosion pass to re-profile root tangs by {deviation_microns:.3f} microns."
    else:
        return f"REPAIR PROCEDURE FOR {clean_name}: Standard precision CNC skim cut and surface re-measurement required."

@mcp.custom_route("/repair", methods=["POST"])
async def rest_repair(request):
    try:
        body = await request.json()
        feature = body.get("feature_name", "UPPER_FLANGE")
        deviation = float(body.get("deviation_microns", 0.0))
        return JSONResponse({"repair_procedure": get_repair_procedure(feature, deviation)})
    except:
        return JSONResponse({"repair_procedure": get_repair_procedure("UPPER_FLANGE", 0.0)})

@mcp.custom_route("/query", methods=["POST"])
async def rest_query(request):
    try:
        body = await request.json()
        feature = body.get("feature_name", "UPPER_FLANGE")
        return JSONResponse({"deviation_info": get_deviation(feature)})
    except:
        return JSONResponse({"deviation_info": get_deviation("UPPER_FLANGE")})

@mcp.custom_route("/health", methods=["GET"])
async def rest_health(request):
    return JSONResponse({
        "status": "healthy",
        "service": "EchoForge Metrology Bridge",
        "mcp_protocol_version": "2025-11-25",
        "transports": ["streamable-http (/mcp)", "sse (/sse)"]
    })

import random

def generate_dummy_dmo():
    os.makedirs("factory_data", exist_ok=True)
    count = 0
    # Base deviation states for realistic factory inspection cycles (nominal, near-limit, and out-of-tolerance)
    dev_states = [
        {"UPPER_FLANGE": 2.100, "MAIN_BORE_HOLE": 0.045, "TURBINE_BLADE_ROOT": 1.150, "INLET_NOZZLE_RING": 2.750, "EXHAUST_STATOR_BOSS": 1.200},
        {"UPPER_FLANGE": 1.850, "MAIN_BORE_HOLE": 0.140, "TURBINE_BLADE_ROOT": 1.750, "INLET_NOZZLE_RING": 2.100, "EXHAUST_STATOR_BOSS": 1.950},
        {"UPPER_FLANGE": 1.720, "MAIN_BORE_HOLE": 0.055, "TURBINE_BLADE_ROOT": 1.200, "INLET_NOZZLE_RING": 1.800, "EXHAUST_STATOR_BOSS": 1.400},
    ]
    while True:
        state = dev_states[count % len(dev_states)]
        blocks = ["START_INSPECTION_ROUTINE/ AERO_BRACKET_V4\nDATE/ 2026-10-17\nMACHINE/ HEXAGON_GLOBAL_S\n"]
        for part_name, meta in PARTS_METROLOGY.items():
            base_dev = state.get(part_name, 1.0)
            # Realistic physical measurement jitter (Gaussian noise ±0.03 to ±0.08 microns)
            # Simulates real optical & contact probe thermal drift and surface roughness noise
            noise = random.gauss(0, 0.04)
            dev = max(0.010, round(base_dev + noise, 3))
            nominal = meta["nominal"]
            tol = meta["tolerance"]
            blocks.append(
                f"FILNAM/ {part_name}\nNOMINAL/ {nominal:.3f}\nMEASURED/ {nominal + (dev/1000.0):.4f}\nDEVIATION/ {dev:.3f}\nTOLERANCE_ZONE/ {tol:.3f}\n"
            )
        blocks.append("END_INSPECTION/\n")
        content = "\n".join(blocks)
        with open(DMO_FILE_PATH, 'w') as f:
            f.write(content)
        count += 1
        # Realistic variable inspection interval (45-60 seconds)
        time.sleep(random.uniform(45.0, 60.0))

# Configure legacy SSE transport for backward compatibility
sse = SseServerTransport("/messages")

async def handle_sse(request):
    async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
        await mcp._lowlevel_server.run(streams[0], streams[1], mcp.create_initialization_options())

async def handle_messages(request):
    await sse.handle_post_message(request.scope, request.receive, request._send)

# Attach legacy SSE routes
mcp._custom_starlette_routes.extend([
    Route("/sse", endpoint=handle_sse, methods=["GET"]),
    Route("/sse", endpoint=handle_messages, methods=["POST"]),
    Route("/messages", endpoint=handle_messages, methods=["POST"]),
])

# Create Streamable HTTP app (MCP Spec 2025-11-25) with DNS rebinding protection disabled for cloud proxy routing
security = TransportSecuritySettings(enable_dns_rebinding_protection=False)
app = mcp.streamable_http_app(streamable_http_path="/mcp", transport_security=security)

if __name__ == "__main__":
    t = threading.Thread(target=generate_dummy_dmo, daemon=True)
    t.start()
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
