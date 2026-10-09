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

mcp = MCPServer("EchoForge Metrology Bridge")
DMO_FILE_PATH = os.path.join("factory_data", "inspection_latest.dmo")

def get_deviation(feature_name: str) -> str:
    if not os.path.exists(DMO_FILE_PATH):
        return f"Error: Could not find DMO file."
    try:
        with open(DMO_FILE_PATH, 'r') as file:
            content = file.read()
        blocks = content.split('FILNAM/')
        for block in blocks:
            if block.strip().startswith(feature_name.upper()):
                match = re.search(r'DEVIATION/\s*([\d\.\-]+)', block)
                if match:
                    return f"The deviation for {feature_name} is {float(match.group(1))} microns."
        return f"Feature '{feature_name}' not found."
    except Exception as e:
        return f"Failed: {str(e)}"

@mcp.tool()
def query_dmo_deviation(feature_name: str) -> str:
    """Reads the local .DMO legacy inspection file and returns the deviation for a specific feature."""
    return get_deviation(feature_name)

@mcp.tool()
def get_repair_procedure(feature_name: str, deviation_microns: float) -> str:
    """Gets the standard engineering repair procedure for a feature that is out of tolerance."""
    if "FLANGE" in feature_name.upper():
        return f"REPAIR PROCEDURE FOR {feature_name}: Apply CNC re-milling program 4A to shave off {deviation_microns} microns. Recalibrate robotic welder offset by -0.05mm."
    elif "HOLE" in feature_name.upper():
        return f"REPAIR PROCEDURE FOR {feature_name}: Bore out hole by an additional {deviation_microns} microns using titanium drill bit T-12."
    else:
        return f"REPAIR PROCEDURE FOR {feature_name}: Standard manual sanding and re-measurement required."

async def rest_query(request):
    try:
        body = await request.json()
        feature = body.get("feature_name", "UPPER_FLANGE")
        return JSONResponse({"deviation_info": get_deviation(feature)})
    except:
        return JSONResponse({"deviation_info": get_deviation("UPPER_FLANGE")})

def generate_dummy_dmo():
    os.makedirs("factory_data", exist_ok=True)
    count = 0
    while True:
        deviation = 1.800 if count % 2 == 0 else 2.100
        content = f"FILNAM/ UPPER_FLANGE\nDEVIATION/ {deviation:.3f}\n"
        with open(DMO_FILE_PATH, 'w') as f: f.write(content)
        count += 1
        time.sleep(60)

if __name__ == "__main__":
    t = threading.Thread(target=generate_dummy_dmo, daemon=True)
    t.start()
    port = int(os.environ.get("PORT", 8000))
    sse = SseServerTransport("/messages")
    
    async def handle_sse(request):
        async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
            await mcp.server.run(streams[0], streams[1], mcp.server.create_initialization_options())

    async def handle_messages(request):
        await sse.handle_post_message(request.scope, request.receive, request._send)

    app = Starlette(debug=True, routes=[
        Route("/sse", endpoint=handle_sse, methods=["GET"]),
        Route("/sse", endpoint=handle_messages, methods=["POST"]),
        Route("/messages", endpoint=handle_messages, methods=["POST"]),
        Route("/query", endpoint=rest_query, methods=["POST"])
    ])
    
    uvicorn.run(app, host="0.0.0.0", port=port)
