const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('selectedLeagueId', '3'));

  await page.goto('http://localhost:5000/', { waitUntil: 'commit' });
  await page.fill('input[type="email"]', 'owner1@test.local');
  await page.fill('input[type="password"]', 'TestPass123!');
  await page.click('[data-testid="button-login"]');
  await page.waitForLoadState('networkidle');

  await page.goto('http://localhost:5000/draft/4', { waitUntil: 'commit' });

  const draftName = await page.locator('[data-testid="text-draft-name"]').first().textContent();
  const draftStatus = await page.locator('[data-testid="badge-draft-status"]').first().textContent();
  const rosterTypeSelectors = await page.locator('[data-testid="select-auto-draft-roster-type"]').count();
  const autoDraftTitleCount = await page.locator('text=Auto-Draft List').count();

  console.log(JSON.stringify({
    url: page.url(),
    draftName,
    draftStatus,
    rosterTypeSelectors,
    autoDraftTitleCount,
  }, null, 2));

  await page.screenshot({ path: '/workspace/attached_assets/ui-owner-autodraft/probe.png', fullPage: true });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
