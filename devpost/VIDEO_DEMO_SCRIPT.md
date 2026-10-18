# EchoForge Hackathon Video Script 🎙️
> **Target Duration:** ~2 minutes (110–120 seconds)  
> **Platform/Requirements:** Under 3 minutes, 1080p desktop recording showing `https://echoforge.aenox.me` in action.  
> **Tone:** Confident, enthusiastic student builder, authentic and clear.

---

## 🎬 Video Overview for Presenter

- **What you are showing on screen:** The live web dashboard at `https://echoforge.aenox.me`.
- **How to record:** You can record your screen (using OBS, Loom, QuickTime, or the browser) while speaking, or record your voiceover on top of the screen recording.
- **Key words to hit:** *Alexa+*, *AWS Bedrock AgentCore*, *Amazon Nova Pro*, *Model Context Protocol (MCP 2025-11-25)*, *Aerospace Metrology*, *Hands-Free Cleanroom*.

---

## 📜 Scene-by-Scene Script

### Scene 1: Introduction & The Problem (0:00 – 0:25)
**Visual on screen:**
- Browser is on `https://echoforge.aenox.me`.
- Cursor gently hovers around the header: *"EchoForge OS — AWS Bedrock AgentCore · Live Factory Edge"* and the center glowing voice orb.

**Spoken Narration:**
> "Hi everyone! Welcome to **EchoForge**. We built an ambient edge metrology AI assistant designed specifically for aerospace cleanrooms and CNC manufacturing.
>
> In high-precision manufacturing, operators use Coordinate Measuring Machines to inspect critical parts like turbine blades and engine flanges down to fractions of a micron. But because cleanroom machinists wear heavy protective gloves and face shields, they can’t touch keyboards or screens. Data gets trapped in legacy offline `.DMO` inspection files, forcing them to de-glove and stop work just to check measurements. 
>
> EchoForge solves this by bringing hands-free ambient voice intelligence directly to the factory floor using Alexa+ and AWS Bedrock."

---

### Scene 2: Enabling Hands-Free Cleanroom Mode (0:25 – 0:38)
**Visual on screen:**
- Move cursor to the top right and click the **`Hands-Free: OFF`** toggle.
- The button switches to **`Hands-Free: ON`** with a pulsing green indicator.

**Spoken Narration:**
> "To start, our operator enables **Hands-Free Mode** with a single click or voice command. 
> 
> EchoForge runs an ambient voice listening loop directly in the browser with real-time wake word barge-in detection. If an operator ever needs to interrupt or stop a reading, they can simply say 'Alexa' or 'Stop' and the audio aborts immediately without freezing."

---

### Scene 3: Live Metrology Query — Out of Tolerance (0:38 – 1:10)
**Visual on screen:**
- Click on the **`Turbine Blade Root`** feature chip.
- Wait 2–3 seconds for the response.
- The **Aerospace Metrology Gauge** animates on screen. The needle swings past tolerance into the amber/red zone to `+1.687 µm`.
- The badge flashes **`⚠️ OUT OF TOLERANCE`**.
- Hover cursor over the pill chips (`Nominal: 32.500 mm`, `Measured: 32.5017 mm`, `Deviation: +1.687 µm`, `Tol Limit: ±1.500 µm`).

**Spoken Narration:**
> "Now, let’s simulate an operator asking: *'Alexa, inspect the Turbine Blade Root and check our tolerance limits.'*
>
> In the background, our query is sent to **AWS Bedrock AgentCore**, powered by **Amazon Nova Pro**. Nova Pro orchestrates a tool call to our self-hosted **Model Context Protocol (MCP)** server on Render, running the latest **MCP 2025-11-25 Streamable HTTP specification**.
>
> The MCP server parses the raw legacy `.DMO` telemetry in real time. As you can see on our metrology gauge, the turbine blade root is measuring at **plus 1.687 microns**, which exceeds our allowable tolerance of 1.5 microns. The system instantly marks this as **OUT OF TOLERANCE** and speaks the verdict aloud."

---

### Scene 4: Statistical Process Control & Autonomous Repair (1:10 – 1:35)
**Visual on screen:**
- Scroll down slightly inside the card.
- Highlight the **Batch Drift Trend** sparkline showing tool wear over historical units.
- Click the orange button: **`🔧 Retrieve CNC Repair Procedure`**.
- The card updates with the engineering repair workflow and copyable G-code / machine offsets.
- Click the **`Copy`** button (shows green checkmark).

**Spoken Narration:**
> "Notice the Statistical Process Control widget below—EchoForge tracks batch drift so operators can spot tooling wear before catastrophic failure occurs.
>
> Even better, the operator doesn't have to look up maintenance manuals. They can just ask for remediation. By clicking **Retrieve CNC Repair Procedure**, Bedrock autonomously queries the repair database and outputs the exact engineering directive: in this case, EDM spark erosion with dielectric fluid at 45 amps, along with copyable CNC offsets."

---

### Scene 5: In-Tolerance Nominal Feature Check (1:35 – 1:50)
**Visual on screen:**
- Scroll back up.
- Click **`Main Bore Hole`** on the feature selector.
- The gauge updates smoothly, centering the needle in the vibrant green zone: **`✓ IN TOLERANCE`** (`0.072 µm` within `±0.100 µm`).

**Spoken Narration:**
> "Let’s test an in-spec component. Clicking **Main Bore Hole**, our Bedrock harness and MCP bridge fetch the latest inspection data.
>
> The gauge needle instantly animates into the safe green zone—showing a deviation of just 0.072 microns against a 0.1 micron limit. The part passes with zero operator friction."

---

### Scene 6: Conclusion & Wrap-Up (1:50 – 2:05)
**Visual on screen:**
- Scroll to top, gently panning across the header highlighting **EchoForge OS**, **AWS Bedrock AgentCore**, and the live status badge.

**Spoken Narration:**
> "EchoForge is fully open-source under the MIT license, deployed with Next.js 14 on **AWS Amplify**, powered by **AWS Bedrock AgentCore** and **Amazon Nova Pro**, and connected via an official **MCP Streamable HTTP** server.
>
> It breaks open legacy manufacturing data silos and shows what’s possible when ambient voice meets autonomous edge AI.
>
> Thank you so much for watching!"

---

## 💡 Quick Tips for the Presenter:
1. **Don't rush mouse clicks**: When clicking buttons or chips, let the cursor rest for 1–2 seconds so viewers can follow what you are clicking.
2. **Pause on the gauge**: When the gauge needle swings and says `⚠️ OUT OF TOLERANCE`, leave it on screen for 4–5 seconds—that is the "hero" moment of the demo.
3. **Sound check**: Record in a quiet room with headphones/mic. A clear, friendly voice makes a huge impression on judges!
4. **Time limit**: Keep the final video between **1 minute 45 seconds and 2 minutes 15 seconds** (well under the 3-minute hackathon cutoff).
