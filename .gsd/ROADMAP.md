# Hackathon Roadmap: EchoForge

## Phase 1: The Local Edge (COMPLETED)
**Objective:** Build and test the local Python MCP server and logic.
*   [x] Initialize GitHub Monorepo.
*   [x] Write Python MCP Server (`MCPServer`) with `query_dmo_deviation` tool.
*   [x] Create test data (`happy_path.dmo`, `malformed.dmo`).
*   [x] Write and pass robust logic tests.
*   [x] Push to GitHub.

## Phase 2: Deployment (COMPLETED)
**Objective:** Get the MCP server live on the internet.
*   [x] Connect the GitHub repo to Render.com.
*   [x] Deploy the MCP server via the `render.yaml` blueprint.
*   [x] Verify the public Render URL and endpoints (`/sse`, `/messages`, `/query`, `/repair`).
*   [x] Implement the background data-generator thread on the Render server.

## Phase 3: The Cloud Brain (AWS Bedrock AgentCore)
**Objective:** Configure AWS AgentCore to use the MCP Server in production.
*   [x] Create an Amazon Bedrock AgentCore Harness (`EchoForgeHarnessV9` with `nova-pro-v1:0`).
*   [x] Configure AgentCore Gateway (`echoforgegateway-gbu5h7w7f2`) and S3 OpenAPI schema target.
*   [ ] Re-authenticate AWS CLI (`aws login` for `lucian24`).
*   [ ] Register repair tool in Gateway schema so Bedrock orchestrates both tools natively.
*   [ ] Verify end-to-end multi-turn conversation via CLI harness test script.

## Phase 4: Production Voice & 3D Industrial Dashboard
**Objective:** Replace prototype with enterprise-grade Alexa+ Simulation Web App.
*   [x] Scaffold Next.js 15+ App Router web app.
*   [ ] Implement resilient Voice Intake (replaces Chrome Web Speech API chunking issue; Issue #2).
*   [ ] Restore interactive 3D CAD Digital Twin component with dynamic tolerance shaders (Issue #1).
*   [ ] Full industrial redesign of telemetry dashboard (Issue #1).
*   [ ] Remove temporary bypass in `POST /api/agent` route (Issue #3).

## Phase 5: Production Deployment & Hackathon Submission
**Objective:** Deploy to AWS production environment, record demo video, and finalize.
*   [ ] Deploy frontend to AWS (CloudFront / Amplify / ECS).
*   [ ] Capture empirical verification logs and end-to-end latency benchmarks.
*   [ ] Record 3-minute executive demo video showing voice query, Bedrock reasoning, live MCP sensor response, and 3D twin real-time tolerance highlight.
*   [ ] Finalize GitHub `README.md` with architectural diagrams and runbooks.
*   [ ] Submit project to Devpost for Alexa+ and AWS Builder tracks.
