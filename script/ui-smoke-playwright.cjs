const fs = require("fs");
const { chromium } = require("playwright");

const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://localhost:5000";
const outDir = "/workspace/attached_assets/ui-smoke";

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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await step("open_login", async () => {
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
      await page.locator('input[type="email"]').first().waitFor({ state: "visible", timeout: 15000 });
      await page.locator('input[type="password"]').first().waitFor({ state: "visible", timeout: 15000 });
      await page.screenshot({ path: `${outDir}/01-login-page.png`, fullPage: true });
    });

    await step("login_admin", async () => {
      await page.fill('input[type="email"]', "admin@test.local");
      await page.fill('input[type="password"]', "TestPass123!");
      await page.click('[data-testid="button-login"]');
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
      if (page.url().includes("/login")) {
        throw new Error(`still on login page: ${page.url()}`);
      }
      await page.screenshot({ path: `${outDir}/02-after-login.png`, fullPage: true });
    });

    await step("open_drafts", async () => {
      await page.goto(`${baseUrl}/drafts`, { waitUntil: "networkidle" });
      await page.locator("body").first().waitFor({ state: "visible", timeout: 15000 });
      await page.screenshot({ path: `${outDir}/03-drafts-page.png`, fullPage: true });
    });

    await step("open_commissioner_draft", async () => {
      await page.goto(`${baseUrl}/commissioner/draft`, { waitUntil: "networkidle" });
      await page.locator('[data-testid="button-create-draft"]').first().waitFor({ state: "visible", timeout: 15000 });
      await page.screenshot({ path: `${outDir}/04-commissioner-draft-page.png`, fullPage: true });
    });

    await step("open_create_draft_dialog", async () => {
      await page.click('[data-testid="button-create-draft"]');
      await page.locator('[data-testid="input-draft-name"]').first().waitFor({ state: "visible", timeout: 15000 });
      await page.fill('[data-testid="input-draft-name"]', `UI Smoke ${Date.now()}`);
      await page.fill('[data-testid="input-draft-team-round"]', "2");
      await page.screenshot({ path: `${outDir}/05-create-draft-dialog.png`, fullPage: true });
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
