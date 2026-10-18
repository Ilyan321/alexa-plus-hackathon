# Devpost Submission Form Fields — EchoForge

Copy and paste the exact text for each corresponding field on Devpost below.

---

### * Are you submitting for the Open Source Mini Challenge?
**Yes**

---

### Open Source Mini Challenge Requirement: Contribution URL
```
https://github.com/Ilyan321/alexa-plus-hackathon/commits/main
```

---

### Open Source Mini Challenge Requirement: Project Repository URL
```
https://github.com/Ilyan321/alexa-plus-hackathon
```

---

### Open Source Mini Challenge Requirement: GitHub Username
```
Ilyan321
```

---

### Open Source Mini Challenge Requirement: Provide a description of what you did, how it works, and why it matters.

```markdown
**What We Did:**
We built EchoForge as a fully open-source, vendor-neutral industrial AI bridge under the MIT License. We created an open-source Python MCP server implementing the official Model Context Protocol (MCP) Spec 2025-11-25 over Streamable HTTP (`/mcp`), capable of parsing legacy aerospace Coordinate Measuring Machine (CMM) inspection data (`.DMO` files) down to sub-micron accuracy. Alongside it, we built and open-sourced a Next.js 14 ambient voice interface simulating Alexa+ with wake word barge-in interruption and dynamic phonetic speech formatting for manufacturing acronyms.

**How It Works:**
The open-source edge node (`mcp-server/`) exposes tools `query_dmo_deviation` and `get_repair_procedure` using Streamable HTTP JSON-RPC 2.0 transports. When an operator speaks a query, the Next.js client coordinates with AWS Bedrock AgentCore (Amazon Nova Pro), which calls the MCP edge server to evaluate nominal dimensions against measured coordinate data. The agent outputs physical tolerance verdicts and specific CNC remediation procedures (such as carbide re-milling or diamond honing), synthesized aloud hands-free.

**Why It Matters:**
High-precision manufacturing cleanrooms are held back by expensive, proprietary data silos that force machinists to take off protective gloves to check readings. EchoForge breaks vendor lock-in by proving that legacy factory files can be bridged to modern ambient AI agents using open standards. In addition, it provides the open-source community with a tested, production-ready reference implementation of the latest MCP 2025-11-25 Streamable HTTP specification in Python.
```

---

### [Optional] Feature Requests

```markdown
1. **First-class Structured Tool Events in AWS Bedrock AgentCore Streams**
   - **Description:** Provide native `toolUse` and `toolResult` stream events within AgentCore harnesses rather than emitting raw action text strings into regular content blocks.
   - **Why It Matters:** Eliminates the need for custom client-side stream regex interceptors when models invoke edge tools.
   - **Priority:** Critical

2. **Explicit Turn Recency Weighting in AgentCore Multi-Turn Memory**
   - **Description:** Allow developers to configure attention weighting on parameters extracted in the most recent turn versus earlier conversation history.
   - **Why It Matters:** Prevents stale entities from hijacking subsequent inspection queries in rapid back-to-back voice turns.
   - **Priority:** Important

3. **Official Streamable HTTP (2025-11-25) Production Guides in MCP Python SDK**
   - **Description:** Expand documentation and reference examples for running `StreamableHTTPServerTransport` directly alongside Starlette/FastAPI applications behind reverse proxies.
   - **Why It Matters:** Helps developers quickly adopt the newest HTTP-based standard over legacy stdio/SSE transports.
   - **Priority:** Important
```

---

### [Optional] Friction Log

```
https://github.com/Ilyan321/alexa-plus-hackathon/blob/main/planning/FRICTION_LOG.md
```

*(If Devpost provides a text area for the Friction Log, you can paste the following text:)*

```markdown
Task Attempted: Invoking AWS Bedrock AgentCore harness programmatically from Next.js backend using `@aws-sdk/client-bedrock-agentcore`.
Steps Taken: Installed SDK, configured IAM credentials, called `InvokeHarnessCommand` passing generated session IDs.
Expected Result: Smooth session initiation and token streaming.
Actual Result: HTTP 400 ValidationException due to undocumented requirement where `runtimeSessionId` must be >= 33 characters.
Severity Rating: Medium (2.5 hours lost debugging generic validation error).
Workaround Used: Formatted session IDs with UUIDv4 plus suffix (`uuidv4() + '-1'`) to guarantee minimum length.
Actionable Suggestion: Document string format and length constraints in both AWS SDK docs and TypeScript typings. Full 4-part friction log with code snippets available at: https://github.com/Ilyan321/alexa-plus-hackathon/blob/main/planning/FRICTION_LOG.md
```

---

### [Optional] Project Testing Link
```
https://echoforge.aenox.me
```

---

### * Feedback Question 1: Which developer tools, APIs, and SDKs did you use and for what?

```markdown
1. **AWS Bedrock AgentCore SDK (`@aws-sdk/client-bedrock-agentcore`)**: Used `InvokeHarnessCommand` to orchestrate multi-turn agentic workflows connecting our edge router to custom Bedrock AgentCore harnesses.
2. **Amazon Nova Pro (via Amazon Bedrock)**: Acted as our primary reasoning engine, evaluating sub-micron aerospace tolerance breaches ($0.0001 mm$) and generating mechanical repair procedures.
3. **Model Context Protocol (MCP) Python SDK**: Built the open-source edge bridge implementing the official MCP Spec 2025-11-25 over Streamable HTTP (`/mcp`) to parse legacy CMM `.DMO` inspection files.
4. **AWS Amplify Hosting**: Provided continuous deployment, serverless execution for Next.js 14 App Router, and custom domain SSL management (`echoforge.aenox.me`).
5. **Web Speech API & Speech Synthesis**: Simulated ambient Alexa+ hands-free voice UX directly in the browser with barge-in wake word detection.
```

---

### * Feedback Question 2: For each tool, API, or SDK used in your project, what worked well?

```markdown
- **Amazon Nova Pro**: Very fast response times and high precision in calculating micron-level tolerances and matching them to exact CNC machining operations.
- **MCP 2025-11-25 Streamable HTTP**: Moving away from legacy SSE port multiplexing to standard Streamable HTTP endpoints made routing through cloud proxies much cleaner and more reliable.
- **AWS Amplify Hosting**: Zero-configuration deployment for Next.js 14 App Router server-side API routes (`/api/agent`), with fast build times and reliable edge performance.
```

---

### * Feedback Question 3: For each tool, API, or SDK used in your project, what needs work?

```markdown
- **Bedrock AgentCore SDK Validation Errors**: The `InvokeHarnessCommand` strictly requires `runtimeSessionId` to be 33 characters or longer, but threw a generic 400 error without stating this boundary condition in the error message or SDK docs.
- **Tool Interception in AgentCore Streams**: Action tokens (e.g. `Action: RenderServerTarget___...`) were streamed directly into user-facing text deltas rather than distinct `toolUse` events, requiring custom client-side regex parsing.
- **MCP Python Streamable HTTP Documentation**: Upstream docs still focus heavily on `stdio` and legacy SSE, leaving developers to self-navigate integrating `StreamableHTTPServerTransport` with Starlette routes.
```

---

### * Feedback Question 4: For each tool, API, or SDK used in your project, how was your onboarding experience?

```markdown
Testing Amazon Nova Pro in the AWS Bedrock console was immediate and intuitive. Onboarding to the programmatic AgentCore SDK and custom harnesses had a steeper learning curve due to early-stage documentation and limited end-to-end sample code, requiring us to inspect TypeScript definitions directly. Deploying the frontend to AWS Amplify was very straightforward and worked on the first attempt.
```

---

### * Feedback Question 5: Would you build with these devices and services again?

```markdown
Yes, definitely. The combination of Amazon Nova Pro's reasoning capability, AWS Bedrock AgentCore's orchestration, and the hands-free potential of Alexa+ provides a strong foundation for building ambient voice interfaces in hands-busy industrial environments like manufacturing cleanrooms.
```

---

### Declarations / Checkboxes
- **[x] I, and, if applicable, all of my teammates, are at least the age of majority where I reside (e.g. 18 in the US).**
- **[x] I, and, if applicable, all of my teammates, are from an eligible jurisdiction to compete.**
- **[x] I, and, if applicable, all of my teammates, are not employees, representatives nor agents of the Promotion Entities of this hackathon (sponsor, administrator, or any affiliates).**

---

### * Which AI tools have you leveraged while working on this project?
```
Amazon Nova Pro (AWS Bedrock), Claude 3.5 Sonnet, GitHub Copilot
```

---

### * Describe the level of learning you/your team derived from the project
**Significant**

---

### * Did you gain AI value that you can use in your career?
**Yes**
