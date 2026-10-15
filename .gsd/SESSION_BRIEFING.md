# EchoForge — Master Session Briefing
> **Read this first on any new session, any machine, any account.**
> Last updated: 2026-10-15 17:00 PKT

---

## 1. What This Project Is

**EchoForge** — Industrial Voice-to-Edge Metrology Bridge  
**Hackathon target:** Amazon Developer Hackathon (Alexa+ Track + AWS Builder Mini-Challenge)  
**GitHub repo:** https://github.com/Ilyan321/alexa-plus-hackathon  
**Local path:** `/home/ilyan/amazon`

An aerospace factory operator speaks a command → browser captures voice → Next.js sends it to AWS Bedrock AgentCore (Nova Pro) → AgentCore autonomously calls our MCP tools on Render to read live .DMO inspection files → returns deviation reading + CNC repair procedure → frontend speaks it back and highlights the status.

---

## 2. Full Architecture

```
Browser (voice + 3D UI)
  │  POST /api/agent
  ▼
Next.js 15 API Route (frontend-dashboard/src/app/api/agent/route.ts)
  │  InvokeHarnessCommand (AWS SDK)
  ▼
AWS Bedrock AgentCore Harness (Nova Pro)
  │  AgentCore Gateway (OpenAPI schema from S3)
  ▼
Render MCP Server (https://echoforge-mcp.onrender.com)
  │  File I/O
  ▼
.DMO Inspection Files (live cycling synthetic data)
```

---

## 3. All AWS Resource ARNs & IDs

| Resource | Value |
|---|---|
| **AWS Account ID** | `152307755678` |
| **AWS Profile name** | `lucian24` |
| **AWS Region** | `us-east-1` |
| **AgentCore Harness ID** | `EchoForgeHarnessV9-qjI7ySsTk3` |
| **AgentCore Harness ARN** | `arn:aws:bedrock-agentcore:us-east-1:152307755678:harness/EchoForgeHarnessV9-qjI7ySsTk3` |
| **Model** | `us.amazon.nova-pro-v1:0` (converse_stream) |
| **Execution Role ARN** | `arn:aws:iam::152307755678:role/EchoForgeHarnessRole` |
| **AgentCore Gateway ID** | `echoforgegateway-gbu5h7w7f2` |
| **AgentCore Gateway ARN** | `arn:aws:bedrock-agentcore:us-east-1:152307755678:gateway/echoforgegateway-gbu5h7w7f2` |
| **Gateway Target ID** | `76KBI7SYTK` (name: `RenderServerTarget`) |
| **OpenAPI Schema S3 Bucket** | `echoforge-schema-937f3aca-78ed-40a0-a436-6f58c4294221` |
| **OpenAPI Schema S3 URI** | `s3://echoforge-schema-937f3aca-78ed-40a0-a436-6f58c4294221/openapi.json` |
| **AgentCore Memory ARN** | `arn:aws:bedrock-agentcore:us-east-1:152307755678:memory/EchoForgeHarnessV9-JuE30THyM5` |
| **AgentCore Runtime ARN** | `arn:aws:bedrock-agentcore:us-east-1:152307755678:runtime/harness_EchoForgeHarnessV9-DMu3Nk9jsJ` |

---

## 4. External Services

| Service | URL | Purpose |
|---|---|---|
| **Render MCP Server** | `https://echoforge-mcp.onrender.com` | Live .DMO edge bridge |
| **Render `/query`** | POST `{"feature_name":"UPPER_FLANGE"}` | Returns deviation in microns |
| **Render `/repair`** | POST `{"feature_name":"UPPER_FLANGE","deviation_microns":2.1}` | Returns CNC repair procedure |
| **Render `/sse`** | GET | MCP SSE transport (used by Gateway) |

**Render data:** Synthetic .DMO file cycles every 60s between `1.800` (in-tolerance) and `2.100` (out-of-tolerance). The tolerance threshold is **2.0 microns**.

---

## 5. Current Harness System Prompt (verbatim)

```
You are EchoForge, a real-time industrial metrology AI assistant for aerospace manufacturing.
You have two tools connected via the echoforge_mcp gateway:

1. RenderServerTarget___queryDeviation: Call this with {"feature_name": "<FEATURE>"} to get the live deviation in microns from the factory .DMO inspection file.
2. RenderServerTarget___getRepairProcedure: Call this with {"feature_name": "<FEATURE>", "deviation_microns": <NUMBER>} to get the CNC repair procedure for a part that is out of tolerance.

IMPORTANT RULES:
- ALWAYS use your tools when the user asks about deviations or repairs. Never guess or make up values.
- The tolerance threshold is 2.0 microns. Deviations above 2.0 are out of tolerance and require repair.
- When a deviation is out of tolerance, first report the deviation, then immediately call RenderServerTarget___getRepairProcedure.
- Respond concisely and precisely like an industrial monitoring system.
```

---

## 6. Local Dev Environment

| Item | Value |
|---|---|
| **Frontend dir** | `/home/ilyan/amazon/frontend-dashboard` |
| **Python venv** | `/home/ilyan/amazon/.venv` |
| **AWS config** | `~/.aws/config` — profile `lucian24`, region `us-east-1` |
| **Frontend env** | `frontend-dashboard/.env.local` → `AWS_PROFILE=lucian24` |
| **Frontend port** | `http://localhost:3000` |

---

## 7. Phase Completion Status

| Phase | Status |
|---|---|
| Phase 1 — Python MCP Server + .DMO parser | ✅ **COMPLETE** |
| Phase 2 — Render deployment | ✅ **COMPLETE** |
| Phase 3 — AWS Bedrock AgentCore Harness + Gateway | ✅ **COMPLETE** |
| Phase 4 — Frontend: route.ts bypass removed, single AgentCore call, voice fixed, TTS | ✅ **COMPLETE** |
| Phase 5 — Production AWS deploy + demo video | 🔲 **NEXT** |

### Open Issues
- **Issue #1** (High): Frontend industrial redesign + 3D Digital Twin restoration (currently generic dark UI, 3D canvas was removed in commit `d7ee185` due to React 19 / @react-three/fiber peer conflict)
- **Issue #2** (Partial): Voice intake — improved (`continuous:false`, `en-US`, TTS added) but full Amazon Transcribe Streaming upgrade still in backlog

---

## 8. Commands to Resume Any Session

### Step 1: Authenticate AWS CLI
```bash
# If session is expired:
aws login --remote --profile lucian24
# Verify:
aws sts get-caller-identity --profile lucian24
```

### Step 2: Fix DNS if `aws login` page is blank (network-specific issue)
```bash
sudo resolvectl dns wlo1 1.1.1.1 1.0.0.1
# Then retry aws login --remote
```

### Step 3: Run the frontend locally
```bash
cd /home/ilyan/amazon/frontend-dashboard
npm run dev
# Open http://localhost:3000
```

### Step 4: Test the full Bedrock AgentCore E2E pipeline
```bash
cd /home/ilyan/amazon
.venv/bin/python test_harness.py
```
Expected output: Nova Pro calls `RenderServerTarget___queryDeviation`, returns live deviation, makes correct repair judgment.

### Step 5: Deploy frontend to AWS Amplify (NEXT TASK)
```bash
# Install Amplify CLI if not present
npm install -g @aws-amplify/cli
# Initialize and deploy
amplify init
amplify add hosting
amplify publish
```

---

## 9. What Each Key File Does

| File | Purpose |
|---|---|
| `mcp-server/server.py` | Render MCP server — .DMO reader + REST endpoints + background data generator |
| `mcp-server/render.yaml` | Render.com deploy config |
| `frontend-dashboard/src/app/api/agent/route.ts` | Next.js API — single `InvokeHarnessCommand` to AgentCore, typed stream drain |
| `frontend-dashboard/src/app/page.tsx` | Main UI — voice capture, single `callAgent()`, TTS, deviation status rendering |
| `frontend-dashboard/.env.local` | `AWS_PROFILE=lucian24` (gitignored — must be set manually on new machines) |
| `openapi.json` | OpenAPI schema defining `/query` and `/repair` tools for AgentCore Gateway |
| `test_harness.py` | CLI script to invoke Harness V9 directly and verify end-to-end tool orchestration |
| `create-harness-input-v9.json` | Input config used to create the Harness V9 via AWS CLI |
| `.gsd/ISSUES.md` | Issue tracker — frontend redesign, voice pipeline, architectural debt |
| `.gsd/ROADMAP.md` | Phase-by-phase build roadmap |

---

## 10. Git Log (Recent)

```
470f900  chore(state): update STATE.md — Phase 3+4 complete
06c48e8  fix(frontend): remove route.ts bypass, single AgentCore call, resilient voice intake, TTS
8c83f25  test(harness): verify full e2e autonomous dual-tool orchestration via AgentCore
4033b09  fix(tests): point test_harness.py to EchoForgeHarnessV9
019e5eb  chore(context): add master context, issue tracker, and infrastructure specs
d7ee185  refactor: Remove 3D R3F Canvas and fix Speech Recognition transcription bug
```

---

## 11. Next Session Execution Plan

1. **Deploy to AWS Amplify** — get a production HTTPS URL for the frontend. The Next.js API route authenticates via IAM execution role (no credentials in code).
2. **Issue #1** — Full industrial telemetry dashboard redesign + restore 3D Digital Twin (compatible Three.js approach, no @react-three/fiber).
3. **Record demo video** — voice query → AgentCore → live MCP data → 3D highlight → spoken response.
4. **Submit to Devpost** — Alexa+ and AWS Builder tracks.
