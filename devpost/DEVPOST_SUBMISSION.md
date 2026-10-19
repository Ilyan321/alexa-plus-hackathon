# EchoForge – Industrial Edge Bridge

**Project name** – *EchoForge: Industrial Edge Bridge*

**Elevator pitch** – *A lightweight MCP bridge that links Alexa+ with legacy offline tools, letting hands‑busy factory staff fetch local data instantly—just by speaking.*

---

## About the project

## Project Story

### About the project

**Inspiration**
While modern Voice AI is largely confined to consumer tasks like setting kitchen timers or playing music, industrial sectors are facing a massive data bottleneck. In aerospace manufacturing and metrology, operators use Coordinate Measuring Machines (CMMs) to inspect parts down to the micron. Their hands are wrapped in heavy nitrile gloves and their eyes must remain fixed on fragile, $50,000 probes.

However, the legacy desktop software that records these measurements (e.g., PC‑DMIS) traps the data in archaic, local *.DMO* text files. To check a tolerance, operators must drop their tools, de‑glove, and walk to a laptop just to read a text file. We realized that this “hands‑busy, eyes‑busy” environment is the ultimate, untapped frontier for ambient voice computing.

**What it does**
EchoForge is an Industrial Edge‑to‑Voice Bridge. It allows industrial operators to interact with legacy, offline desktop software using only natural language via Alexa+. Instead of walking over to a computer, a machinist simply says:

> “Alexa, check the local system. Did the upper flange pass the 2‑micron tolerance limit?”

EchoForge securely reaches down into the local laptop, parses the messy, offline *.DMO* inspection file in real‑time, processes the coordinate deviation, and speaks the result back to the operator immediately. It turns a standard Alexa into an industrial analytics tool.

**How we built it**
1. **Voice Interface** – a custom Alexa Skill using the new Alexa+ routing capabilities to capture natural‑language intents.
2. **Cloud Orchestrator** – the intent is routed via **AWS Lambda** to **AWS Bedrock AgentCore** (Claude 3.5 Sonnet). Bedrock reasons about which local data is needed.
3. **MCP Edge Bridge** – a local Python server that implements the **Model Context Protocol (MCP) 2025‑11‑25+** (streamable HTTP).
4. **Local Execution** – the MCP server watches the local hard‑drive for new *.DMO* files, parses the cryptic `FILNAM/` blocks with regex/BeautifulSoup, and returns a structured JSON‑RPC payload to Bedrock.

**Challenges we ran into**
The biggest hurdle was bridging the **stateless cloud environment** of Bedrock with a **local, offline file system** while staying secure. Implementing the exact MCP Streamable‑HTTP transport required deep dives into the spec to ensure headers (`Mcp‑Name`, `Mcp‑Method`) correctly mirrored the JSON payload so that AWS API Gateway could route the request without expensive payload parsing. All of the friction is logged in our attached *Friction Log*.

**Accomplishments we’re proud of**
We built a multi‑million‑dollar‑level B2B solution **without any proprietary IoT hardware** – just a Python script and standard protocols. By watching local file‑drops, EchoForge proves that modern Cloud AI can be integrated with legacy 1990s desktop software.

**What we learned**
MCP is not just for reading databases; it is the ultimate “universal remote” that enables secure, remote execution of local diagnostic scripts, fundamentally shifting how Cloud LLMs interact with on‑prem environments.

**What’s next for EchoForge**
While the prototype targets aerospace metrology, the architecture is agnostic. Next steps:
* Adapt the MCP parser to read **HL7 / CareXML** files, letting pathologists dictate cancer‑staging reports into legacy hospital LIMS systems.
* Add a **WebGL‑based 3D digital‑twin** that visualises any tolerance breach in real‑time.
* Package the MCP edge bridge as a Docker image for easy on‑prem deployment across other industries (automotive, oil & gas, etc.).
---
> While modern Voice AI is largely confined to consumer tasks like setting kitchen timers or playing music, industrial sectors are facing a massive data bottleneck. In aerospace manufacturing and metrology, operators use Coordinate Measuring Machines (CMMs) to inspect parts down to the micron. Their hands are wrapped in heavy nitrile gloves and their eyes must remain fixed on fragile, $50,000 probes.
> 
> However, the legacy desktop software that records these measurements (e.g., PC‑DMIS) traps the data in archaic, local *.DMO* text files. To check a tolerance, operators must drop their tools, de‑glove, and walk to a laptop just to read a text file. We realized that this “hands‑busy, eyes‑busy” environment is the ultimate, untapped frontier for ambient voice computing.
>
> **What it does**
> EchoForge is an Industrial Edge‑to‑Voice Bridge. It allows industrial operators to interact with legacy, offline desktop software using only natural language via Alexa+.
> Instead of walking over to a computer, a machinist simply says:
>
> > “Alexa, check the local system. Did the upper flange pass the 2‑micron tolerance limit?”
>
> EchoForge securely reaches down into the local laptop, parses the messy, offline *.DMO* inspection file in real‑time, processes the coordinate deviation, and speaks the result back to the operator immediately. It turns a standard Alexa into an industrial analytics tool.
>
> **How we built it**
> 1. **Voice Interface** – a custom Alexa Skill using the new Alexa+ routing capabilities to capture natural‑language intents.
> 2. **Cloud Orchestrator** – the intent is routed via **AWS Lambda** to **AWS Bedrock AgentCore** (Claude 3.5 Sonnet). Bedrock reasons about which local data is needed.
> 3. **MCP Edge Bridge** – a local Python server that implements the **Model Context Protocol (MCP) 2025‑11‑25+** (streamable HTTP).
> 4. **Local Execution** – the MCP server watches the local hard‑drive for new *.DMO* files, parses the cryptic `FILNAM/` blocks with regex/BeautifulSoup, and returns a structured JSON‑RPC payload to Bedrock.
>
> **Challenges we ran into**
> The biggest hurdle was bridging the **stateless cloud environment** of Bedrock with a **local, offline file system** while staying secure. Implementing the exact MCP Streamable‑HTTP transport required deep dives into the spec to ensure headers (`Mcp‑Name`, `Mcp‑Method`) correctly mirrored the JSON payload so that AWS API Gateway could route the request without expensive payload parsing. All of the friction is logged in our attached *Friction Log*.
>
> **Accomplishments we’re proud of**
> We built a multi‑million‑dollar‑level B2B solution **without any proprietary IoT hardware** – just a Python script and standard protocols. By watching local file‑drops, EchoForge proves that modern Cloud AI can be integrated with legacy 1990s desktop software.
>
> **What we learned**
> MCP is not just for reading databases; it is the ultimate “universal remote” that enables secure, remote execution of local diagnostic scripts, fundamentally shifting how Cloud LLMs interact with on‑prem environments.
>
> **What’s next for EchoForge**
> While the prototype targets aerospace metrology, the architecture is agnostic. Next steps:
> * Adapt the MCP parser to read **HL7 / CareXML** files, letting pathologists dictate cancer‑staging reports into legacy hospital LIMS systems.
> * Add a **WebGL‑based 3D digital‑twin** that visualises any tolerance breach in real‑time.
> * Package the MCP edge bridge as a Docker image for easy on‑prem deployment across other industries (automotive, oil & gas, etc.).

---

## Built with

| Category | Technologies |
|----------|--------------|
| **Languages** | Python 3.12, TypeScript, JavaScript, HTML/CSS |
| **Frameworks** | React 18, Next.js, Tailwind CSS, Flask (MCP server) |
| **Cloud services** | AWS Lambda, AWS Bedrock (AgentCore + Claude 3.5 Sonnet), AWS API Gateway, AWS S3 (demo assets) |
| **Protocols** | Model Context Protocol 2025‑11‑25+, JSON‑RPC, HTTP/2 |
| **Tools** | Alexa Skills Kit, Render (host for MCP), GitHub Actions (CI), Docker (optional edge‑bridge) |
| **Databases** | None (pure file‑based) |
| **APIs** | Alexa Voice Service, Bedrock Agent API, MCP SDK (Python) |

---

## Try it out

| Link | Description |
|------|-------------|
| **GitHub repo** | https://github.com/Ilyan321/alexa-plus-hackathon |
| **Live demo (Web UI)** | https://echoforge.aenox.me |
| **Alexa Skill** (test with your own device) | https://alexa.amazon.com/spa/index.html#skills‑list |
| **MCP server endpoint (JSON‑RPC)** | `https://echoforge-mcp-fresh.onrender.com/mcp` |

---

## Project media

| Type | File (max 5 MB) | Caption |
|------|----------------|---------|
| Image | `screenshot‑ui.png` | Voice UI showing the push‑to‑talk button and 3‑D twin. |
| Image | `diagram‑architecture.png` | High‑level architecture (Alexa → Lambda → Bedrock → MCP → Local PC). |
| Image | `dmo‑sample.png` | Example of a raw `.DMO` inspection file. |
| GIF (optional) | `demo‑flow.gif` | End‑to‑end demo: voice → response → 3‑D highlight. |

Upload the files in Devpost’s **Project Media** section (up to 15 images/GIFs). 

---

## Video demo

Paste the **YouTube** (or Vimeo) URL of your hackathon video here. Example:
```
https://www.youtube.com/watch?v=ABCDEFGHIJK
```

---

## Tags (pick up to 25)

`Alexa+`, `AWS Bedrock`, `Model Context Protocol`, `MCP`, `Voice AI`, `Industrial IoT`, `Edge Computing`, `Legacy Integration`, `Aerospace`, `Metrology`, `Python`, `Flask`, `React`, `Next.js`, `Three.js`, `WebGL`, `Serverless`, `Lambda`, `API Gateway`, `Render`, `Hackathon`, `2026`, `Open Source`, `Demo`, `Voice‑First`, `B2B`.

---

### Final checklist
1. SPEC.md is already **FINALIZED** (see your repo).  
2. All required Devpost sections are filled.  
3. Upload the images/GIFs and add the video URL.  
4. Click **Save & Continue** → **Submit**.

Good luck at the hackathon! 🚀
