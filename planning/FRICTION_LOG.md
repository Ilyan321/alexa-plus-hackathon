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
  3. Added a clean-up sanitizer regex to guarantee zero raw action strings escape to the operator.
- **Feedback for AWS Team**: In Bedrock AgentCore, provide first-class tool calling event blocks in the stream (similar to standard Bedrock Converse API `toolUse` content blocks) rather than blending action strings directly into `contentBlockDelta.delta.text`.

---

### Entry 3: Multi-Turn Context Race Condition (Stale Parameter Hijacking)
- **Area**: Agentic Multi-Turn Memory & Edge Metrology Tool Execution
- **Symptoms**: If an operator first asked *"Inspect UPPER_FLANGE"*, followed by *"Check MAIN_BORE_HOLE"*, Nova Pro's tool call JSON retained `UPPER_FLANGE` from the prior turn, querying the wrong physical part on the factory floor.
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

## 📋 Hackathon Product Feedback Form Answers (Submission Item #7)

### 1. Which developer tools, APIs, and SDKs did you use and for what?
- **AWS Bedrock AgentCore SDK (`@aws-sdk/client-bedrock-agentcore`)**: Orchestrated multi-turn agentic workflows and invoked Amazon Nova Pro.
- **Amazon Nova Pro**: Multi-modal reasoning engine for interpreting metrology tolerance breaches and generating CNC remediation procedures.
- **Model Context Protocol (MCP) Python SDK**: Built a self-hosted Streamable HTTP (2025-11-25 spec) edge bridge interfacing with factory CMM `.DMO` inspection files.
- **AWS Amplify (Hosting)**: Deployed the Next.js 14 SSR frontend with continuous GitHub branch deployment and custom domain routing.

### 2. What worked well?
- **Amazon Nova Pro Reasoning**: Extremely strong at technical metrology math—calculating tolerance deltas in fractions of a micron and prescribing accurate industrial machining operations (e.g. EDM spark erosion, diamond honing, carbide re-milling).
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
**Yes, absolutely.** The combination of Amazon Nova Pro's low latency and Bedrock AgentCore's multi-turn session persistence makes it viable for high-stakes industrial environments where accuracy and speed are safety-critical.
