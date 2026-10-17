# Instructions & Prompt: Automated Playwright Video Recording for EchoForge Demo

## Objective
Record a polished, high-resolution, human-paced video walkthrough of **EchoForge** (`https://echoforge.aenox.me`) using Playwright for the **Amazon Alexa+ Hackathon Submission Video** (Issue #8).

---

## Technical Context & Environment
- **Live Deployment URL**: `https://echoforge.aenox.me` (or local fallback `http://localhost:3000`)
- **Working Directory**: `/home/ilyan/amazon`
- **Output Video Target**: `/home/ilyan/amazon/videos/echoforge_demo.webm` (convertible to `.mp4` via `ffmpeg`)
- **Resolution**: 1920x1080 (1080p full HD desktop view)
- **Playwright Status**: Installed and ready in `/home/ilyan/amazon/frontend-dashboard`

---

## Human-Paced Recording Requirements (DO NOT RUSH)
1. **Realistic Mouse Movement**: Use a smooth bezier/curved mouse movement function rather than instantaneous teleportation.
2. **Generous Pauses**:
   - Pause for 2–3 seconds on the landing page so the viewer can take in the UI.
   - Pause for 4–5 seconds when the **Aerospace Tolerance Deviation Gauge** animates so the viewer can read the numbers and see the needle settle.
   - Pause for 3–4 seconds on the **Batch Drift Trend & Sparkline Widget**.
   - Pause for 4–5 seconds when the **CNC Repair Procedure & G-Code** are displayed.
3. **Total Duration**: Approximately **110 to 125 seconds (~2 minutes)**.

---

## Step-by-Step Storyboard to Automate

### Phase 1: Landing Page & Problem Context (0:00 - 0:20)
1. Launch browser at viewport `1920x1080`.
2. Navigate to `https://echoforge.aenox.me`.
3. Move cursor smoothly over the header: *"EchoForge OS — AWS Bedrock AgentCore · Live Factory Edge"*.
4. Move cursor toward the center microphone orb. Pause for 3 seconds.

### Phase 2: Enabling Hands-Free Cleanroom Mode (0:20 - 0:35)
1. Move cursor to the top-right header and click the **`Hands-Free: OFF`** toggle button.
2. The button transforms to **`Hands-Free: ON`** with an animated pulsing icon.
3. Pause for 2.5 seconds to highlight the hands-free capability for machinists wearing gloves.

### Phase 3: Out-of-Tolerance Metrology Query (0:35 - 1:05)
1. Move cursor smoothly down to the **Inspection Features** row.
2. Hover over and click **`Turbine Blade Root`** (or trigger the text workflow query: *"Query the live sensor deviation for TURBINE_BLADE_ROOT and evaluate if it is within or out of tolerance."*).
3. Wait for AWS Bedrock AgentCore and the Render Edge MCP Server to respond.
4. **The Visual Hero Moment**:
   - The **Aerospace Metrology Gauge** animates smoothly above the response card.
   - The indicator needle slides across the tolerance zone to `+1.687 µm`.
   - The badge flashes **`⚠️ OUT OF TOLERANCE`**.
   - Move the cursor smoothly across the pill chips: `Nominal: 32.500 mm`, `Measured: 32.5017 mm`, `Deviation: +1.687 µm`, `Tol Limit: ±1.500 µm`.
   - Pause for 6 seconds so the judge can clearly see this visual hero moment.

### Phase 4: Batch Drift Trend & Sparkline (1:05 - 1:20)
1. Scroll down slightly inside the response card.
2. Move cursor to highlight the **Statistical Process Control (SPC) Machine Tooling Drift Widget**:
   - Point to the SVG Sparkline with historical inspection units.
   - Point to the trend tag: *"Drifting toward tolerance limit"*.
   - Pause for 4 seconds.

### Phase 5: Autonomous CNC Repair Procedure (1:20 - 1:40)
1. Move cursor down to the glowing button: **`🔧 Retrieve CNC Repair Procedure`**.
2. Click the button.
3. The AgentCore harness autonomously retrieves the engineering repair procedure:
   - *"EDM SPARK EROSION (Cycle E-9): Submerge in dielectric fluid and run spark erosion pass at 45A to re-profile fir-tree root tangs by 1.687 microns."*
4. Scroll to show the copyable G-code / telemetry code block.
5. Click the **`Copy`** button on the code block (shows *"Copied"* green checkmark).
6. Pause for 4 seconds.

### Phase 6: In-Tolerance Nominal Feature Check (1:40 - 1:55)
1. Scroll back up smoothly.
2. Click **`Main Bore Hole`** on the feature selector chips.
3. Wait for the reading.
4. The gauge updates and the needle animates cleanly into the green safe zone:
   - Badge: **`✓ IN TOLERANCE`**.
   - Deviation: `0.072 µm` (within `±0.100 µm`).
5. Pause for 4 seconds.

### Phase 7: Wrap-Up & Header Highlight (1:55 - 2:00)
1. Move cursor smoothly back up to the top header highlighting:
   - **EchoForge OS**
   - **AWS Bedrock AgentCore · Live Factory Edge**
   - Ready / In Tolerance status pill.
2. Pause for 3 seconds before ending the video.

---

## Ready-to-Run Playwright Script Template

Create `record_demo.js` in `/home/ilyan/amazon/` and run with `node record_demo.js`:

```javascript
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function smoothMove(page, targetX, targetY, steps = 25) {
  // Human-like smooth mouse interpolation
  await page.mouse.move(targetX, targetY, { steps });
}

(async () => {
  const videoDir = path.join(__dirname, 'videos');
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true, // or false if running on display
    args: ['--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();
  console.log('Navigating to EchoForge...');
  await page.goto('https://echoforge.aenox.me', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // 1. Hover header
  await smoothMove(page, 200, 40);
  await page.waitForTimeout(2000);

  // 2. Toggle Hands-Free ON
  const handsFreeBtn = page.getByRole('button', { name: /Hands-Free/i });
  const hfBox = await handsFreeBtn.boundingBox();
  if (hfBox) {
    await smoothMove(page, hfBox.x + hfBox.width / 2, hfBox.y + hfBox.height / 2);
    await page.waitForTimeout(800);
    await handsFreeBtn.click();
    await page.waitForTimeout(2500);
  }

  // 3. Inspect Turbine Blade Root (Out of Tolerance)
  const turbineBtn = page.getByRole('button', { name: /Turbine Blade Root/i });
  const tbBox = await turbineBtn.boundingBox();
  if (tbBox) {
    await smoothMove(page, tbBox.x + tbBox.width / 2, tbBox.y + tbBox.height / 2);
    await page.waitForTimeout(800);
    await turbineBtn.click();
  }

  // Wait for Gauge to appear and animate
  await page.waitForSelector('text=AEROSPACE METROLOGY GAUGE', { timeout: 20000 });
  await page.waitForTimeout(6000); // Let judges absorb the gauge

  // 4. Scroll down to highlight Drift Sparkline
  await page.evaluate(() => window.scrollBy({ top: 250, behavior: 'smooth' }));
  await page.waitForTimeout(4000);

  // 5. Click Retrieve CNC Repair Procedure
  const repairBtn = page.getByRole('button', { name: /Retrieve CNC Repair Procedure/i });
  if (await repairBtn.isVisible()) {
    const rBox = await repairBtn.boundingBox();
    if (rBox) {
      await smoothMove(page, rBox.x + rBox.width / 2, rBox.y + rBox.height / 2);
      await page.waitForTimeout(1000);
      await repairBtn.click();
      await page.waitForTimeout(6000); // Wait for repair script
    }
  }

  // 6. Scroll up and click Main Bore Hole (In Tolerance)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(2000);

  const mainBoreBtn = page.getByRole('button', { name: /Main Bore Hole/i });
  const mbBox = await mainBoreBtn.boundingBox();
  if (mbBox) {
    await smoothMove(page, mbBox.x + mbBox.width / 2, mbBox.y + mbBox.height / 2);
    await page.waitForTimeout(800);
    await mainBoreBtn.click();
    await page.waitForTimeout(6000); // Wait for in-tolerance gauge
  }

  // 7. Final Pan to Top Header
  await smoothMove(page, 960, 40);
  await page.waitForTimeout(3000);

  await context.close();
  await browser.close();
  console.log('Video recording completed in:', videoDir);
})();
```

---

## Instructions for Gemini in Chrome Video Generation
Once the video `.webm` is recorded:
1. Upload the recorded video into your AI video editor (Gemini / Clipchamp / CapCut).
2. Attach the word-for-word narration script from `docs/SETUP.md` or this document.
3. Select a confident, technical AI voice (e.g. "Christopher" or "Jenny" natural tech voice).
4. Export as 1080p MP4.
5. Upload to YouTube as Unlisted/Public and attach to your Devpost submission!
