import os
import re
from mcp.server.mcpserver import MCPServer
import threading
import time

mcp = MCPServer("EchoForge Metrology Bridge")
DMO_FILE_PATH = os.path.join("factory_data", "inspection_latest.dmo")

@mcp.tool()
def query_dmo_deviation(feature_name: str) -> str:
    """Reads the local .DMO legacy inspection file and returns the deviation for a specific feature."""
    if not os.path.exists(DMO_FILE_PATH):
        return f"Error: Could not find the local DMO file at {DMO_FILE_PATH}. Factory machine may be offline."
    try:
        with open(DMO_FILE_PATH, 'r') as file:
            content = file.read()
        blocks = content.split('FILNAM/')
        for block in blocks:
            if block.strip().startswith(feature_name.upper()):
                match = re.search(r'DEVIATION/\s*([\d\.\-]+)', block)
                if match:
                    deviation = float(match.group(1))
                    return f"The deviation for {feature_name} is {deviation} microns."
        return f"Feature '{feature_name}' was not found in the latest inspection file."
    except Exception as e:
        return f"Failed to parse legacy file: {str(e)}"

def generate_dummy_dmo():
    os.makedirs("factory_data", exist_ok=True)
    count = 0
    while True:
        deviation = 1.800 if count % 2 == 0 else 2.100
        content = f"""START_INSPECTION_ROUTINE/ AERO_BRACKET_V4
DATE/ 2026-10-09
MACHINE/ HEXAGON_GLOBAL_S

FILNAM/ UPPER_FLANGE
NOMINAL/ 50.000
MEASURED/ {50.0 + deviation:.3f}
DEVIATION/ {deviation:.3f}
TOLERANCE_ZONE/ 2.000

END_INSPECTION/"""
        with open(DMO_FILE_PATH, 'w') as f:
            f.write(content)
        count += 1
        time.sleep(60)

if __name__ == "__main__":
    t = threading.Thread(target=generate_dummy_dmo, daemon=True)
    t.start()
    
    port = int(os.environ.get("PORT", 8000))
    
    # We will use Starlette directly to route both GET and POST to the SSE endpoint
    # to support clients that POST to the SSE URL instead of /messages
    import uvicorn
    from starlette.applications import Starlette
    from starlette.routing import Route
    from mcp.server.sse import SseServerTransport
    
    sse = SseServerTransport("/messages")
    
    async def handle_sse(request):
        async with sse.connect_sse(
            request.scope, request.receive, request._send
        ) as streams:
            await mcp.server.run(
                streams[0], streams[1], mcp.server.create_initialization_options()
            )

    async def handle_messages(request):
        await sse.handle_post_message(request.scope, request.receive, request._send)

    app = Starlette(debug=True, routes=[
        Route("/sse", endpoint=handle_sse, methods=["GET"]),
        Route("/sse", endpoint=handle_messages, methods=["POST"]),
        Route("/messages", endpoint=handle_messages, methods=["POST"])
    ])
    
    uvicorn.run(app, host="0.0.0.0", port=port)
