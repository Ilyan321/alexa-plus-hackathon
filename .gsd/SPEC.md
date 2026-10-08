# Project Specification: Industrial Voice-to-Edge Bridge (Project Forge)

**Status:** FINALIZED
**Target:** Amazon Developer Hackathon (Alexa+ Track, AWS Builder Track)

## 1. Executive Summary
Project Forge bridges the gap between modern cloud-based conversational AI (Alexa+) and offline, legacy industrial desktop software. By utilizing the Model Context Protocol (MCP) Streamable HTTP transport, it allows operators in "hands-busy, eyes-busy" environments (like aerospace metrology or medical pathology) to query local, cryptic data files using natural voice commands, saving thousands of hours in manual data-entry and cross-referencing.

## 2. Core Architecture
The system consists of three primary layers:
1.  **The Voice Interface (Alexa+):** Captures the user's natural language intent.
2.  **The Orchestrator (AWS Bedrock AgentCore):** Uses Claude 3.5 Sonnet to process the semantic intent, determine the required local data, and generate the proper tool invocation.
3.  **The Edge Bridge (Local MCP Server):** A lightweight Python script running on the operator's laptop. It watches a local directory for legacy data files (e.g., Hexagon PC-DMIS `.DMO` files), parses the unstructured text, and exposes the exact metric back to the cloud via a secure, stateless HTTP payload.

## 3. Product Requirements (Hackathon Scope)

### 3.1. Required Features (P0)
*   **Dummy File Generator:** A local Python script that generates mock `.DMO` inspection files with FILNAM tags and coordinate deviation data.
*   **MCP Server (Python):** Must implement the `2025-11-25+ Streamable HTTP` specification.
*   **MCP Tool Exposure:** Expose a tool `query_dmo_deviation(feature_name)` that parses the latest `.DMO` file and returns the specific deviation value.
*   **AWS Bedrock Integration:** Configure Bedrock AgentCore to connect to the MCP server.
*   **Alexa Skill:** Create a Custom Skill in the Alexa Developer Console that acts as the front-end for the Bedrock agent.

### 3.2. Architecture & Deployment Decisions (Locked)
*   **Repository Structure:** Monorepo. The codebase will contain `/aws-backend` (SAM template) and `/mcp-server` (Render web service).
*   **MCP Server Deployment:** Deployed to Render.com as a public web service to provide a permanent, reliable HTTPS endpoint (simulating the remote factory edge for the judges).
*   **Data Simulation:** A background Python thread on the Render server will physically write and overwrite a `.DMO` text file on the local disk every 60 seconds. This proves the MCP server executes real filesystem I/O.
*   **AWS Backend Deployment:** Managed via AWS SAM (Serverless Application Model) for professional Infrastructure-as-Code.

## 4. Judging Alignment & Success Criteria
*   **Tech Implementation (Alexa+):** Validates the use of MCP Streamable HTTP.
*   **AWS Builder Mini-Challenge:** Validates the integration of AWS Bedrock for orchestration.
*   **Potential Impact:** Proves a multi-million dollar B2B use case, contrasting with saturated consumer apps.
*   **Friction Log Bonus:** We will actively document pain points when integrating the Bedrock AgentCore with the local MCP server.

## 5. Demo Video Flow
*   **Scene:** Presenter wearing heavy nitrile gloves, holding a physical prop (metal bracket).
*   **Action:** "Alexa, check the Bedrock system. Did the upper flange pass the 2-micron tolerance?"
*   **System:** Alexa processes via Bedrock, which calls the local MCP server. MCP parses the local `.DMO` file and returns `1.8`.
*   **Result:** Alexa replies aloud that the part passes.
