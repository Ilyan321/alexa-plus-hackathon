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
        self.allowed_hosts = self._allowed_hosts()
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

    @classmethod
    def _allowed_hosts(cls) -> list[str]:
        hosts = cls._env_list(
            "MCP_ALLOWED_HOSTS",
            [
                "echoforge-mcp.onrender.com",
                "echoforge-mcp.onrender.com:*",
                "localhost:*",
                "127.0.0.1:*",
                "testserver",
            ],
        )
        render_hostname = os.environ.get("RENDER_EXTERNAL_HOSTNAME", "").strip()
        if render_hostname and render_hostname not in hosts:
            hosts.append(render_hostname)
        return hosts

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
        elif self.token:
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
        else:
            # Allow unauthenticated access for local development when no secret is configured.
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
  <title>EchoForge OS — Metrology Bridge</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Outfit', system-ui, -apple-system, sans-serif;
      background: #fffaf5;
      color: #7e2a0b;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      position: relative;
      overflow-x: hidden;
    }

    /* Ambient animated blobs matching EchoForge frontend */
    .blob {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
      opacity: 0.55;
      mix-blend-mode: multiply;
      z-index: 0;
    }
    .blob-1 {
      top: -10vw;
      left: -10vw;
      width: 45vw;
      height: 45vw;
      background: #ffd6b0;
      animation: float1 12s ease-in-out infinite alternate;
    }
    .blob-2 {
      top: 20%;
      right: -10vw;
      width: 40vw;
      height: 40vw;
      background: #ffb57a;
      animation: float2 14s ease-in-out infinite alternate;
    }
    .blob-3 {
      bottom: -15vw;
      left: 15vw;
      width: 50vw;
      height: 50vw;
      background: #ffeed9;
      animation: float3 16s ease-in-out infinite alternate;
    }

    @keyframes float1 { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(40px, 30px) scale(1.08); } }
    @keyframes float2 { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(-30px, 40px) scale(0.95); } }
    @keyframes float3 { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30px, -20px) scale(1.05); } }

    .card {
      position: relative;
      z-index: 10;
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 214, 176, 0.65);
      border-radius: 28px;
      max-width: 520px;
      width: 100%;
      padding: 2.25rem;
      box-shadow: 0 20px 45px -15px rgba(255, 107, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.9) inset;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.75rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid rgba(255, 214, 176, 0.5);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .sparkle-badge {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #ff6b00;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      box-shadow: 0 8px 18px -4px rgba(255, 107, 0, 0.45);
    }
    .title {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #7e2a0b;
      line-height: 1.15;
    }
    .subtitle {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #ff8a3d;
      margin-top: 2px;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.35rem 0.85rem;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #ffd6b0;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 600;
      color: #c73c00;
      box-shadow: 0 2px 8px -2px rgba(255, 107, 0, 0.15);
    }
    .status-dot-wrap {
      position: relative;
      display: flex;
      width: 8px;
      height: 8px;
    }
    .status-ping {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: #ff6b00;
      opacity: 0.75;
      animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    .status-dot {
      position: relative;
      width: 8px;
      height: 8px;
      background: #ff6b00;
      border-radius: 50%;
    }
    @keyframes ping {
      75%, 100% { transform: scale(2.2); opacity: 0; }
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .info-box {
      background: rgba(255, 250, 245, 0.85);
      border: 1px solid rgba(255, 214, 176, 0.6);
      border-radius: 16px;
      padding: 0.95rem 1rem;
    }
    .info-box span {
      display: block;
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      color: #ff8a3d;
      margin-bottom: 0.2rem;
    }
    .info-box strong {
      font-size: 0.88rem;
      color: #7e2a0b;
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }

    .endpoints {
      background: rgba(255, 250, 245, 0.7);
      border: 1px solid rgba(255, 214, 176, 0.55);
      border-radius: 18px;
      padding: 1.15rem;
      margin-bottom: 1.75rem;
    }
    .endpoints-title {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #ff8a3d;
      margin-bottom: 0.75rem;
    }
    .endpoint-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      font-size: 0.82rem;
      font-family: ui-monospace, monospace;
      border-bottom: 1px solid rgba(255, 214, 176, 0.35);
    }
    .endpoint-item:last-child { border-bottom: none; }
    .method {
      padding: 0.15rem 0.45rem;
      border-radius: 6px;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .get { background: rgba(59, 130, 246, 0.12); color: #2563eb; }
    .post { background: rgba(249, 115, 22, 0.15); color: #ea580c; }
    .auth-tag {
      font-size: 0.65rem;
      font-weight: 600;
      color: #c73c00;
      background: rgba(255, 107, 0, 0.1);
      border: 1px solid rgba(255, 107, 0, 0.2);
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
    }
    .public-tag {
      font-size: 0.65rem;
      font-weight: 600;
      color: #059669;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.25);
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
    }

    .cta-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.85rem 1.25rem;
      background: #ff6b00;
      color: #ffffff;
      text-decoration: none;
      font-size: 0.88rem;
      font-weight: 600;
      border-radius: 9999px;
      box-shadow: 0 10px 25px -6px rgba(255, 107, 0, 0.4);
      transition: all 0.2s ease;
    }
    .cta-btn:hover {
      background: #f05300;
      transform: translateY(-2px);
      box-shadow: 0 14px 28px -6px rgba(255, 107, 0, 0.5);
    }

    .footer {
      margin-top: 1.5rem;
      text-align: center;
      font-size: 0.72rem;
      color: #ff8a3d;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <!-- Ambient blobs from assistant_interface.html & EchoForge OS -->
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>

  <div class="card">
    <div class="header">
      <div class="brand">
        <div class="sparkle-badge">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
        </div>
        <div>
          <div class="title">EchoForge OS</div>
          <div class="subtitle">Live Metrology Edge Bridge</div>
        </div>
      </div>
      <div class="status-pill">
        <span class="status-dot-wrap">
          <span class="status-ping"></span>
          <span class="status-dot"></span>
        </span>
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
      <div class="endpoints-title">Exposed Service Routes</div>
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

    <a class="cta-btn" href="https://echoforge.aenox.me" target="_blank" rel="noreferrer">
      Launch Voice Dashboard
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
      </svg>
    </a>

    <div class="footer">
      AWS Bedrock AgentCore &middot; Hexagon CMM Inspection Bridge
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
    allowed_hosts=MCPRequestSecurityMiddleware._allowed_hosts(),
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
