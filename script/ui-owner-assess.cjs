const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://localhost:5000";
const draftId = process.env.UI_DRAFT_ID || "12";
const leagueId = process.env.UI_LEAGUE_ID || "11";
const ownerEmail = process.env.UI_OWNER_EMAIL || "owner1@test.local";
const ownerPassword = process.env.UI_OWNER_PASSWORD || "TestPass123!";
const outDir = "/workspace/attached_assets/ui-owner-assess";

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript((id) => {
    window.localStorage.setItem("selectedLeagueId", String(id));
  }, leagueId);

  async function step(name, fn) {
    const started = Date.now();
    try {
      await fn();
      results.push({ name, status: "PASS", ms: Date.now() - started });
    } catch (e) {
      results.push({ name, status: "FAIL", ms: Date.now() - started, error: String(e && e.message ? e.message : e) });
      throw e;
    }
  }

  try {
    await step("login-owner", async () => {
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
      await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 20000 });
      await page.locator('input[type="password"]').first().waitFor({ state: "visible", timeout: 20000 });
      await page.fill('input[type="email"]', ownerEmail);
      await page.fill('input[type="password"]', ownerPassword);
      await page.click('[data-testid="button-login"]');
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${outDir}/01-owner-home.png`, fullPage: true });
    });

    await step("open-drafts", async () => {
      await page.goto(`${baseUrl}/drafts`, { waitUntil: "networkidle" });
      await page.locator('[data-testid="text-drafts-title"]').waitFor({ state: "visible", timeout: 15000 });
      await page.screenshot({ path: `${outDir}/02-owner-drafts.png`, fullPage: true });
    });

    await step("open-draft-board", async () => {
      await page.goto(`${baseUrl}/draft/${draftId}`, { waitUntil: "networkidle" });
      const ok = await page.locator('[data-testid="text-draft-name"]').first().isVisible().catch(() => false);
      if (!ok) throw new Error("Draft board did not render for owner");
      await page.screenshot({ path: `${outDir}/03-owner-draft-board.png`, fullPage: true });
    });
  } finally {
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close();
    console.log(JSON.stringify(results, null, 2));
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
