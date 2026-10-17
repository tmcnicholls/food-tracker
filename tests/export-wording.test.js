// Confirms unconfirmed meal suggestions export as plain text (no
// "(suggested — not yet confirmed)" annotation) while skipped meals still
// say "Skipped" — a deliberate deviation from the PRD's original FR-07/
// AC-14 wording, by explicit product decision.
//
// Run directly: node tests/export-wording.test.js

const { chromium } = require('playwright');
const assert = require('assert');
const { startServer } = require('./helpers/static-server');
const { createChecker } = require('./helpers/check-runner');
const { REPO_ROOT } = require('./helpers/app-files');

(async () => {
  const { url, close } = await startServer(REPO_ROOT);
  const { check, summary } = createChecker();

  const browser = await chromium.launch();
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.goto(`${url}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#generate-btn');
  await page.waitForSelector('details.day');

  await check('unconfirmed meals export plainly, with no "(suggested — not yet confirmed)" annotation', async () => {
    // Leave everything unconfirmed except skip one meal, then export.
    await page.click('details.day[data-day-index="1"] summary');
    await page.click('details.day[data-day-index="1"] .meal-row[data-meal-key="lunch"] .skip-btn');
    await page.click('#copy-btn');
    await page.waitForTimeout(150);
    const text = await page.evaluate(() => navigator.clipboard.readText());

    assert.ok(!text.includes('suggested'), 'export text should never mention "suggested"');
    assert.ok(!text.includes('not yet confirmed'), 'export text should never mention "not yet confirmed"');
    assert.ok(text.includes('Skipped'), 'skipped meals should still say Skipped');
    assert.ok(/Breakfast: [A-Z]/.test(text), 'unconfirmed meals should still print their plain text');
  });

  await browser.close();
  await close();
  process.exit(summary() ? 0 : 1);
})();
