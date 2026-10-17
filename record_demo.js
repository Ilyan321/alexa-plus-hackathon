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
  // Sort files by mtime to get the most recent one
  const sortedWebm = files
    .map(f => ({ name: f, time: fs.statSync(path.join(videoDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  const latestWebm = path.join(videoDir, sortedWebm[0].name);
  const outputMp4 = path.join(videoDir, 'echoforge_demo.mp4');

  console.log(`🎬 Converting ${latestWebm} to MP4 using ffmpeg...`);
  execSync(`ffmpeg -y -i "${latestWebm}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 "${outputMp4}"`, { stdio: 'inherit' });

  console.log(`✅ Success! High-definition MP4 demo video created at:\n   ${outputMp4}`);
})();
