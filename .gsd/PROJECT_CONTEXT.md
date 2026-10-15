# EchoForge - Comprehensive Project Context & Operational Blueprint

> **Master Context File**: Retain and update across sessions. All team members, agents, and CI/CD pipelines can restore full operational state from this document.

---

## 1. System Vision & Architecture

**Project**: EchoForge — Industrial Voice-to-Edge Metrology Bridge  
**Target Tracks**: Amazon Developer Hackathon (Alexa+ Track & AWS Builder Challenge)  
**Production Goal**: Move from demo hack to robust, production-grade B2B industrial telemetry platform for aerospace manufacturing.

### High-Level Architecture

```
[ Operator Voice / Touch ]
         │
         ▼
[ Next.js 15+ Frontend ] (Alexa+ Voice Dashboard + 3D Digital Twin)
         │  (InvokeHarness API via AWS SDK)
         ▼
[ AWS Bedrock AgentCore Harness ] (Nova Pro / Claude 3.5 Sonnet)
         │  (AgentCore Gateway)
         ▼
[ AgentCore Gateway Target ] (OpenAPI Schema via S3)
         │  (SSE / HTTP REST)
         ▼
[ Edge MCP Server on Render ] (FastAPI/Starlette MCP Bridge)
         │  (File IO / Industrial Bus)
         ▼
[ Legacy Industrial Data (.DMO) ] (Aerospace Metrology Tolerances)
```

---

## 2. Infrastructure Inventory & Cloud Resources

### AWS Bedrock AgentCore & IAM (Selected Region: `us-east-1`)
* **AWS Profile**: `lucian24` (Configured in `~/.aws/config`, `.env.local`)
* **AWS Project / Account ID**: `152307755678`
* **AgentCore Harness ARN**: `arn:aws:bedrock-agentcore:us-east-1:152307755678:harness/EchoForgeHarnessV9-qjI7ySsTk3`
* **AgentCore Harness Execution Role**: `arn:aws:iam::152307755678:role/EchoForgeHarnessRole`
* **AgentCore Gateway ARN**: `arn:aws:bedrock-agentcore:us-east-1:152307755678:gateway/echoforgegateway-gbu5h7w7f2`
* **Gateway OpenAPI Schema S3 URI**: `s3://echoforge-schema-937f3aca-78ed-40a0-a436-6f58c4294221/openapi.json`
* **Model ID**: `us.amazon.nova-pro-v1:0` (Using `converse_stream` format to bypass Anthropic use-case restrictions)

### Edge Bridge / MCP Server (Render)
* **Base URL**: `https://echoforge-mcp.onrender.com`
* **SSE Endpoint**: `https://echoforge-mcp.onrender.com/sse`
* **Message Endpoint**: `https://echoforge-mcp.onrender.com/messages`
* **REST Endpoints**:
  * `POST /query`: Query feature deviation from live `.DMO` inspection file.
  * `POST /repair`: Retrieve CNC repair procedure for out-of-tolerance parts.
* **Local Repo Path**: `mcp-server/`

### Frontend Application
* **Framework**: Next.js 15.2.x (App Router), React 19, Tailwind CSS, Framer Motion
* **Directory**: `/home/ilyan/amazon/frontend-dashboard`
* **Local Port**: `http://localhost:3000`
* **API Route**: `frontend-dashboard/src/app/api/agent/route.ts`

---

## 3. Current System State & Honest Ground Truth

| Component | Status | Real Production Readiness |
|---|---|---|
| **Render MCP Server** | **LIVE** | Functional, but runs basic synthetic loop; needs robust auth tokens, health probes, and persistent storage. |
| **AWS Bedrock Harness** | **PROVISIONED** | Harness V9 connected to Gateway target. However, current local AWS CLI session (`lucian24`) is expired and requires `aws login`. |
| **API Integration** | **PARTIAL SHORTCUT** | `route.ts` sends metrology queries to Bedrock, but intercepts repair queries and calls Render REST endpoint directly. Needs consolidation into AgentCore tool calling. |
| **Voice Interface** | **DEGRADED** | Uses browser Web Speech API (`webkitSpeechRecognition`). Known issue: truncates speech, gets stuck on silence, drops initial/trailing syllables. |
| **3D Digital Twin** | **MISSING IN UI** | 3D Canvas was stripped out in commit `d7ee185` due to React 19 peer-dependency conflicts with `@react-three/fiber`. Must be restored using compatible Three.js or isolated canvas container. |
| **Frontend Design** | **PROTOTYPE** | Generic dark mode card interface; flagged by user for comprehensive industrial redesign. |

---

## 4. Run & Development Commands

### Re-authenticating AWS (Required when session expires)
```bash
aws login
# Verify caller identity:
aws sts get-caller-identity --profile lucian24
```

### Running MCP Server Locally
```bash
cd /home/ilyan/amazon/mcp-server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

### Running Frontend Locally
```bash
cd /home/ilyan/amazon/frontend-dashboard
npm run dev
```

### Testing Harness from CLI
```bash
python3 test_harness.py
```

---

## 5. Security & Production Deployment Standards

1. **Zero Secret Leakage**: No IAM secret keys, session tokens, or private endpoints in git. All `.env` and `.env.local` files must remain strictly in `.gitignore`.
2. **True Tool Orchestration**: No client-side bypasses. AgentCore must orchestrate both deviation checking and engineering remediation via registered tools.
3. **Graceful Degraded States**: The UI must handle network dropouts, MCP server cold starts, and AWS session expiry gracefully with clear operator feedback.
4. **Git Discipline**: Every task must be verified with empirical proof, committed with standard semantic format, and pushed immediately to GitHub remote (`origin/main`).
