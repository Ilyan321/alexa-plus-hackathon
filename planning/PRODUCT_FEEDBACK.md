# Official Product Feedback Form (Submission Item #7) 📋
> **Amazon Developer Hackathon: Build, Ship, Shape (2026)**  
> **Project**: EchoForge — Autonomous Hands-Free Edge Metrology AI Assistant  
> **Track**: Alexa+ (Self-Hosted MCP & Simulated Interface)  
> **Mini-Challenges**: AWS Builder & Open Source  

---

## 1. Which developer tools, APIs, and SDKs did you use and for what?

1. **AWS Bedrock AgentCore SDK (`@aws-sdk/client-bedrock-agentcore`)**:
   - Used `InvokeHarnessCommand` to execute multi-turn, stateful agentic workflows connecting our Next.js edge router to custom Bedrock AgentCore harnesses.
2. **Amazon Nova Pro**:
   - Acted as the primary reasoning model, evaluating aerospace tolerance zone breaches down to tenths of a micron ($0.0001\text{ mm}$) and synthesizing mechanical remediation instructions.
3. **Model Context Protocol (MCP) Python SDK**:
   - Built the open-source `mcp-server/` implementing the latest **MCP Spec 2025-11-25 over Streamable HTTP** at `/mcp` to expose legacy CMM `.DMO` inspection files as callable tools.
4. **AWS Amplify Hosting**:
   - Provided continuous deployment, SSR serverless execution for Next.js 14 App Router, and custom domain SSL management (`echoforge.aenox.me`).

---

## 2. What worked well?

- **Amazon Nova Pro Reasoning & Tool Intent Speed**:
   - Extremely rapid inference latency and high accuracy in recognizing physical dimension thresholds and formatting exact CNC offsets.
- **MCP 2025-11-25 Streamable HTTP Architecture**:
   - Moving away from legacy SSE port multiplexing to standard Streamable HTTP endpoints unified client-server communication behind cloud proxies and simplified session handshakes.
- **AWS Amplify Next.js 14 SSR Integration**:
   - Clean detection of App Router API routes (`/api/agent`) with zero-config serverless function deployment.

---

## 3. What needs work?

- **Bedrock AgentCore SDK Documentation & Validation Error Specificity**:
   - `InvokeHarnessCommand` mandates `runtimeSessionId` $\ge 33$ characters, but the SDK threw generic 400 validation exceptions without specifying the length boundary.
- **Streaming Tool Events in AgentCore**:
   - When tools are invoked in custom harnesses, action tokens (`Action: RenderServerTarget___...`) stream directly into regular text content blocks rather than structured `toolUse` events, requiring custom client-side stream interception.
- **Upstream MCP Streamable HTTP Python Documentation**:
   - The MCP Python SDK repository documentation still focuses primarily on `stdio` and legacy SSE, with limited reference examples for running `StreamableHTTPServerTransport` alongside Starlette routes in production.

---

## 4. How was your onboarding experience? (Zero to "Hello World")

- **Console Experience**: Testing Amazon Nova Pro in the Bedrock playground was intuitive and immediate.
- **Programmatic Integration**: Setting up the custom AgentCore harness and invoking it via Node.js required manual reverse-engineering of SDK type definitions due to limited developer tutorials for the newest AgentCore SDK packages.

---

## 5. Would you build with these devices and services again?

**Yes, definitely.** The reasoning fidelity of Amazon Nova Pro coupled with the hands-free potential of Alexa+ makes it uniquely suited for hands-busy, eyes-busy industrial environments like aerospace cleanrooms.

---

*(For the complete technical breakdown and development logs, see [Developer Friction Log](FRICTION_LOG.md)).*
