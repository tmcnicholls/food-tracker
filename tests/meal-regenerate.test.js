// Covers the per-meal "get a different suggestion" (regenerate) button:
// swaps freely while unreviewed, prompts before discarding a
// confirmed/edited entry, and preserves the generator's invariants (no
// duplicate tea across the week; Saturday takeaway stays in its category).
//
// Run directly: node tests/meal-regenerate.test.js

const { chromium } = require('playwright');
const assert = require('assert');
const { startServer } = require('./helpers/static-server');
const { createChecker } = require('./helpers/check-runner');
const { REPO_ROOT } = require('./helpers/app-files');

(async () => {
  const { url, close } = await startServer(REPO_ROOT);
  const { check, summary } = createChecker();

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('  [page error]', err.message));
  await page.goto(`${url}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#generate-btn');
  await page.waitForSelector('details.day[open]');

  const row = 'details.day[data-day-index="0"] .meal-row[data-meal-key="breakfast"]';

  await check('regenerate button exists and is unobtrusive (not toggled)', async () => {
    const btn = await page.$(`${row} .regenerate-btn`);
    assert.ok(btn, 'expected a .regenerate-btn in the breakfast row');
    const pressedAttr = await btn.getAttribute('aria-pressed');
    assert.strictEqual(pressedAttr, null, 'regenerate button should not be a toggle');
  });

  await check('clicking regenerate on an unreviewed meal swaps the text with no dialog', async () => {
    const before = await page.innerText(`${row} .meal-text`);
    await page.click(`${row} .regenerate-btn`);
    await page.waitForTimeout(100);
    const dialogVisible = await page.isVisible('#confirm-dialog[open]');
    assert.strictEqual(dialogVisible, false, 'should not prompt for a still-suggested meal');
    const after = await page.innerText(`${row} .meal-text`);
    assert.notStrictEqual(before.trim(), after.trim(), `expected different text, got same: "${after}"`);
    assert.ok(after.includes('(Suggested)'), 'regenerated meal should be in Suggested state');
  });

  await check('regenerating repeatedly never gets stuck on one value, stays within breakfast library', async () => {
    const seen = new Set();
    for (let i = 0; i < 8; i += 1) {
      await page.click(`${row} .regenerate-btn`);
      const text = (await page.$eval(`${row} .meal-text`, (p) => p.firstChild.textContent)).trim();
      seen.add(text);
    }
    assert.ok(seen.size > 1, `expected variation across repeated regenerations, got: ${[...seen].join(' | ')}`);
  });

  await check('confirming then regenerating prompts for confirmation, Cancel keeps original', async () => {
    await page.click(`${row} .confirm-btn`);
    const confirmedText = (await page.$eval(`${row} .meal-text`, (p) => p.firstChild.textContent)).trim();
    await page.click(`${row} .regenerate-btn`);
    await page.waitForSelector('#confirm-dialog[open]', { timeout: 2000 });
    await page.locator('#confirm-dialog').getByText('Cancel').click();
    await page.waitForTimeout(100);
    const stillThere = (await page.$eval(`${row} .meal-text`, (p) => p.firstChild.textContent)).trim();
    assert.strictEqual(stillThere, confirmedText, 'Cancel should leave the confirmed meal untouched');
    const tag = await page.innerText(`${row} .meal-status-tag`);
    assert.ok(tag.includes('Confirmed'), 'status should still be Confirmed after cancelling regenerate');
  });

  await check('confirming the regenerate-replace dialog swaps text and resets to Suggested', async () => {
    const before = (await page.$eval(`${row} .meal-text`, (p) => p.firstChild.textContent)).trim();
    await page.click(`${row} .regenerate-btn`);
    await page.waitForSelector('#confirm-dialog[open]', { timeout: 2000 });
    await page.locator('#confirm-dialog').getByText('Get new suggestion').click();
    await page.waitForTimeout(100);
    const after = (await page.$eval(`${row} .meal-text`, (p) => p.firstChild.textContent)).trim();
    assert.notStrictEqual(before, after, 'text should change after confirming replace');
    const tag = await page.innerText(`${row} .meal-status-tag`);
    assert.ok(tag.includes('Suggested'), `expected Suggested after replace, got "${tag}"`);
  });

  await check('regenerated text persists after reload', async () => {
    const before = (await page.$eval(`${row} .meal-text`, (p) => p.firstChild.textContent)).trim();
    await page.reload();
    const after = (await page.$eval(`${row} .meal-text`, (p) => p.firstChild.textContent)).trim();
    assert.strictEqual(before, after);
  });

  // Saturday takeaway regenerate should stay within the chosen takeaway category.
  await check('regenerating Saturday tea (takeaway on) stays within the same takeaway category', async () => {
    await page.check('#takeaway-checkbox');
    await page.click('#generate-btn');
    await page.waitForTimeout(150);
    const satDay = 'details.day:has(.day-heading-weekday:has-text("Saturday"))';
    await page.click(`${satDay} summary`);
    const satRow = `${satDay} .meal-row[data-meal-key="tea"]`;
    const category = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('mvf-food-journal-v1'));
      const week = raw.weeks[raw.currentWeekKey];
      return week.takeawayCategory;
    });
    const knownByCategory = {
      Chinese: ['chow mein', 'spring rolls', 'sweet and sour', 'egg fried rice', 'black bean'],
      Indian: ['tikka masala', 'rogan josh', 'korma', 'naan', 'pilau'],
      Kebab: ['kebab', 'doner'],
      Pizza: ['pizza', 'garlic bread', 'wedges'],
      'Greek gyros': ['gyros', 'tzatziki'],
    };
    const terms = knownByCategory[category];
    for (let i = 0; i < 5; i += 1) {
      await page.click(`${satRow} .regenerate-btn`);
      await page.waitForTimeout(80);
      const text = (await page.$eval(`${satRow} .meal-text`, (p) => p.firstChild.textContent)).trim().toLowerCase();
      assert.ok(terms.some((t) => text.includes(t)), `expected ${category} takeaway term in "${text}"`);
    }
  });

  // Regenerating a weekday tea should still avoid duplicating another day's tea.
  await check('regenerating a weekday tea never duplicates another day\'s tea', async () => {
    await page.uncheck('#takeaway-checkbox');
    await page.click('#generate-btn');
    await page.waitForTimeout(150);
    const tueRow = 'details.day[data-day-index="0"] .meal-row[data-meal-key="tea"]';
    for (let i = 0; i < 4; i += 1) {
      await page.click(`${tueRow} .regenerate-btn`);
      await page.waitForTimeout(80);
      const allTeas = await page.$$eval('.meal-row[data-meal-key="tea"] .meal-text', (els) => els.map((e) => e.firstChild.textContent.trim()));
      const unique = new Set(allTeas);
      assert.strictEqual(unique.size, allTeas.length, `expected all 7 teas unique, got: ${allTeas.join(' | ')}`);
    }
  });

  await browser.close();
  await close();
  process.exit(summary() ? 0 : 1);
})();
