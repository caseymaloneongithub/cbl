const fs = require('fs');
const { chromium } = require('playwright');

const baseUrl = process.env.UI_SMOKE_BASE_URL || 'http://localhost:5000';
const leagueId = process.env.UI_LEAGUE_ID || '3';
const draftId = process.env.UI_DRAFT_ID || '4';
const email = process.env.UI_OWNER_EMAIL || 'owner1@test.local';
const password = process.env.UI_OWNER_PASSWORD || 'TestPass123!';
const outDir = '/workspace/attached_assets/ui-owner-autodraft';

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript((id) => localStorage.setItem('selectedLeagueId', String(id)), leagueId);

  async function step(name, fn) {
    const started = Date.now();
    try {
      await fn();
      results.push({ name, status: 'PASS', ms: Date.now() - started });
    } catch (e) {
      results.push({ name, status: 'FAIL', ms: Date.now() - started, error: String(e && e.message ? e.message : e) });
      throw e;
    }
  }

  try {
    await step('login-owner', async () => {
      await page.goto(`${baseUrl}/`, { waitUntil: 'commit' });
      await page.locator('input[type="email"]').first().waitFor({ state: 'visible', timeout: 20000 });
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('[data-testid="button-login"]');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${outDir}/01-home.png`, fullPage: true });
    });

    await step('open-draft-board', async () => {
      await page.goto(`${baseUrl}/draft/${draftId}`, { waitUntil: 'commit' });
      await page.locator('[data-testid="text-draft-name"]').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.screenshot({ path: `${outDir}/02-draft-board.png`, fullPage: true });
    });

    await step('set-queue-roster-type', async () => {
      const select = page.locator('[data-testid="select-auto-draft-roster-type"]').first();
      await select.waitFor({ state: 'visible', timeout: 15000 });
      await select.click();
      await page.locator('[role="option"]', { hasText: 'Queue as MiLB' }).first().click();
    });

    await step('add-two-players-to-queue', async () => {
      const addButtons = page.locator('[data-testid^="button-auto-draft-add-"]');
      const count = await addButtons.count();
      if (count < 2) throw new Error(`expected at least 2 add buttons, got ${count}`);
      await addButtons.nth(0).click();
      await page.waitForTimeout(300);
      await addButtons.nth(1).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${outDir}/03-after-add.png`, fullPage: true });
    });

    await step('reorder-and-remove', async () => {
      const downButtons = page.locator('[data-testid^="button-auto-draft-down-"]');
      const removeButtons = page.locator('[data-testid^="button-auto-draft-remove-"]');
      if ((await downButtons.count()) > 0) {
        await downButtons.nth(0).click();
        await page.waitForTimeout(300);
      }
      if ((await removeButtons.count()) > 0) {
        await removeButtons.nth(0).click();
        await page.waitForTimeout(300);
      }
      await page.screenshot({ path: `${outDir}/04-after-reorder-remove.png`, fullPage: true });
    });
  } finally {
    fs.writeFileSync(`${outDir}/results.json`, JSON.stringify(results, null, 2));
    await browser.close();
    console.log(JSON.stringify(results, null, 2));
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
