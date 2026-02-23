const fs = require("fs");
const { chromium } = require("playwright");

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://localhost:5000";
const draftId = process.env.UI_DRAFT_ID || "10";
const leagueId = process.env.UI_LEAGUE_ID || "9";
const outDir = "/workspace/attached_assets/draft-scale-30x1000/ui";

function ensureDir(path) {
  fs.mkdirSync(path, { recursive: true });
}

async function run() {
  ensureDir(outDir);
  const results = [];
  const step = async (name, fn) => {
    const start = Date.now();
    try {
      await fn();
      results.push({ name, status: "PASS", ms: Date.now() - start });
    } catch (error) {
      results.push({ name, status: "FAIL", ms: Date.now() - start, error: String(error) });
      throw error;
    }
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  try {
    await step("login-admin", async () => {
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
      await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 20000 });
      await page.fill('input[type="email"]', "admin@test.local");
      await page.fill('input[type="password"]', "TestPass123!");
      await page.click('[data-testid="button-login"]');
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      if (page.url().includes("/login")) throw new Error("Login did not complete");
      await page.screenshot({ path: `${outDir}/01-home-after-login.png`, fullPage: true });
    });

    await step("open-commissioner-draft-detail", async () => {
      await page.evaluate((lid) => {
        window.localStorage.setItem("selectedLeagueId", String(lid));
      }, leagueId);
      await page.goto(`${baseUrl}/commissioner/drafts/${draftId}`, { waitUntil: "networkidle" });
      await page.locator("body").first().waitFor({ state: "visible", timeout: 20000 });
      await page.waitForTimeout(1500);
      const bodyText = await page.textContent("body");
      if (!bodyText || (!bodyText.includes("Scale Draft") && !bodyText.includes("Draft Results") && !bodyText.includes("Active Draft"))) {
        throw new Error("Commissioner draft detail page did not render expected content");
      }
      await page.screenshot({ path: `${outDir}/02-commissioner-draft-detail.png`, fullPage: true });
    });

    await step("open-draft-board", async () => {
      await page.goto(`${baseUrl}/draft/${draftId}`, { waitUntil: "networkidle" });
      await page.locator("body").first().waitFor({ state: "visible", timeout: 20000 });
      await page.waitForTimeout(1500);
      const bodyText = await page.textContent("body");
      if (!bodyText || bodyText.length < 200 || bodyText.includes("Page Not Found") || bodyText.includes("Failed to fetch")) {
        throw new Error("Draft board page did not render expected content");
      }
      await page.screenshot({ path: `${outDir}/03-draft-board.png`, fullPage: true });
    });
  } finally {
    await browser.close();
    fs.writeFileSync(`${outDir}/results.json`, JSON.stringify(results, null, 2), "utf8");
    console.log(JSON.stringify(results, null, 2));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
