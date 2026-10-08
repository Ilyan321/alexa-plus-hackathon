# Hackathon Roadmap: EchoForge

## Phase 1: The Local Edge (COMPLETED)
**Objective:** Build and test the local Python MCP server and logic.
*   [x] Initialize GitHub Monorepo.
*   [x] Write Python MCP Server (`MCPServer`) with `query_dmo_deviation` tool.
*   [x] Create test data (`happy_path.dmo`, `malformed.dmo`).
*   [x] Write and pass robust logic tests.
*   [x] Push to GitHub.

## Phase 2: Deployment & Free Infrastructure
**Objective:** Get the MCP server live on the internet for $0.
*   [ ] Connect the GitHub repo to Render.com.
*   [ ] Deploy the MCP server via the `render.yaml` blueprint.
*   [ ] Verify the public Render URL and Authentication token.
*   [ ] Implement the background data-generator thread on the Render server.

## Phase 3: The Voice & 3D Dashboard
**Objective:** Build the Alexa+ Simulation Web App.
*   [ ] Scaffold a React/Next.js web app.
*   [ ] Implement Web Speech API (Speech-to-Text and Text-to-Speech).
*   [ ] Integrate a free LLM API (Groq/Gemini) that connects to the Render MCP URL.
*   [ ] Load a basic 3D model (e.g., a bracket) using Three.js/React Three Fiber.

## Phase 4: Integration & The "Wow Factor"
**Objective:** Connect the LLM responses to the 3D model state.
*   [ ] Configure the LLM to output structured responses (e.g., JSON) alongside the speech text.
*   [ ] Write UI logic: If LLM reports a failed tolerance for "UPPER_FLANGE", change the color of that 3D mesh node to red.
*   [ ] Polish the UI to look like an industrial dashboard.

## Phase 5: Submission Polish
**Objective:** Finalize the video and documentation.
*   [ ] Record the 3-minute demo video (showing the voice and 3D highlighting).
*   [ ] Finalize the GitHub `README.md`.
*   [ ] Submit the project to Devpost.
