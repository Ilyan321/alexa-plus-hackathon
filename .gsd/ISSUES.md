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
* **Status**: ✅ **CLOSED / RESOLVED** (2026-10-17)
* **Reported By**: User
* **Resolution**:
  * Converted main page layout to `min-h-screen w-full overflow-x-hidden` with natural responsive document flow.
  * Replaced `overflow: hidden` on `body` with smooth custom telemetry scrollbars (`globals.css`).
  * Made the top navigation bar `sticky top-0 z-30` with backdrop blur, preventing it from being pushed off-screen.
  * Added an internal scroll container on the Agent Response Card (`max-h-[50vh] overflow-y-auto`) with a pinned top bar for "Replay" and "Ask Again" action buttons.

---

## Issue #5: Unrendered Raw Markdown (`**bold**`, lists, code blocks) in Response Card
* **Severity**: Medium (Readability & Aesthetics)
* **Status**: ✅ **CLOSED / RESOLVED** (2026-10-17)
* **Reported By**: User
* **Resolution**:
  * Rendered markdown using `react-markdown` with `remark-gfm` tables and checklists.
  * Styled key metrics and bold text with crisp telemetry badge highlighting (`bg-brand-100/40 font-semibold`).
  * Added custom `CodeBlock` component for monospaced CNC G-code and telemetry blocks with an interactive one-click "Copy" button.
  * Formatted tables, blockquotes, and lists with industrial aesthetic styling.
