# Project Specification: EchoForge - Industrial Voice-to-Edge Bridge

**Status:** FINALIZED
**Target:** Amazon Developer Hackathon (Alexa+ Track)
**Strategic Pivot:** Dropped AWS Builder mini-challenge (No-Cost Route).

## 1. Executive Summary
EchoForge bridges the gap between modern conversational AI (Alexa+) and offline, legacy industrial desktop software. By utilizing the Model Context Protocol (MCP), it allows operators in "hands-busy, eyes-busy" environments (like aerospace metrology) to query local data files using natural voice commands, visualizing the data instantly on a 3D Digital Twin.

## 2. Core Architecture
The system consists of two primary layers (Zero Cost Architecture):
1.  **The Voice-Native Frontend (Alexa+ Clone):** A sleek React/Next.js web dashboard simulating the Alexa+ experience. It uses the browser's native Web Speech API for voice I/O, a free LLM API (like Groq or Gemini Free Tier) for intent parsing, and renders a 3D digital twin of the aerospace part using Three.js.
2.  **The Edge Bridge (Render MCP Server):** A Python MCP server deployed to Render's free tier. It generates and parses legacy `.DMO` inspection files, exposing specific tools (`get_feature_deviation`) to the frontend agent.

## 3. Product Requirements (Hackathon Scope)

### 3.1. Required Features (P0)
*   **MCP Server (Python):** `2025-11-25+ Streamable HTTP` specification (using `MCPServer`).
*   **Dummy Data Generator:** Background thread on Render physically writing `.DMO` files.
*   **MCP Tool:** `query_dmo_deviation(feature_name)` to parse unstructured `.DMO` files.
*   **Web Speech UI:** Push-to-talk browser interface simulating Alexa+.
*   **Free LLM Agent:** A backend/frontend logic layer calling a free LLM API, equipped to connect to our Render MCP Server.
*   **3D Digital Twin:** WebGL/Three.js rendering of a CAD model. When the LLM reports a failed tolerance, the UI dynamically highlights that specific feature on the 3D model in red.

## 4. Judging Alignment & Success Criteria
*   **Tech Implementation (Alexa+):** Perfectly aligns with the rules' instruction to "simulate an Alexa+ experience using your preferred agentic tools via a web app".
*   **Wow Factor:** 3D digital twin paired with native voice control creates a massive B2B impact demo.
*   **Budget:** $0.00. No AWS, no credit cards.

## 5. Demo Video Flow
*   **Scene:** Split screen: Presenter with headset on the left, Voice/3D Dashboard on the right.
*   **Action:** Presenter says: "Alexa, check the metrology system. What is the status of the upper flange?"
*   **System:** Voice transcribed in browser -> LLM agent queries Render MCP -> MCP reads `.DMO` -> Returns 1.8 deviation (out of tolerance).
*   **Result:** The UI reads out the failure aloud while the 3D model spins and flashes the upper flange in red.
