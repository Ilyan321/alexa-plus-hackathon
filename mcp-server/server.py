import os
import re
from mcp.server.mcpserver import MCPServer
import threading
import time
import uvicorn
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.middleware.base import BaseHTTPMiddleware
from mcp.server.sse import SseServerTransport

mcp = MCPServer("EchoForge Metrology Bridge")
DMO_FILE_PATH = os.path.join("factory_data", "inspection_latest.dmo")

@mcp.tool()
def query_dmo_deviation(feature_name: str) -> str:
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

def generate_dummy_dmo():
    os.makedirs("factory_data", exist_ok=True)
    count = 0
    while True:
        deviation = 1.800 if count % 2 == 0 else 2.100
        content = f"FILNAM/ UPPER_FLANGE\nDEVIATION/ {deviation:.3f}\n"
        with open(DMO_FILE_PATH, 'w') as f: f.write(content)
        count += 1
        time.sleep(60)

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        body = await request.body()
        print(f"INCOMING REQUEST: {request.method} {request.url.path} HEADERS: {request.headers} BODY: {body.decode('utf-8', errors='ignore')}", flush=True)
        # We need to put the body back so the downstream can read it
        async def receive():
            return {"type": "http.request", "body": body}
        request._receive = receive
        response = await call_next(request)
        print(f"OUTGOING RESPONSE: {response.status_code}", flush=True)
        return response

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
        Route("/messages", endpoint=handle_messages, methods=["POST"])
    ])
    app.add_middleware(LoggingMiddleware)
    
    uvicorn.run(app, host="0.0.0.0", port=port)
