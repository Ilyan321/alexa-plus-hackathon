# EchoForge Developer Friction Log & Product Feedback 📝
> **Amazon Developer Hackathon: Build, Ship, Shape (2026)**  
> **Track:** Alexa+ (Self-Hosted MCP & Simulated Ambient Interface)  
> **AWS Builder Mini Challenge:** AWS Bedrock AgentCore & Amazon Nova Pro  

---

## Executive Summary
This document fulfills the **Hackathon 10% Score Bonus** requirement and **Submission Requirement #7 (Product Feedback)**. It details authentic technical friction points encountered while integrating the **AWS Bedrock AgentCore SDK**, **Amazon Nova Pro**, **Model Context Protocol (MCP)**, and the **Simulated Ambient Alexa+ Interface**.

---

## 🔍 Detailed Friction Logs

### Entry 1: AWS Bedrock AgentCore `runtimeSessionId` Minimum Length Constraint
- **Area**: `@aws-sdk/client-bedrock-agentcore` (`InvokeHarnessCommand`)
- **Symptoms**: Invocations failed with generic HTTP 400 validation exceptions (`ValidationException: Invalid runtime session id format or length`).
- **Time Lost**: ~2.5 hours.
- **Root Cause**: The SDK TypeScript definitions indicate `runtimeSessionId: string`, but do not document the minimum length boundary ($\ge 33$ characters). Standard short IDs or simple integers fail validation immediately.
- **Workaround/Fix**:
  ```typescript
  // Enforce session IDs >= 33 characters
  const currentSessionId: string = sessionId || (uuidv4() + '-1');
  ```
- **Feedback for AWS Team**: Please document the regex or string length validation constraint in both the AWS Bedrock AgentCore SDK documentation and JSDoc comments.

---

### Entry 2: Autonomous Tool Interception Artifacts Leaking into Output Streams
- **Area**: Amazon Nova Pro Tool Intent Generation & AgentCore Harness
- **Symptoms**: When the model decided to query the edge MCP server, raw internal harness action markers (e.g. `Action: RenderServerTarget___queryDeviation`, `Input: {"feature_name": "UPPER_FLANGE"}`) streamed directly into the client response, polluting both the UI text card and the browser voice synthesizer.
- **Time Lost**: ~3 hours.
- **Root Cause**: The model streamed intermediate thought/action tokens directly into the primary content blocks before a client-side execution loop could intercept them.
- **Workaround/Fix**:
  1. Built regex interceptors in `frontend-dashboard/src/app/api/agent/route.ts` detecting `RenderServerTarget___` and `queryDeviation`/`getRepairProcedure`.
  2. Bypassed direct stream output when tool intent is identified, fetched live data from the edge MCP endpoint, and performed a second-pass synthesis with the Bedrock Harness.
  3. Added output sanitization for known raw action string patterns before returning a response.
- **Feedback for AWS Team**: In Bedrock AgentCore, provide first-class tool calling event blocks in the stream (similar to standard Bedrock Converse API `toolUse` content blocks) rather than blending action strings directly into `contentBlockDelta.delta.text`.

---

### Entry 3: Multi-Turn Context Race Condition (Stale Parameter Hijacking)
- **Area**: Agentic Multi-Turn Memory & Edge Metrology Tool Execution
- **Symptoms**: In simulated multi-turn tests, if an operator first asked *"Inspect UPPER_FLANGE"*, followed by *"Check MAIN_BORE_HOLE"*, Nova Pro's tool call JSON could retain `UPPER_FLANGE` from the prior turn and query the wrong simulated feature.
- **Time Lost**: ~2 hours.
- **Root Cause**: In multi-turn chat memory, previously grounded entities had higher attention weight than subtle follow-up pronouns or rapid command changes.
- **Workaround/Fix**:
  Implemented prompt-priority entity extraction in the Next.js orchestration layer:
  ```typescript
  // Prioritize immediate user voice prompt over multi-turn memory artifacts
  const featureFromPrompt = prompt.match(/\b(UPPER_FLANGE|MAIN_BORE_HOLE|TURBINE_BLADE_ROOT|INLET_NOZZLE_RING|EXHAUST_STATOR_BOSS)\b/i);
  let feature = (featureFromPrompt?.[1] || featureFromJson?.[1] || 'UPPER_FLANGE').toUpperCase();
  ```
- **Feedback for AWS Team**: Provide a way in AgentCore harnesses to assign explicit recency weighting to entities extracted in the latest turn versus historical turns.

---

### Entry 4: Browser Speech Synthesis Spelling Technical Acronyms
- **Area**: Ambient Alexa+ Voice UX (`SpeechSynthesisUtterance`)
- **Symptoms**: Browser TTS spelled uppercase industrial codes and units as individual characters: *"U-P-P-E-R F-L-A-N-G-E"*, *"m-m"*, and *"u-m"*.
- **Time Lost**: ~1.5 hours.
- **Root Cause**: Standard text-to-speech synthesizers default to acronym spelling for screaming-snake-case strings and metric shorthand.
- **Workaround/Fix**:
  Created `formatAgentCoreSpokenText` in `page.tsx`:
  - Translates `µm` $\rightarrow$ *"microns"*, `mm` $\rightarrow$ *"millimeters"*, `M24` $\rightarrow$ *"M 24"*.
  - Transforms underscore part names to title case (*"Upper Flange"*).
  - Explicitly protects spoken acronyms that *should* be spaced (*"C N C"*, *"R P M"*, *"C M M"*).
  - Strips raw code blocks (e.g. G-code coordinates) so voice synthesis remains fluid and conversational.

---

### Entry 5: Barge-in Wake Word Detection vs. TTS Completion State Collisions
- **Area**: Hands-Free Voice UX & Audio Interruption
- **Symptoms**: When an operator uttered *"Echo"* or *"Alexa"* while the assistant was speaking, calling `window.speechSynthesis.cancel()` abruptly fired the `utterance.onend` event, creating race conditions where audio input restarted while cancel was still terminating.
- **Time Lost**: ~2 hours.
- **Root Cause**: Web Speech API specification does not differentiate cleanly between an utterance naturally finishing vs. being canceled programmatically.
- **Workaround/Fix**:
  Added an atomic `isAssistantSpeakingRef` guard with cancellation tracking:
  ```typescript
  const interruptAssistantSpeaking = () => {
    isAssistantSpeakingRef.current = false;
    window.speechSynthesis.cancel();
  };
  ```

---

### Entry 6: MCP Specification Evolution: Legacy SSE vs. Streamable HTTP (2025-11-25)
- **Area**: Self-Hosted MCP Server (`mcp` Python SDK)
- **Symptoms**: Most public guides and reference servers only show legacy SSE (`/sse` + `/messages`), whereas the Amazon Alexa+ hackathon rules strictly mandate the newer Streamable HTTP standard (Spec version `2025-11-25`).
- **Time Lost**: ~2.5 hours.
- **Root Cause**: Rapid evolution of the MCP specification in late 2025 / early 2026.
- **Workaround/Fix**:
  - Re-architected `mcp-server/server.py` to use `mcp.streamable_http_app(streamable_http_path="/mcp")`.
  - Configured custom Starlette routes to maintain simultaneous backwards compatibility with legacy SSE (`/sse`) and internal REST routes (`/query`, `/repair`, `/health`).
  - Added an automated compliance test suite (`test_streamable_http.py`) verifying `mcp-protocol-version: 2025-11-25`.

---

### Entry 7: Public MCP Routes Had No Service Authentication
- **Area**: EchoForge MCP server (`/mcp`, `/sse`, `/messages`, `/query`, `/repair`)
- **Symptoms**: Tool and REST routes could be called without a credential, and the server relied on implicit Host and Origin protections.
- **Severity**: High
- **Root Cause**: The initial demo prioritized connectivity and protocol bring-up; authentication and explicit request-origin boundaries were absent from the first deployment design.
- **Fix**: Added server-side Bearer token validation with constant-time comparison, explicit Host and Origin allowlists, DNS rebinding protection, and regression tests. `/health` remains public for health checks. The frontend forwards the token only from its server route.
- **Verification**: Frontend lint and production build pass. Python source compiles. Python security and MCP tests are written but could not run in the audit environment because the `mcp` package was unavailable.
- **Remaining Work**: Configure matching secrets in Render and the frontend host, deploy the branch, and verify protected endpoints live. Deployment has not yet been verified.
- **Actionable Suggestion for Amazon Team**: Include authenticated MCP endpoint examples and explicit Host/Origin guidance in cloud deployment quickstarts.

### Entry 8: Simulated Repair Data Looked Like Machine-Ready CNC Instructions
- **Area**: Metrology repair tool and product documentation
- **Symptoms**: The repair tool and README described specific machining operations and settings despite using simulated readings without a validated manufacturing process.
- **Severity**: Critical
- **Root Cause**: Demo copy blurred the boundary between a simulated tolerance explanation and an approved engineering work instruction.
- **Fix**: Removed generated machine settings from the MCP repair tool. It validates the feature and finite deviation, reports tolerance status, and directs out-of-tolerance cases to qualified engineering review. Updated the README to remove operational CNC claims and label the product as a prototype.
- **Verification**: Added regression tests for the simulation warning and absence of sample machine settings. Tests are present but await execution where Python dependencies are installed.
- **Remaining Work**: Review the full AgentCore response path to ensure the model cannot produce operational machine instructions outside the MCP repair tool. A safe tool response alone does not establish end-to-end output safety.
- **Actionable Suggestion for Amazon Team**: Provide evaluation guidance for safety boundaries in agentic applications that summarize industrial or simulated data.

### Entry 9: Public Agent Route Had Unbounded Requests and Exposed Upstream Errors
- **Area**: Next.js `/api/agent` and Bedrock AgentCore invocation
- **Symptoms**: The route accepted oversized prompts and arbitrary session IDs, had no explicit invocation budgets, returned raw upstream exception details, and could trigger paid inference without user sign-in.
- **Severity**: High
- **Fix**: Added a 16 KiB request-body cap, a 4,000-character prompt limit, session-ID format validation, per-invocation iteration/token/time bounds, and generic client-facing errors. MCP calls now use a server-held token.
- **Verification**: Frontend lint and production build pass. The installed SDK types support the configured `maxIterations`, `maxTokens`, and `timeoutSeconds` fields.
- **Remaining Work**: Add user authentication and production-grade abuse controls before treating the endpoint as protected from unauthorized inference spend. The route remains publicly callable.
- **Actionable Suggestion for Amazon Team**: Surface cost and iteration controls in AgentCore examples and document recommended authentication patterns for public web clients.

### Entry 10: Audit Verification Exposed Tooling Gaps
- **Area**: Frontend lint setup and Python test environment
- **Symptoms**: The ESLint flat config did not match the installed Next.js 14 lint setup. Python tests could not import the server because the audit environment lacked the `mcp` dependency.
- **Severity**: Medium
- **Fix**: Restored the Next.js-compatible ESLint configuration and lint command; added security-focused Python regression cases and corrected stale MCP test assertions.
- **Verification**: `npm run lint`, `npm run build`, Python bytecode compilation, and `git diff --check` pass. Python unit and integration tests remain unverified until dependencies are installed.
- **Actionable Suggestion for Amazon Team**: Publish reproducible test setup and dependency guidance alongside cloud SDK and agent examples.

## 📋 Hackathon Product Feedback Form Answers (Submission Item #7)

### 1. Which developer tools, APIs, and SDKs did you use and for what?
- **AWS Bedrock AgentCore SDK (`@aws-sdk/client-bedrock-agentcore`)**: Orchestrated multi-turn agentic workflows and invoked Amazon Nova Pro.
- **Amazon Nova Pro**: Multi-modal reasoning engine for interpreting metrology readings and explaining tolerance status.
- **Model Context Protocol (MCP) Python SDK**: Built a self-hosted Streamable HTTP (2025-11-25 spec) edge bridge interfacing with factory CMM `.DMO` inspection files.
- **AWS Amplify (Hosting)**: Deployed the Next.js 14 SSR frontend with continuous GitHub branch deployment and custom domain routing.

### 2. What worked well?
- **Amazon Nova Pro Reasoning**: Useful for turning metrology readings into concise operator-facing explanations. This prototype treats readings as simulated and routes repair decisions to qualified engineering review rather than presenting model output as a machine-ready instruction.
- **Streamable HTTP MCP Architecture**: Unifying the transport over standard HTTP POST with JSON-RPC streaming eliminated the messy bi-directional SSE port multiplexing issues.
- **AWS Amplify Next.js Support**: Automatic detection and zero-config deployment of Next.js 14 App Router SSR serverless functions.

### 3. What needs work?
- **Bedrock AgentCore SDK Documentation**: Missing specifications for parameter validation (e.g., minimum session ID string length) and clearer examples of streaming content block payloads.
- **MCP Streamable HTTP Examples**: Upstream MCP documentation still heavily features standard I/O (stdio) and SSE, with relatively few live production examples of Streamable HTTP implementations behind cloud proxies.
- **Streaming Tool Events**: Bedrock AgentCore should cleanly emit `toolUse` structures in streaming responses rather than passing them through raw assistant text.

### 4. How was your onboarding experience?
- Getting to "Hello World" with Nova Pro on Bedrock was smooth via the AWS Console.
- Integrating AgentCore programmatically required deep-diving into raw SDK source definitions due to sparse documentation around custom harness schemas and session parameters.

### 5. Would you build with these devices and services again?
**Yes.** Amazon Nova Pro and Bedrock AgentCore are promising for a hands-free metrology prototype. Further authentication, end-to-end output safety, and deployment verification are required before considering use in a real manufacturing environment.
