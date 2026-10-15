# EchoForge - Issue Tracker & Technical Backlog

## Issue #1: Frontend Design Overhaul & 3D Digital Twin Restoration
* **Severity**: High (User Experience & Hackathon Presentation)
* **Status**: Open (Design Freeze - Pending dedicated sprint)
* **Reported By**: User
* **Description**:
  * Current frontend aesthetic looks like a generic AI chat box with placeholder dark gradients rather than a mission-critical aerospace telemetry terminal.
  * In commit `d7ee185`, the 3D WebGL / Three.js digital twin canvas was removed due to React 19 / `@react-three/fiber` peer dependency issues.
* **Production Requirements**:
  1. Professional industrial design system (aerospace metrology workstation feel: high-contrast telemetry panels, status grids, live deviation charts, tolerance histograms).
  2. Restore the interactive 3D Digital Twin (CAD bracket / turbine component) with dynamic mesh highlight shaders (red on tolerance breach, green on nominal pass, pulsing amber during measurement acquisition).
  3. Ensure zero React 19 / Three.js rendering bottlenecks or hydration mismatches.

---

## Issue #2: Voice Intake Performance & Web Speech API Latency / Cut-offs
* **Severity**: High (Core Operator Interaction)
* **Status**: Open (Pending Audio Pipeline Refactor)
* **Reported By**: User
* **Description**:
  * The browser's native `webkitSpeechRecognition` (Chrome default) is unreliable in factory / production conditions.
  * It frequently drops initial words, abruptly closes listening sessions on micro-pauses (taking only "half data"), and hangs in an unresponsive listening state.
* **Production Requirements**:
  1. Replace or augment browser Web Speech API with a resilient audio pipeline:
     * Option A (Production AWS): Amazon Transcribe Streaming via WebSocket using client audio capture (`MediaRecorder` / `AudioWorklet`).
     * Option B (Hybrid Resilient): Custom Web Audio API buffer with client-side Voice Activity Detection (VAD) and continuous audio ring buffer to prevent speech clipping.
  2. Provide clear visual audio waveform feedback (VU meter / sound level meter) to inform the operator that microphone input is actively streaming.
  3. Support audio replay and low-latency speech synthesis (Amazon Polly or Edge TTS) for hands-free verbal feedback.

---

## Issue #3: Architectural Bypass in API Route (`route.ts`)
* **Severity**: Medium (Architectural Integrity)
* **Status**: ✅ **CLOSED / RESOLVED** (2026-10-15)
* **Resolution**:
  * Removed direct REST bypass in `route.ts`.
  * Updated Bedrock AgentCore Harness V9 system prompt and restricted `allowedTools` to `["RenderServerTarget___queryDeviation", "RenderServerTarget___getRepairProcedure"]`.
  * Verified end-to-end autonomous multi-turn tool orchestration via Bedrock Nova Pro.

---

## Issue #4: UI Viewport Overflow, Vertical Centering & Unscrollable Layout
* **Severity**: High (Usability & Accessibility)
* **Status**: Open
* **Reported By**: User (Screenshot from 2026-10-15 23:01 PKT)
* **Description**:
  * The main page container uses a vertically centered flex layout (`h-full` / `overflow-hidden` or rigid bounds) without an active scroll container.
  * When AgentCore returns a detailed multi-paragraph report (e.g. metrology audit, flight pass/fail checklist, or full CNC G-code program), the card height exceeds the viewport height (100vh).
  * Consequently, the top of the card—including the "EchoForge OS" header, the "AgentCore Intelligence" badge, and the "Ask Again" / "Replay" buttons—gets pushed above the top of the screen.
  * The user is unable to scroll up to see the top controls or scroll down to see the bottom actions.
* **Production Requirements**:
  1. Convert `<main>` container to a scrollable layout (`min-h-screen overflow-y-auto` instead of fixed `h-full`).
  2. Implement an internal scroll container on the Agent Response Card (`max-h-[60vh] overflow-y-auto` with a clean custom scrollbar) so the card never expands beyond the screen.
  3. Keep the header navigation and "Ask Again" action buttons sticky/pinned so operators never lose navigation context.

---

## Issue #5: Unrendered Raw Markdown (`**bold**`, lists, code blocks) in Response Card
* **Severity**: Medium (Readability & Aesthetics)
* **Status**: Open
* **Reported By**: User (Screenshot from 2026-10-15 23:01 PKT)
* **Description**:
  * AgentCore responses frequently contain standard markdown formatting (e.g. `**Date:**`, `**Flight Certification Tolerance Check:**`, `- bullet points`, and code blocks).
  * Currently, the UI renders the response inside `<p className="whitespace-pre-wrap">{agentResponse}</p>`, displaying raw asterisks, backticks, and dashes without typographic rendering.
* **Production Requirements**:
  1. Add a rich markdown renderer (e.g. `react-markdown` with `remark-gfm` or formatted industrial text component) in `page.tsx`.
  2. Render bold key-value pairs (`**Key:** Value`) as crisp telemetry labels.
  3. Format bullet lists as industrial checklist items with Pass/Fail badges.
  4. Render CNC G-code and program blocks in high-contrast monospaced code blocks with a copy button.
