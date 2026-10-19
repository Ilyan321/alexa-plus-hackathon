# EchoForge — Local Setup & Execution Guide 🛠️

This guide provides end-to-end instructions for running and verifying **EchoForge** locally on your workstation.

---

## 📋 System Prerequisites
- **Python**: Version `3.10` or higher (`3.12` recommended)
- **Node.js**: Version `18.x` or `20.x` LTS
- **Package Managers**: `npm` and `pip`
- **Browser**: Modern Chromium-based browser (Google Chrome, Microsoft Edge, Brave) with Web Speech API support for microphone input and SpeechSynthesis audio.
- **AWS Credentials**: AWS IAM credentials with permission to invoke Amazon Bedrock and AgentCore (`bedrock:InvokeModel`, `bedrock-agentcore:InvokeHarness`).

---

## 🚀 Component 1: Edge MCP Metrology Server

The MCP server acts as an edge gateway interfacing with factory CMM `.DMO` inspection files. It implements the official **Model Context Protocol (MCP Spec 2025-11-25 Streamable HTTP)** at `/mcp`, alongside backwards-compatible legacy SSE (`/sse`) and internal REST endpoints (`/query`, `/repair`, `/health`).

### 1. Navigate to directory & create virtual environment
```bash
cd mcp-server
python3 -m venv .venv
source .venv/bin/activate       # On Windows: .venv\Scripts\activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Run automated compliance test suite
Verify that the Streamable HTTP handshake, tool listing, tool invocation, and legacy REST endpoints operate as expected:
```bash
python test_streamable_http.py
python test_security.py
```
**Expected output:**
```text
✓ PASS: /health reports MCP 2025-11-25 support
✓ PASS: Existing /query backwards compatibility intact
✓ PASS: Existing /repair backwards compatibility intact
✓ PASS: Streamable HTTP initialize successful (session ID: ...)
✓ PASS: Streamable HTTP tools/list verified
✓ PASS: Streamable HTTP tools/call verified

ALL MCP STREAMABLE HTTP VERIFICATION TESTS PASSED!
```

### 4. Start the local server
```bash
python server.py
# Server starts on http://localhost:8000
```

### 5. Validate local endpoints via curl
```bash
# Health Check
curl -s http://localhost:8000/health

# Query live deviation for a part
curl -s -X POST http://localhost:8000/query \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
     -d '{"feature_name": "UPPER_FLANGE"}'

# Query CNC repair procedure
curl -s -X POST http://localhost:8000/repair \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
     -d '{"feature_name": "UPPER_FLANGE", "deviation_microns": 2.3}'
```

---

## 💻 Component 2: Frontend Dashboard & Alexa+ Interface

The frontend is a **Next.js 14 App Router** application that manages the ambient voice loop, wake word barge-in, dynamic speech synthesis, and autonomous tool calling via AWS Bedrock AgentCore.

### 1. Navigate to directory & install dependencies
```bash
cd frontend-dashboard
npm install
```

### 2. Configure environment variables
Create a `.env.local` file from the provided example:
```bash
cp .env.example .env.local
```
Open `.env.local` and add your AWS credentials:
```env
APP_AWS_REGION=us-east-1
APP_AWS_ACCESS_KEY_ID=AKIA...
APP_AWS_SECRET_ACCESS_KEY=...
```

### 3. Verify production build
Ensure there are no TypeScript or bundling issues:
```bash
npm run build
```

### 4. Start the development server
```bash
npm run dev
# Dashboard launches on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in Google Chrome or Microsoft Edge.

---

## 🎙️ Testing the Ambient Voice Interface

1. **Microphone Permissions**:
   - When visiting `http://localhost:3000`, grant the browser microphone access when prompted.
2. **Mode Selection**:
   - **Click-to-Speak**: Click the large central microphone button, speak your inquiry, then release or let the silence detector auto-submit.
   - **Continuous Hands-Free Mode**: Click the **"Hands-Free: OFF"** button in the header to switch it to **"ON"**. The system enters a persistent ambient loop.
3. **Sample Spoken Prompts**:
   - *"Query the live sensor deviation for UPPER_FLANGE."*
   - *"Is the TURBINE_BLADE_ROOT within tolerance?"*
   - *"What is the CNC repair procedure for MAIN_BORE_HOLE?"*
4. **Testing Barge-In Interruption**:
   - While the assistant is actively speaking, say **"Echo"**, **"Alexa"**, or **"Stop"**.
   - Speech synthesis will immediately silence, and the microphone will instantly open for your follow-up query.

---

## ❓ Troubleshooting & FAQs

### 1. `ValidationException: Invalid runtime session id format or length`
- **Cause**: Bedrock AgentCore harnesses mandate session IDs $\ge 33$ characters.
- **Fix**: The application automatically handles this via `uuidv4() + '-1'`. Ensure custom session IDs adhere to this constraint.

### 2. Microphone access denied or no recognition events
- **Cause**: Browser security policy prevents mic access on insecure HTTP (except for `localhost`).
- **Fix**: Run on `localhost` or over `https://`. Ensure Chrome permissions for `http://localhost:3000` allow Microphone.

### 3. Port 8000 or 3000 already in use
- **Fix (Python Server)**: `PORT=8001 python server.py`
- **Fix (Next.js Dashboard)**: `npm run dev -- -p 3001`
