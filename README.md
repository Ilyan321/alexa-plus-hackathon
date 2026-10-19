# EchoForge 🛠️
> **Autonomous Hands-Free Edge Metrology AI Assistant for Aerospace Manufacturing**  
> *Submission for the Amazon Developer Hackathon: Build, Ship, Shape (2026)*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Track: Alexa+](https://img.shields.io/badge/Track-Alexa%2B-blue)](https://developer.amazon.com)
[![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock%20AgentCore%20(Nova%20Pro)-orange)](https://aws.amazon.com/bedrock/)
[![MCP Spec](https://img.shields.io/badge/MCP%20Spec-2025--11--25%20Streamable%20HTTP-success)](https://modelcontextprotocol.io)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-echoforge.aenox.me-brightgreen)](https://echoforge.aenox.me)
[![Friction Log](https://img.shields.io/badge/Amazon%20Dev%20Bonus-Friction%20Log%20Included-purple)](planning/FRICTION_LOG.md)

---

## 🚀 Demo & Deployment Status
- **Web App / Simulated Alexa+ Console**: [https://echoforge.aenox.me](https://echoforge.aenox.me)
- **Live Edge MCP Server (Render)**: [https://echoforge-mcp-fresh.onrender.com](https://echoforge-mcp-fresh.onrender.com)
  - Health check: `GET https://echoforge-mcp-fresh.onrender.com/health`
  - Streamable HTTP MCP Endpoint: `POST https://echoforge-mcp-fresh.onrender.com/mcp` (requires the server-side bearer token)
- **Remediation branch**: `audit/echo-forge-remediation` — security changes are implemented and pushed; deployment verification is pending.
- **Primary Hackathon Track**: **Alexa+** (Self-Hosted Streamable HTTP MCP Server & Simulated Alexa+ Interface)
- **Mini-Challenges Entered**:
  1. **AWS Builder**: AWS Bedrock AgentCore (Amazon Nova Pro), AWS Amplify SSR, IAM Security Policies.
  2. **Open Source**: MIT Licensed repository with open-source MCP metrology bridge (see [Open Source Submission Details](planning/OPEN_SOURCE_SUBMISSION.md)).

---

## 🎯 The Problem & Our Solution
In high-precision aerospace manufacturing (turbine blades, engine flanges, casing bosses), coordinate-measuring machines (CMM) output complex legacy inspection files (e.g. `.DMO` / DMIS files) measured in fractions of a micron ($0.0001\text{ mm}$).

Cleanroom CNC machinists wearing protective gloves and face shields cannot operate keyboards or touchscreens while handling delicate components. 

**EchoForge** bridges this gap:
1. **Hands-Free Ambient Alexa+ Voice UX**: High-res speech recognition with hands-free loop and real-time **barge-in wake word detection** ("Echo", "Alexa", "Stop", "Cancel").
2. **Bedrock AgentCore Intelligence**: Powered by Amazon Nova Pro to interpret tolerance zones and explain metrology readings.
3. **MCP Metrology Bridge**: Implements the **MCP 2025-11-25 Streamable HTTP transport** (`/mcp`) to read simulated `.DMO` inspection data and return measurements and tolerance context.
4. **Dynamic Speech Synthesis**: Browser voice synthesis reads the assistant's metrology summary aloud.

EchoForge is a hackathon prototype using simulated inspection data. It is not a machine-control system. Its repair tool returns a review notice and does not provide CNC settings. End-to-end model output is still being hardened; do not use generated output as a manufacturing work instruction.

---

## 🏗️ Architecture

```mermaid
flowchart LR
    A["Operator Voice / UI<br/>(Alexa+ / Web)"] -->|"Speech Input / Prompt"| B["Next.js 14 Dashboard<br/>(echoforge.aenox.me)"]
    B -->|"Autonomous Tool Orchestration"| C["AWS Bedrock AgentCore<br/>(Nova Pro Harness)"]
    C <-->|"Streamable HTTP (2025-11-25)<br/>or REST Fallback"| D["EchoForge MCP Server<br/>(Render Edge Node)"]
    D <-->|"Ingests & Parses"| E[("Legacy .DMO Factory<br/>Inspection Data")]
    C -->|"Metrology Summary & Review Notice"| B
    B -->|"Phonetic Voice Synthesis + Barge-in"| A
```

---

## ⚙️ Supported Aerospace Metrology Features

| Inspection Feature | Nominal Dimension | Tolerance Zone | System Response |
| :--- | :--- | :--- | :--- |
| `UPPER_FLANGE` | $50.000\text{ mm}$ | $\pm 2.0\text{ µm}$ | Reports simulated reading and tolerance status |
| `MAIN_BORE_HOLE` | $15.000\text{ mm}$ | $\pm 0.1\text{ µm}$ | Reports simulated reading and tolerance status |
| `TURBINE_BLADE_ROOT` | $32.500\text{ mm}$ | $\pm 1.5\text{ µm}$ | Reports simulated reading and tolerance status |
| `INLET_NOZZLE_RING` | $78.200\text{ mm}$ | $\pm 2.5\text{ µm}$ | Reports simulated reading and tolerance status |
| `EXHAUST_STATOR_BOSS` | $24.000\text{ mm}$ | $\pm 1.8\text{ µm}$ | Reports simulated reading and tolerance status |

---

## 📂 Repository Structure

```
.
├── frontend-dashboard/       # Next.js 14 App Router UI & AWS Bedrock AgentCore API
│   ├── src/app/
│   │   ├── api/agent/        # AgentCore InvokeHarnessCommand & MCP tool interceptor
│   │   ├── page.tsx          # Hands-free voice interface, barge-in wake word & dynamic TTS
│   │   └── globals.css       # TailwindCSS styling & responsive layout
│   └── package.json
├── mcp-server/               # Self-hosted MCP Server (MCP Spec 2025-11-25)
│   ├── server.py             # Streamable HTTP (/mcp), SSE (/sse), and REST endpoints
│   ├── factory_data/         # Live CMM .DMO simulated telemetry
│   ├── test_streamable_http.py # Automated test suite for MCP Spec 2025-11-25
│   └── requirements.txt      # Python dependencies (mcp, starlette, uvicorn)
├── planning/                 # Architecture, submission checklists, & friction logs
│   ├── HACKATHON_REQUIREMENTS.md
│   └── hackathon_overview.md
├── LICENSE                   # Open-source MIT License
└── README.md                 # Project documentation
```

---

## 🧪 Local Quickstart & Testing

> 📖 **Looking for a detailed step-by-step developer walkthrough?** See the full [Local Setup & Troubleshooting Guide](docs/SETUP.md).

### 1. Edge MCP Server (Python 3.12+)
```bash
cd mcp-server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run the MCP transport and security regression checks
python test_streamable_http.py
python -m unittest test_security.py test_mcp_logic.py

# Launch local server (default: port 8000)
python server.py
```

### 2. Frontend Dashboard (Next.js 14)
```bash
cd frontend-dashboard
npm install

# Configure environment variables (.env.local)
# APP_AWS_REGION=us-east-1
# APP_AWS_ACCESS_KEY_ID=your_access_key
# APP_AWS_SECRET_ACCESS_KEY=your_secret_key

npm run dev
# Open http://localhost:3000 in your browser
```

---

## ⚡ Service Health Check

The health route is public; the MCP and tool routes require a bearer token configured only on the server:
```bash
curl -s https://echoforge-mcp-fresh.onrender.com/health
```
**Expected Response:**
```json
{
  "status": "healthy",
  "service": "EchoForge Metrology Bridge",
  "mcp_protocol_version": "2025-11-25",
  "transports": ["streamable-http (/mcp)", "sse (/sse)"]
}
```

The MCP service accepts public metrology queries without an `MCP_AUTH_TOKEN`. The agent API still needs user authentication and production abuse controls; see the [remediation friction log](planning/FRICTION_LOG.md).

---

## 📄 License
This project is open-source and released under the terms of the [MIT License](LICENSE).
