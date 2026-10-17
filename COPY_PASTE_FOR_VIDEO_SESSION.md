# CONTEXT & PROMPT: AUTOMATED PLAYWRIGHT VIDEO DEMO RECORDING (MP4) FOR ECHOFORGE

> **Instructions for the Agent / Engineer in this new session:**
> You are tasked with executing an automated, studio-grade video recording of **EchoForge** for the **Amazon Alexa+ Track Hackathon submission (Issue #8)**.
> Everything must be recorded in high-definition (1080p, 1920x1080), at natural **HUMAN pace** (smooth mouse paths, realistic pauses, no robotic instant clicking), and finalized directly as an **`.mp4`** video file.

---

## 1. Project Background & System Architecture
- **Project Name**: **EchoForge** — Hands-Free Ambient Voice Metrology Assistant for Aerospace Cleanrooms.
- **Repository**: `https://github.com/Ilyan321/alexa-plus-hackathon` (branch `main`).
- **Working Directory**: `/home/ilyan/amazon`.
- **Live Deployed Frontend**: `https://echoforge.aenox.me` (or local fallback `http://localhost:3000`).
- **Live Edge MCP Server**: `https://echoforge-mcp.onrender.com` (implements MCP Spec 2025-11-25 Streamable HTTP at `/mcp`).
- **AI Harness**: AWS Bedrock AgentCore (`Amazon Nova Pro`) with autonomous tool interception.
- **5 Supported Aerospace Features**:
  1. `UPPER_FLANGE` (Nominal: 50.000 mm, Tol: 2.0 µm)
  2. `MAIN_BORE_HOLE` (Nominal: 15.000 mm, Tol: 0.1 µm)
  3. `TURBINE_BLADE_ROOT` (Nominal: 32.500 mm, Tol: 1.5 µm)
  4. `INLET_NOZZLE_RING` (Nominal: 78.200 mm, Tol: 2.5 µm)
  5. `EXHAUST_STATOR_BOSS` (Nominal: 24.000 mm, Tol: 1.8 µm)

---

## 2. Recent Work Done in Previous Session (DO NOT RE-DO OR BREAK)
1. **Real-Time Tolerance Deviation Gauge (Issue #14)**: Added right above the response card. Features a horizontal scale bar (green safe, amber warning 80-100%, red out-of-spec), dynamic animated pointer needle with tooltip deviation (`+1.687 µm`), and metrology pill chips.
2. **Single-Latest Reading Enforcement**: Edge parser reverse-scans blocks so only the single latest reading is presented; AgentCore does not dump historical audit rows.
3. **Barge-In Hardware Release Fix**: Interruption commands ("Stop", "Echo") immediately call `abort()` on the recognition engine to release the microphone device cleanly.
4. **Clean Code Modularization (Issue #19)**: Decomposed `page.tsx` into `ToleranceDeviationGauge.tsx`, `CodeBlock.tsx`, `SpcDriftWidget.tsx`, `InspectionChips.tsx`, and `lib/speech-utils.ts`. Verified with 0 type errors on `npm run build`.

---

## 3. Playwright & FFmpeg Tooling Status
- `playwright` is installed in the workspace (Node.js Playwright Chromium).
- `ffmpeg` is installed system-wide at `/usr/bin/ffmpeg`.
- Target output folder: `/home/ilyan/amazon/videos/`
- Target finalized video file: `/home/ilyan/amazon/videos/echoforge_demo.mp4`

---

## 4. Exact Video Timeline & Storyboard (Paced at ~115 seconds / ~2 minutes)

| Timestamp | Visual Action | Pacing & Details |
|---|---|---|
| **0:00 - 0:18** | **Landing Page Introduction** | Open `https://echoforge.aenox.me` at `1920x1080`. Move cursor smoothly across top header (*"EchoForge OS — AWS Bedrock AgentCore · Live Factory Edge"*). Hover over center glowing voice orb. Pause 3s. |
| **0:18 - 0:32** | **Hands-Free Mode Toggle** | Smoothly move cursor to top-right header and click **`Hands-Free: OFF`**. It toggles to **`Hands-Free: ON`** with a green pulse. Pause 2.5s to emphasize hands-free operation for machinists wearing gloves. |
| **0:32 - 1:05** | **Out-of-Tolerance Metrology Query (Hero Moment)** | Move cursor down to **Inspection Features**. Click **`Turbine Blade Root`**. Wait for response. The **Aerospace Tolerance Deviation Gauge** drops down; pointer slides across to **`+1.687 µm`** with pulsing **`⚠️ OUT OF TOLERANCE`**. Move cursor over the 4 pill chips (`Nominal: 32.500 mm`, `Measured: 32.5017 mm`, `Deviation: +1.687 µm`, `Tol Limit: ±1.500 µm`). **Pause 6 full seconds** so the viewer can absorb the gauge. |
| **1:05 - 1:20** | **Batch Drift Trend & Sparkline** | Scroll down smoothly ~250px inside the response card. Highlight the **Batch Drift Trend (Units Inspected)** and the SVG Sparkline showing machine tool wear. Pause 4s. |
| **1:20 - 1:40** | **Autonomous CNC Repair Procedure** | Move cursor to the orange button: **`🔧 Retrieve CNC Repair Procedure`** and click it. The response updates with the EDM spark erosion procedure and G-code. Scroll to the code block, click **`Copy`** (shows green checkmark "Copied"). Pause 4s. |
| **1:40 - 1:55** | **In-Tolerance Nominal Part Check** | Scroll smoothly back to top. Click **`Main Bore Hole`** on the inspection chips. Gauge re-animates smoothly to the center safe green zone: **`✓ IN TOLERANCE`** (`0.072 µm` / `0.100 µm`). Pause 4s. |
| **1:55 - 2:00** | **Conclusion & Top Header Badge** | Pan cursor back up to the top header highlighting **AWS Bedrock AgentCore** and **EchoForge OS**. Pause 3s, then complete recording. |

---

## 5. Playwright Script Implementation (`record_demo.js`)

Create and run `/home/ilyan/amazon/record_demo.js`:

```javascript
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Helper for realistic human-like curved mouse movement
async function smoothMove(page, targetX, targetY, steps = 30) {
  await page.mouse.move(targetX, targetY, { steps });
}

(async () => {
  const videoDir = path.join(__dirname, 'videos');
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

  console.log('🚀 Launching Chromium at 1920x1080...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--window-size=1920,1080', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();
  console.log('🌐 Navigating to EchoForge...');
  await page.goto('https://echoforge.aenox.me', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // 1. Initial Overview & Header Hover
  console.log('📍 Phase 1: Header & Center Orb overview...');
  await smoothMove(page, 280, 42, 35);
  await page.waitForTimeout(2500);
  await smoothMove(page, 960, 480, 40);
  await page.waitForTimeout(2500);

  // 2. Toggle Hands-Free ON
  console.log('📍 Phase 2: Activating Hands-Free mode...');
  const handsFreeBtn = page.getByRole('button', { name: /Hands-Free/i });
  const hfBox = await handsFreeBtn.boundingBox();
  if (hfBox) {
    await smoothMove(page, hfBox.x + hfBox.width / 2, hfBox.y + hfBox.height / 2, 30);
    await page.waitForTimeout(1000);
    await handsFreeBtn.click();
    await page.waitForTimeout(3000);
  }

  // 3. Inspect Turbine Blade Root (Out of Tolerance)
  console.log('📍 Phase 3: Inspecting Turbine Blade Root...');
  const turbineBtn = page.getByRole('button', { name: /Turbine Blade Root/i });
  const tbBox = await turbineBtn.boundingBox();
  if (tbBox) {
    await smoothMove(page, tbBox.x + tbBox.width / 2, tbBox.y + tbBox.height / 2, 30);
    await page.waitForTimeout(1000);
    await turbineBtn.click();
  }

  // Wait for Gauge to appear and animate
  console.log('⏳ Waiting for Aerospace Tolerance Gauge...');
  await page.waitForSelector('text=AEROSPACE METROLOGY GAUGE', { timeout: 25000 });
  await page.waitForTimeout(2000);

  // Move cursor across gauge pill chips
  await smoothMove(page, 700, 360, 25);
  await page.waitForTimeout(1500);
  await smoothMove(page, 960, 360, 25);
  await page.waitForTimeout(1500);
  await smoothMove(page, 1220, 360, 25);
  await page.waitForTimeout(4000); // Allow ample time to view out-of-tolerance verdict

  // 4. Scroll to highlight Batch Drift Sparkline
  console.log('📍 Phase 4: Highlighting Batch Drift Trend Sparkline...');
  await page.evaluate(() => window.scrollBy({ top: 260, behavior: 'smooth' }));
  await page.waitForTimeout(4000);

  // 5. Retrieve CNC Repair Procedure
  console.log('📍 Phase 5: Triggering CNC Repair Procedure...');
  const repairBtn = page.getByRole('button', { name: /Retrieve CNC Repair Procedure/i });
  if (await repairBtn.isVisible()) {
    const rBox = await repairBtn.boundingBox();
    if (rBox) {
      await smoothMove(page, rBox.x + rBox.width / 2, rBox.y + rBox.height / 2, 30);
      await page.waitForTimeout(1200);
      await repairBtn.click();
      console.log('⏳ Waiting for repair procedure response...');
      await page.waitForTimeout(7000);
    }
  }

  // Copy G-code button interaction
  const copyBtn = page.getByRole('button', { name: /Copy/i }).first();
  if (await copyBtn.isVisible()) {
    const cBox = await copyBtn.boundingBox();
    if (cBox) {
      await smoothMove(page, cBox.x + cBox.width / 2, cBox.y + cBox.height / 2, 25);
      await page.waitForTimeout(800);
      await copyBtn.click();
      await page.waitForTimeout(3000);
    }
  }

  // 6. Scroll back and inspect Main Bore Hole (In Tolerance)
  console.log('📍 Phase 6: Inspecting Main Bore Hole (In-Tolerance check)...');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(2000);

  const mainBoreBtn = page.getByRole('button', { name: /Main Bore Hole/i });
  const mbBox = await mainBoreBtn.boundingBox();
  if (mbBox) {
    await smoothMove(page, mbBox.x + mbBox.width / 2, mbBox.y + mbBox.height / 2, 30);
    await page.waitForTimeout(1000);
    await mainBoreBtn.click();
    console.log('⏳ Waiting for In-Tolerance verdict...');
    await page.waitForTimeout(6500);
  }

  // 7. Final Pan to Top Header
  console.log('📍 Phase 7: Final header highlight...');
  await smoothMove(page, 960, 42, 30);
  await page.waitForTimeout(4000);

  // Close context to finish writing the .webm video file
  await context.close();
  await browser.close();

  // Find the recorded webm file
  const files = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
  if (files.length === 0) {
    console.error('❌ No webm video found in', videoDir);
    return;
  }
  const latestWebm = path.join(videoDir, files[files.length - 1]);
  const outputMp4 = path.join(videoDir, 'echoforge_demo.mp4');

  console.log(`🎬 Converting ${latestWebm} to MP4 using ffmpeg...`);
  execSync(`ffmpeg -y -i "${latestWebm}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 "${outputMp4}"`, { stdio: 'inherit' });

  console.log(`✅ Success! High-definition MP4 demo video created at:\n   ${outputMp4}`);
})();
```

---

## 6. Execution Command
To run the automated recording and generate the final MP4:
```bash
node /home/ilyan/amazon/record_demo.js
```
The resulting video will be ready at: `/home/ilyan/amazon/videos/echoforge_demo.mp4`.
