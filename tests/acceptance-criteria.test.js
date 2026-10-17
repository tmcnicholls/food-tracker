// Exercises the PRD's acceptance criteria (section 9) end-to-end against a
// real Chromium via Playwright — generation, editing, confirmation, RAG
// status, Saturday takeaway, copy-to-clipboard export, and persistence.
//
// Run directly: node tests/acceptance-criteria.test.js
// Or as part of the full suite: npm test

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
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('  [console error]', msg.text()); });
  page.on('pageerror', (err) => console.log('  [page error]', err.message));

  await page.goto(`${url}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // --- AC-03: Great selected by default on a fresh load ---
  await check('AC-03 Great is selected by default', async () => {
    const pressed = await page.getAttribute('.seg-btn[data-profile="great"]', 'aria-pressed');
    assert.strictEqual(pressed, 'true');
  });

  // --- AC-01: generate with default settings -> Tue..Mon, 4 meal categories/day ---
  await check('AC-01 generate default week: Tuesday -> Monday, 7 days x 4 meals', async () => {
    await page.click('#generate-btn');
    await page.waitForSelector('details.day');
    const days = await page.$$eval('details.day', (els) => els.map((d) => ({
      weekday: d.querySelector('.day-heading-weekday').textContent.trim(),
      mealLabels: Array.from(d.querySelectorAll('.meal-label')).map((m) => m.textContent.trim()),
    })));
    assert.strictEqual(days.length, 7, 'expected 7 days');
    assert.ok(days[0].weekday.includes('Tuesday'), `first day should be Tuesday, got ${days[0].weekday}`);
    assert.ok(days[6].weekday.includes('Monday'), `last day should be Monday, got ${days[6].weekday}`);
    days.forEach((d, i) => {
      assert.deepStrictEqual(d.mealLabels, ['Breakfast', 'Lunch', 'Tea', 'Snacks'], `day ${i} categories`);
    });
  });

  // --- AC-08: new days are unassessed, not auto-green ---
  await check('AC-08 new days start unassessed (not auto-green)', async () => {
    const statuses = await page.$$eval('details.day .day-heading-date', (els) => els.map((e) => e.textContent));
    assert.ok(statuses.every((s) => s.includes('Not yet reviewed')), 'all days should be unassessed initially');
  });

  // --- AC-13: no calorie totals/macro/weight-loss claims anywhere on the page
  // (mentioning "no calorie counting" as a product principle is fine; the
  // check is for actual calorie/macro VALUES or goals, not the word itself) ---
  await check('AC-13 no calorie totals/macro values/goals on page', async () => {
    const bodyText = await page.innerText('body');
    assert.ok(!/\d+\s*(kcal|calories?)\b/i.test(bodyText), 'found a calorie number/total');
    assert.ok(!/\bmacro(s)?\b/i.test(bodyText), 'found macro tracking language');
    assert.ok(!/\bbmi\b/i.test(bodyText), 'found BMI language');
    assert.ok(!/weight[- ]loss target/i.test(bodyText), 'found a weight-loss target');
  });

  // --- AC-07: edit a meal, refresh, edit persists ---
  await check('AC-07 edited meal text persists after refresh', async () => {
    const firstRow = await page.$('details.day .meal-row[data-meal-key="breakfast"]');
    await firstRow.$eval('.edit-btn', (b) => b.click());
    const input = await firstRow.$('[data-role="input"]');
    await input.fill('Custom test breakfast');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await page.reload();
    const text = await page.$eval('details.day .meal-row[data-meal-key="breakfast"] .meal-text', (p) => p.textContent);
    assert.ok(text.includes('Custom test breakfast'), `expected edited text to persist, got "${text}"`);
  });

  // --- AC-14: unconfirmed suggestion is clearly marked, not silently verified ---
  await check('AC-14 unconfirmed meal is tagged "(Suggested)" in UI', async () => {
    const tag = await page.$eval('details.day .meal-row[data-meal-key="lunch"] .meal-status-tag', (s) => s.textContent);
    assert.ok(tag.includes('Suggested'), `expected Suggested tag, got "${tag}"`);
  });

  // confirm breakfast, skip lunch, confirm tea, confirm snacks on day 0 so we can test green-day gating and export formatting.
  // Each click fully re-renders #journal (renderJournal() replaces its innerHTML), which detaches any
  // previously-queried element handle — so re-query via `page.click(selector)` fresh each time rather
  // than reusing a cached handle across multiple state-mutating clicks.
  await check('setup: confirm/skip meals on day 0', async () => {
    const day0 = 'details.day[data-day-index="0"]';
    await page.click(`${day0} .meal-row[data-meal-key="breakfast"] .confirm-btn`);
    await page.click(`${day0} .meal-row[data-meal-key="lunch"] .skip-btn`);
    await page.click(`${day0} .meal-row[data-meal-key="tea"] .confirm-btn`);
    await page.click(`${day0} .meal-row[data-meal-key="snacks"] .confirm-btn`);
    const tags = await page.$$eval(`${day0} .meal-status-tag`, (els) => els.map((e) => e.textContent));
    assert.deepStrictEqual(tags, ['(Confirmed)', '(Skipped)', '(Confirmed)', '(Confirmed)']);
  });

  // --- day status green now allowed without extra dialog since all 4 reviewed ---
  await check('AC-08b day can be marked green once all 4 meals reviewed', async () => {
    const day0 = 'details.day[data-day-index="0"]';
    await page.click(`${day0} .status-btn[data-status="green"]`);
    await page.waitForTimeout(100);
    const label = await page.$eval(`${day0} .day-heading-date`, (e) => e.textContent);
    assert.ok(label.includes('Green'), `expected Green status, got "${label}"`);
  });

  // --- AC-05: Saturday takeaway ---
  await check('AC-05 Saturday takeaway produces a supported category + description', async () => {
    await page.check('#takeaway-checkbox');
    await page.click('#generate-btn'); // same week -> protected (day0 confirmed) -> dialog appears
    const dialog = page.locator('#confirm-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 2000 });
    await dialog.getByText('Replace week').click();
    await page.waitForTimeout(150);
    const saturdayTea = await page.$eval('details.day:has(.day-heading-weekday:has-text("Saturday")) .meal-row[data-meal-key="tea"] .meal-text', (p) => p.textContent);
    const knownTakeaways = [
      'chow mein', 'spring rolls', 'sweet and sour', 'egg fried rice', 'black bean',
      'tikka masala', 'rogan josh', 'korma', 'naan',
      'kebab', 'doner',
      'pizza', 'garlic bread', 'wedges',
      'gyros', 'tzatziki',
    ];
    const lower = saturdayTea.toLowerCase();
    assert.ok(knownTakeaways.some((k) => lower.includes(k)), `Saturday tea "${saturdayTea}" doesn't look like a takeaway`);
  });

  // --- AC-06: takeaway category can vary across regenerations ---
  await check('AC-06 takeaway selection varies across multiple generations', async () => {
    const seen = new Set();
    for (let i = 0; i < 12; i += 1) {
      await page.click('#generate-btn');
      const dialog = page.locator('#confirm-dialog');
      try {
        await dialog.waitFor({ state: 'visible', timeout: 500 });
        await dialog.getByText('Replace week').click();
      } catch { /* no protected entries this round, dialog didn't open */ }
      await page.waitForTimeout(80);
      const saturdayTea = await page.$eval('details.day:has(.day-heading-weekday:has-text("Saturday")) .meal-row[data-meal-key="tea"] .meal-text', (p) => p.textContent);
      seen.add(saturdayTea.trim());
    }
    assert.ok(seen.size > 1, `expected variation across generations, got only: ${[...seen].join(' | ')}`);
  });

  // --- AC-09: Copy journal copies readable plain text with days/dates/emoji/4 categories ---
  await check('AC-09 Copy journal puts correctly formatted text on the clipboard', async () => {
    // AC-06's regenerate loop above reset every day back to unassessed —
    // mark day 0 amber so this check can verify assessed-vs-unassessed
    // emoji behaviour (see the next check).
    await page.click('details.day[data-day-index="0"] .status-btn[data-status="amber"]');
    await page.waitForTimeout(80);

    await page.click('#copy-btn');
    await page.waitForTimeout(150);
    const feedback = await page.innerText('#copy-feedback');
    assert.ok(feedback.includes('Copied'), `expected copy success feedback, got "${feedback}"`);
    const clipText = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(clipText.startsWith('MAN v FAT — Weekly Food Journal'), 'missing header');
    assert.ok(clipText.includes('Week:'), 'missing week range line');
    ['Breakfast:', 'Lunch:', 'Tea:', 'Snacks:'].forEach((label) => {
      assert.ok(clipText.includes(label), `missing ${label} in export`);
    });
  });

  // --- unassessed days must not show the ⚪ (or any) status emoji in the export ---
  await check('unassessed days have no status emoji in the export; scored days still do', async () => {
    const clipText = await page.evaluate(() => navigator.clipboard.readText());
    const lines = clipText.split('\n');
    const tuesdayLine = lines.find((l) => l.startsWith('Tuesday '));
    assert.ok(tuesdayLine && tuesdayLine.includes('🟠'), `expected the amber day's line to include 🟠, got "${tuesdayLine}"`);
    const wednesdayLine = lines.find((l) => l.startsWith('Wednesday '));
    assert.ok(wednesdayLine, 'expected a Wednesday line in the export');
    assert.ok(!/🟢|🟠|🔴|⚪/.test(wednesdayLine), `expected no status emoji on an unassessed day's line, got "${wednesdayLine}"`);
  });

  // --- AC-02: change week start to Monday -> Monday..Sunday ---
  await check('AC-02 changing start weekday to Monday generates Monday->Sunday', async () => {
    await page.selectOption('#start-weekday', 'Monday');
    await page.waitForTimeout(80);
    await page.click('#generate-btn');
    await page.waitForTimeout(80);
    const days = await page.$$eval('details.day .day-heading-weekday', (els) => els.map((e) => e.textContent));
    assert.ok(days[0].includes('Monday'), `first day should be Monday, got ${days[0]}`);
    assert.ok(days[6].includes('Sunday'), `last day should be Sunday, got ${days[6]}`);
  });

  // --- AC-04: Medium profile changes meals, not date range ---
  await check('AC-04 switching profile keeps date range, generation still works', async () => {
    const rangeBefore = await page.innerText('#week-range');
    await page.click('.seg-btn[data-profile="medium"]');
    await page.click('#generate-btn');
    await page.waitForTimeout(80);
    const rangeAfter = await page.innerText('#week-range');
    assert.strictEqual(rangeBefore, rangeAfter, 'date range should not change when switching profile');
  });

  // --- AC-10: starting a new week preserves the old one ---
  await check('AC-10 starting a new week keeps the previous week selectable', async () => {
    const before = await page.$eval('#week-picker', (s) => s.value);
    await page.click('#new-week-btn');
    await page.waitForTimeout(80);
    const options = await page.$$eval('#week-picker option', (els) => els.map((o) => o.value));
    assert.ok(options.includes(before), `expected previous week ${before} to still be listed: ${options.join(',')}`);
  });

  // --- Local storage availability / persistence sanity ---
  await check('general: localStorage actually contains saved state', async () => {
    const raw = await page.evaluate(() => localStorage.getItem('mvf-food-journal-v1'));
    assert.ok(raw && raw.length > 50, 'expected non-trivial saved state in localStorage');
  });

  await browser.close();
  await close();
  process.exit(summary() ? 0 : 1);
})();
