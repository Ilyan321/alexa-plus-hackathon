# Project Specification: EchoForge - Industrial Voice-to-Edge Bridge

**Status:** FINALIZED
**Target:** Amazon Developer Hackathon (Alexa+ Track AND AWS Builder Mini-Challenge)

## 1. Executive Summary
EchoForge bridges the gap between modern conversational AI (Alexa+) and offline, legacy industrial desktop software. By utilizing the Model Context Protocol (MCP), it allows operators in "hands-busy, eyes-busy" environments (like aerospace metrology) to query local data files using natural voice commands, visualizing the data instantly on a 3D Digital Twin, all orchestrated by AWS Bedrock AgentCore.

## 2. Core Architecture
The system consists of three primary layers (The "All-In" Architecture):
1.  **The Voice-Native 3D Frontend (Alexa+ Clone):** A sleek React web dashboard. It uses the browser's Web Speech API for voice I/O and renders a 3D digital twin of the aerospace part. It acts as the client for AWS Bedrock.
2.  **The Orchestrator (AWS Bedrock AgentCore):** The AWS Builder challenge! A Bedrock Agent (using Claude 3.5 Sonnet) that receives the user's intent from the frontend, determines what data to fetch, and calls our MCP Server.
3.  **The Edge Bridge (Render MCP Server):** A Python MCP server deployed to Render. It generates and parses legacy `.DMO` inspection files, exposing specific tools (`query_dmo_deviation`) to Bedrock.

## 3. Product Requirements (Hackathon Scope)

### 3.1. Required Features (P0)
*   **MCP Server (Python):** `2025-11-25+ Streamable HTTP` specification (using `MCPServer`).
*   **Dummy Data Generator:** Background thread on Render physically writing `.DMO` files.
*   **AWS Bedrock Agent:** Configured to consume the Render MCP endpoint securely.
*   **Web Speech UI:** Push-to-talk browser interface simulating Alexa+.
*   **3D Digital Twin:** WebGL/Three.js rendering of a CAD model that flashes red based on Bedrock's data response.

## 4. Judging Alignment & Success Criteria
*   **Alexa+ Track:** Perfectly aligns with the rules' instruction to "simulate an Alexa+ experience using your preferred agentic tools via a web app".
*   **AWS Builder Track:** Uses Amazon Bedrock AgentCore.
*   **Wow Factor:** 3D digital twin paired with native voice control creates a massive B2B impact demo to beat 52,000 teams.

## 5. Demo Video Flow
*   **Scene:** Split screen: Presenter with headset on the left, Voice/3D Dashboard on the right.
*   **Action:** Presenter says: "Alexa, check the metrology system. What is the status of the upper flange?"
*   **System:** Voice -> Web App -> AWS Bedrock Agent -> Render MCP -> Bedrock -> Web App.
*   **Result:** The UI reads out the failure aloud while the 3D model spins and flashes the upper flange in red.
