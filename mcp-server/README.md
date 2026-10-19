# EchoForge MCP Server 🏭

> **Industrial Edge Metrology Bridge — MCP Spec 2025-11-25 (Streamable HTTP)**  
> A self-hosted Python MCP server that parses legacy aerospace `.DMO` inspection files and exposes them as AI-callable tools  
> Part of [EchoForge Hackathon Submission](https://github.com/Ilyan321/alexa-plus-hackathon)

[![MCP Spec](https://img.shields.io/badge/MCP%20Spec-2025--11--25%20Streamable%20HTTP-success)](https://modelcontextprotocol.io)
[![Live Server](https://img.shields.io/badge/Live%20Server-echoforge--mcp.onrender.com-blue)](https://echoforge-mcp.onrender.com)

---

## What this is

This is the **Python MCP edge bridge** for EchoForge. It:

- Implements the official **Model Context Protocol (MCP) Spec 2025-11-25** over **Streamable HTTP** at `/mcp`
- Maintains backwards-compatible **Server-Sent Events (SSE)** at `/sse` and direct **REST endpoints** at `/query`, `/repair`, `/health`
- Parses live legacy aerospace **`.DMO` (DMIS format)** inspection files from a Coordinate Measuring Machine (CMM)
- Exposes two AI-callable tools to AWS Bedrock AgentCore:
  - `query_dmo_deviation` — returns the live measured deviation vs. tolerance for a named part feature
  - `get_repair_procedure` — returns a non-operational review notice for simulated readings

### Supported Aerospace Features

| Feature | Nominal | Tolerance |
|---------|---------|-----------|
| `UPPER_FLANGE` | 50.000 mm | ±2.0 µm |
| `MAIN_BORE_HOLE` | 15.000 mm | ±0.1 µm |
| `TURBINE_BLADE_ROOT` | 32.500 mm | ±1.5 µm |
| `INLET_NOZZLE_RING` | 78.200 mm | ±2.5 µm |
| `EXHAUST_STATOR_BOSS` | 24.000 mm | ±1.8 µm |

---

## Quick Start

### Prerequisites
- Python `3.10+` (`3.12` recommended)
- `pip`

### 1. Create virtual environment
```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Run compliance test suite
Verify MCP 2025-11-25 Streamable HTTP compliance before starting:
```bash
python test_streamable_http.py
python test_security.py
```

Expected output:
```
✓ PASS: /health reports MCP 2025-11-25 support
✓ PASS: Existing /query backwards compatibility intact
✓ PASS: Existing /repair backwards compatibility intact
✓ PASS: Streamable HTTP initialize successful
✓ PASS: Streamable HTTP tools/list verified
✓ PASS: Streamable HTTP tools/call verified

ALL MCP STREAMABLE HTTP VERIFICATION TESTS PASSED!
```

### 4. Start the server
```bash
export MCP_AUTH_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
python server.py
# Listening on http://localhost:8000
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | `GET` | Health check — returns MCP version and transport info |
| `/mcp` | `POST` | **MCP 2025-11-25 Streamable HTTP** — primary AI agent endpoint |
| `/sse` | `GET` | Legacy Server-Sent Events transport (backwards compat) |
| `/query` | `POST` | REST: query deviation for a named feature |
| `/repair` | `POST` | REST: get CNC repair procedure for a deviation |

All routes except `/health` require `Authorization: Bearer $MCP_AUTH_TOKEN`. Set the same server-only `MCP_AUTH_TOKEN` in the Next.js host so its server-side requests can authenticate. Never expose it through a `NEXT_PUBLIC_` variable. `MCP_ALLOWED_HOSTS` and `MCP_ALLOWED_ORIGINS` can override the default allowlists.

### Example: Health Check
```bash
curl -s https://echoforge-mcp.onrender.com/health
```
```json
{
  "status": "healthy",
  "service": "EchoForge Metrology Bridge",
  "mcp_protocol_version": "2025-11-25",
  "transports": ["streamable-http (/mcp)", "sse (/sse)"]
}
```

### Example: Query Deviation
```bash
curl -s -X POST https://echoforge-mcp.onrender.com/query \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
     -d '{"feature_name": "UPPER_FLANGE"}'
```

### Example: Get Repair Procedure
```bash
curl -s -X POST https://echoforge-mcp.onrender.com/repair \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
     -d '{"feature_name": "TURBINE_BLADE_ROOT", "deviation_microns": 1.687}'
```

---

## Live Deployment

The production MCP server is deployed on **Render**:

🌐 **https://echoforge-mcp.onrender.com**

Deployment is configured via [`render.yaml`](./render.yaml).

---

## File Structure

```
mcp-server/
├── server.py                   # Main MCP server (Streamable HTTP + SSE + REST)
├── mock_factory.py             # Background thread writing simulated .DMO telemetry
├── factory_data/
│   └── inspection_latest.dmo  # Live CMM inspection data (updated by mock_factory.py)
├── test_data/
│   ├── happy_path.dmo          # Valid DMO fixture for unit tests
│   └── malformed.dmo           # Malformed DMO fixture for error handling tests
├── test_streamable_http.py     # MCP 2025-11-25 Streamable HTTP compliance tests
├── test_security.py            # Auth, host/origin, and safe repair tests
├── test_mcp_logic.py           # Unit tests for DMO parsing and tool logic
├── requirements.txt            # Python dependencies
└── render.yaml                 # Render deployment config
```

---

For the complete local setup guide, see [`../docs/SETUP.md`](../docs/SETUP.md).
