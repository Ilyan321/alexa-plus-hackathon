import os
import re
import json
import hmac
import math
import threading
import time
import uvicorn
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.responses import JSONResponse, HTMLResponse
from starlette.types import ASGIApp, Receive, Scope, Send
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
    },
    "MAIN_BORE_HOLE": {
        "nominal": 15.000,
        "tolerance": 0.1,
        "unit": "microns",
    },
    "TURBINE_BLADE_ROOT": {
        "nominal": 32.500,
        "tolerance": 1.5,
        "unit": "microns",
    },
    "INLET_NOZZLE_RING": {
        "nominal": 78.200,
        "tolerance": 2.5,
        "unit": "microns",
    },
    "EXHAUST_STATOR_BOSS": {
        "nominal": 24.000,
        "tolerance": 1.8,
        "unit": "microns",
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
        # Scan in reverse order so the most recent inspection reading for any part is always retrieved
        for block in reversed(blocks):
            lines = [l.strip() for l in block.strip().split('\n') if l.strip()]
            if lines and (lines[0] == clean_name or clean_name in lines[0]):
                dev_match = re.search(r'DEVIATION/\s*([\d\.\-]+)', block)
                tol_match = re.search(r'TOLERANCE_ZONE/\s*([\d\.\-]+)', block)
                if dev_match:
                    dev_val = float(dev_match.group(1))
                    tol_info = f" (Tolerance Zone: {float(tol_match.group(1))} microns)" if tol_match else ""
                    return f"The deviation for {clean_name} is {dev_val:.3f} microns{tol_info}."
        return f"Feature '{feature_name}' not found. Supported parts: {', '.join(PARTS_METROLOGY.keys())}."
    except Exception:
        return "Error: Unable to read inspection data."


class MCPRequestSecurityMiddleware:
    """Authenticate public tool and REST routes and reject untrusted hosts/origins."""

    protected_paths = {"/mcp", "/sse", "/messages", "/query", "/repair"}

    def __init__(self, app: ASGIApp):
        self.app = app
        self.token = os.environ.get("MCP_AUTH_TOKEN", "").strip()
        self.allowed_hosts = self._env_list(
            "MCP_ALLOWED_HOSTS",
            [
                "echoforge-mcp.onrender.com",
                "echoforge-mcp.onrender.com:*",
                "localhost:*",
                "127.0.0.1:*",
                "testserver",
            ],
        )
        self.allowed_origins = self._env_list(
            "MCP_ALLOWED_ORIGINS",
            [
                "https://echoforge.aenox.me",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ],
        )

    @staticmethod
    def _env_list(name: str, default: list[str]) -> list[str]:
        configured = os.environ.get(name)
        if configured is None:
            return default
        return [item.strip() for item in configured.split(",") if item.strip()]

    @staticmethod
    def _matches(value: str, allowlist: list[str]) -> bool:
        return any(
            value == allowed
            or (allowed.endswith(":*") and value.startswith(allowed[:-1]))
            for allowed in allowlist
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path") not in self.protected_paths:
            await self.app(scope, receive, send)
            return

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        host = headers.get(b"host", b"").decode("latin-1")
        origin = headers.get(b"origin", b"").decode("latin-1")
        if not self._matches(host, self.allowed_hosts):
            response = JSONResponse({"error": "Host not allowed"}, status_code=421)
        elif origin and not self._matches(origin, self.allowed_origins):
            response = JSONResponse({"error": "Origin not allowed"}, status_code=403)
        elif not self.token:
            response = JSONResponse({"error": "MCP authentication is not configured"}, status_code=503)
        else:
            authorization = headers.get(b"authorization", b"")
            scheme, separator, presented_token = authorization.partition(b" ")
            if (
                not separator
                or scheme.lower() != b"bearer"
                or not hmac.compare_digest(presented_token.strip(), self.token.encode("utf-8"))
            ):
                response = JSONResponse(
                    {"error": "Unauthorized"},
                    status_code=401,
                    headers={"WWW-Authenticate": "Bearer"},
                )
            else:
                await self.app(scope, receive, send)
                return

        await response(scope, receive, send)

@mcp.tool()
def query_dmo_deviation(feature_name: str) -> str:
    """Reads the local .DMO legacy inspection file and returns the deviation for a specific feature."""
    return get_deviation(feature_name)

@mcp.tool()
def get_repair_procedure(feature_name: str, deviation_microns: float) -> str:
    """Return a non-operational review notice for simulated metrology data."""
    if not isinstance(feature_name, str):
        raise ValueError("feature_name must be a supported feature name")
    clean_name = feature_name.strip().upper().replace(" ", "_")
    part = PARTS_METROLOGY.get(clean_name)
    if part is None:
        raise ValueError(f"Unsupported feature '{feature_name}'")
    try:
        deviation = float(deviation_microns)
    except (TypeError, ValueError) as exc:
        raise ValueError("deviation_microns must be a finite number") from exc
    if not math.isfinite(deviation):
        raise ValueError("deviation_microns must be a finite number")

    tolerance = part["tolerance"]
    magnitude = abs(deviation)
    if magnitude <= tolerance:
        return (
            f"METROLOGY REVIEW FOR {clean_name}: simulated deviation is {deviation:.3f} microns "
            f"within the ±{tolerance:.3f} micron tolerance. No repair is indicated by this reading."
        )
    return (
        f"SIMULATION ONLY — NOT A CNC INSTRUCTION. {clean_name} has a simulated deviation of "
        f"{deviation:.3f} microns, outside its ±{tolerance:.3f} micron tolerance. "
        "Do not machine from this output. A qualified engineer must verify the actual inspection "
        "data and select an approved work instruction."
    )

@mcp.custom_route("/repair", methods=["POST"])
async def rest_repair(request):
    try:
        body = await request.json()
    except (ValueError, json.JSONDecodeError):
        return JSONResponse({"error": "Request body must be valid JSON"}, status_code=400)
    if not isinstance(body, dict) or "feature_name" not in body or "deviation_microns" not in body:
        return JSONResponse(
            {"error": "feature_name and deviation_microns are required"},
            status_code=400,
        )
    try:
        procedure = get_repair_procedure(body["feature_name"], body["deviation_microns"])
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    return JSONResponse({"repair_procedure": procedure})

@mcp.custom_route("/query", methods=["POST"])
async def rest_query(request):
    try:
        body = await request.json()
    except (ValueError, json.JSONDecodeError):
        return JSONResponse({"error": "Request body must be valid JSON"}, status_code=400)
    if not isinstance(body, dict) or not isinstance(body.get("feature_name"), str):
        return JSONResponse({"error": "feature_name must be a string"}, status_code=400)
    feature = body["feature_name"].strip().upper().replace(" ", "_")
    if feature not in PARTS_METROLOGY:
        return JSONResponse({"error": "Unsupported feature name"}, status_code=400)
    return JSONResponse({"deviation_info": get_deviation(feature)})

@mcp.custom_route("/", methods=["GET"])
async def root_dashboard(request):
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EchoForge — Metrology Bridge</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #090a0f;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: radial-gradient(circle at top left, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8));
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      max-width: 540px;
      width: 100%;
      padding: 2.25rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px -10px rgba(14, 165, 233, 0.15);
      backdrop-filter: blur(12px);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .logo-badge {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.1rem;
      color: #fff;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
    }
    .title {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #f8fafc;
    }
    .subtitle {
      font-size: 0.8rem;
      color: #94a3b8;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #34d399;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      background: #10b981;
      border-radius: 50%;
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.9); }
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .info-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      padding: 0.85rem;
    }
    .info-box span {
      display: block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 0.25rem;
    }
    .info-box strong {
      font-size: 0.875rem;
      color: #e2e8f0;
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .endpoints {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }
    .endpoints h3 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      margin-bottom: 0.6rem;
    }
    .endpoint-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.35rem 0;
      font-size: 0.8rem;
      font-family: ui-monospace, monospace;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .endpoint-item:last-child { border-bottom: none; }
    .method {
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 700;
    }
    .get { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
    .post { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
    .auth-tag {
      font-size: 0.65rem;
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }
    .public-tag {
      font-size: 0.65rem;
      color: #10b981;
      background: rgba(16, 185, 129, 0.1);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      color: #64748b;
    }
    .footer a {
      color: #38bdf8;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.15s;
    }
    .footer a:hover {
      color: #7dd3fc;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">
        <div class="logo-badge">⚡</div>
        <div>
          <div class="title">EchoForge</div>
          <div class="subtitle">Metrology Bridge Server</div>
        </div>
      </div>
      <div class="status-pill">
        <span class="status-dot"></span>
        OPERATIONAL
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <span>Protocol</span>
        <strong>MCP 2025-11-25</strong>
      </div>
      <div class="info-box">
        <span>Transport</span>
        <strong>Streamable HTTP</strong>
      </div>
    </div>

    <div class="endpoints">
      <h3>Exposed Endpoints</h3>
      <div class="endpoint-item">
        <span><span class="method get">GET</span> /health</span>
        <span class="public-tag">PUBLIC</span>
      </div>
      <div class="endpoint-item">
        <span><span class="method post">POST</span> /mcp</span>
        <span class="auth-tag">BEARER AUTH</span>
      </div>
      <div class="endpoint-item">
        <span><span class="method post">POST</span> /query</span>
        <span class="auth-tag">BEARER AUTH</span>
      </div>
      <div class="endpoint-item">
        <span><span class="method post">POST</span> /repair</span>
        <span class="auth-tag">BEARER AUTH</span>
      </div>
    </div>

    <div class="footer">
      <span>EchoForge Industrial Metrology Agent</span>
      <a href="https://echoforge.aenox.me" target="_blank" rel="noreferrer">Open Dashboard &rarr;</a>
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html_content, status_code=200)

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

# Restrict accepted public hostnames and browser origins while keeping MCP DNS rebinding
# protection enabled. The reverse proxy's public Host header must be allowlisted.
security = TransportSecuritySettings(
    enable_dns_rebinding_protection=True,
    allowed_hosts=MCPRequestSecurityMiddleware._env_list(
        "MCP_ALLOWED_HOSTS",
        [
            "echoforge-mcp.onrender.com",
            "echoforge-mcp.onrender.com:*",
            "localhost:*",
            "127.0.0.1:*",
            "testserver",
        ],
    ),
    allowed_origins=MCPRequestSecurityMiddleware._env_list(
        "MCP_ALLOWED_ORIGINS",
        [
            "https://echoforge.aenox.me",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
    ),
)
app = mcp.streamable_http_app(streamable_http_path="/mcp", transport_security=security)
app.add_middleware(MCPRequestSecurityMiddleware)

if __name__ == "__main__":
    t = threading.Thread(target=generate_dummy_dmo, daemon=True)
    t.start()
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
