// Covers the "Share with your team" image export: the name field, two
// 1080x1920 PNGs covering days 1–4 and 5–7, the share sheet being handed
// ready-made files, the long-press/download fallback where file sharing
// isn't supported, stale previews being cleared after an edit, and long
// meal text shrinking to fit rather than running off the image.
//
// navigator.share/canShare are stubbed — Playwright's Chromium can't open
// a real share sheet, and the iOS share sheet itself needs checking on a
// physical iPhone.
//
// Run directly: node tests/share-images.test.js

const { chromium } = require('playwright');
const assert = require('assert');
const { startServer } = require('./helpers/static-server');
const { createChecker } = require('./helpers/check-runner');
const { REPO_ROOT } = require('./helpers/app-files');

// Records share() calls instead of opening a share sheet.
function stubFileSharing() {
  window.__sharedCalls = [];
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: (data) => !!(data && data.files && data.files.length),
  });
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: async (data) => {
      window.__sharedCalls.push(await Promise.all(data.files.map(async (f) => ({
        name: f.name, type: f.type, size: f.size,
        isPng: new Uint8Array(await f.slice(0, 4).arrayBuffer()).join(',') === '137,80,78,71',
      }))));
    },
  });
}

function removeFileSharing() {
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
}

async function freshPage(browser, url, initScript) {
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('  [page error]', err.message));
  await page.addInitScript(initScript);
  await page.goto(`${url}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#generate-btn');
  await page.waitForSelector('details.day');
  return page;
}

async function waitForPreviewImages(page) {
  await page.waitForSelector('#share-preview:not(.hidden)');
  await page.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll('#share-preview-images img'));
    return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
  });
}

(async () => {
  const { url, close } = await startServer(REPO_ROOT);
  const { check, summary } = createChecker();
  const browser = await chromium.launch();

  const page = await freshPage(browser, url, stubFileSharing);

  await check('creating images without a name asks for one and shows no preview', async () => {
    await page.click('#create-images-btn');
    const feedback = await page.innerText('#share-feedback');
    assert.ok(/name/i.test(feedback), `expected a prompt for a name, got "${feedback}"`);
    assert.ok(await page.isHidden('#share-preview'), 'preview should stay hidden');
    const focused = await page.evaluate(() => document.activeElement?.id);
    assert.strictEqual(focused, 'share-name', 'name field should be focused');
  });

  await check('name persists across a reload and survives regenerating the plan', async () => {
    await page.fill('#share-name', 'Terry M');
    await page.reload();
    assert.strictEqual(await page.inputValue('#share-name'), 'Terry M');
    // Regenerating used to rebuild preferences from scratch, dropping
    // anything it didn't know about (theme, and now the name).
    await page.click('#generate-btn');
    await page.waitForSelector('details.day');
    await page.reload();
    assert.strictEqual(await page.inputValue('#share-name'), 'Terry M');
  });

  await check('creates two 1080x1920 preview images with descriptive alt text', async () => {
    await page.click('#create-images-btn');
    await waitForPreviewImages(page);
    const imgs = await page.$$eval('#share-preview-images img', (els) => els.map((img) => ({
      w: img.naturalWidth, h: img.naturalHeight, alt: img.alt,
    })));
    assert.strictEqual(imgs.length, 2, 'expected two images');
    imgs.forEach((img) => {
      assert.strictEqual(img.w, 1080);
      assert.strictEqual(img.h, 1920);
      assert.ok(img.alt.includes('Terry M'), `alt text should name the person: ${img.alt}`);
    });
    assert.ok(imgs[0].alt.includes('Days 1–4 of 7'), imgs[0].alt);
    assert.ok(imgs[1].alt.includes('Days 5–7 of 7'), imgs[1].alt);
    assert.ok(await page.isVisible('#share-images-btn'), 'share button should show when file sharing is supported');
    assert.ok(await page.isHidden('#share-download-links'), 'download links are only for the fallback');
  });

  await check('share button hands the share sheet two named PNG files', async () => {
    await page.click('#share-images-btn');
    await page.waitForFunction(() => window.__sharedCalls.length === 1);
    const [files] = await page.evaluate(() => window.__sharedCalls);
    const startDate = await page.inputValue('#start-date');
    assert.deepStrictEqual(files.map((f) => f.name), [
      `food-journal-${startDate}-1-of-2.png`,
      `food-journal-${startDate}-2-of-2.png`,
    ]);
    files.forEach((f) => {
      assert.strictEqual(f.type, 'image/png');
      assert.ok(f.isPng, 'file should contain real PNG data');
      assert.ok(f.size > 10_000, `image looks empty (${f.size} bytes)`);
    });
  });

  await check('editing the journal clears the now-stale preview', async () => {
    await page.click('details.day[data-day-index="0"] .meal-row[data-meal-key="breakfast"] .confirm-btn');
    assert.ok(await page.isHidden('#share-preview'), 'preview should be cleared after an edit');
    await page.click('#create-images-btn');
    await waitForPreviewImages(page);
    await page.fill('#share-name', 'Terry McN');
    assert.ok(await page.isHidden('#share-preview'), 'preview should be cleared after a name change');
  });

  await check('image content follows the text export rules (status, skipped, unreviewed)', async () => {
    // Review every meal first so marking the day green doesn't prompt.
    const day0 = 'details.day[data-day-index="0"]';
    await page.click(`${day0} .meal-row[data-meal-key="lunch"] .skip-btn`);
    await page.click(`${day0} .meal-row[data-meal-key="tea"] .confirm-btn`);
    await page.click(`${day0} .meal-row[data-meal-key="snacks"] .confirm-btn`);
    await page.click(`${day0} .status-green`);
    const pages = await page.evaluate(async () => {
      const { buildPages } = await import('./js/shareImage.js');
      const state = JSON.parse(localStorage.getItem('mvf-food-journal-v1'));
      return buildPages(state.weeks[state.currentWeekKey], { name: '  Terry  ' });
    });
    assert.strictEqual(pages.length, 2);
    assert.deepStrictEqual(pages.map((p) => p.days.length), [4, 3]);
    assert.strictEqual(pages[0].name, 'Terry', 'name should be trimmed');
    assert.ok(pages[0].days[0].heading.startsWith('Tuesday'), pages[0].days[0].heading);
    assert.ok(pages[1].days[2].heading.startsWith('Monday'), pages[1].days[2].heading);
    assert.strictEqual(pages[0].days[0].status.label, 'On track');
    assert.strictEqual(pages[0].days[1].status, null, 'unreviewed days show no status');
    const lunch = pages[0].days[0].meals[1];
    assert.deepStrictEqual([lunch.label, lunch.text, lunch.skipped], ['Lunch', 'Skipped', true]);
    const allText = JSON.stringify(pages);
    assert.ok(!/suggested|not yet confirmed/i.test(allText), 'no "suggested" wording');
    assert.ok(!/\b\d+\s*(k?cal|calories)\b/i.test(allText), 'no calorie values (AC-13)');
  });

  await check('very long meal text shrinks the layout to fit instead of overflowing', async () => {
    const results = await page.evaluate(async () => {
      const { renderWeekImages } = await import('./js/shareImage.js');
      const state = JSON.parse(localStorage.getItem('mvf-food-journal-v1'));
      const week = structuredClone(state.weeks[state.currentWeekKey]);
      const long = 'Homemade chicken and vegetable stir-fry with egg noodles, spring onions, peppers and a soy and ginger sauce';
      week.days.forEach((day) => Object.values(day.meals).forEach((meal) => {
        meal.text = long; meal.status = 'confirmed';
      }));
      const typical = renderWeekImages(state.weeks[state.currentWeekKey], { name: 'Terry' });
      const stressed = renderWeekImages(week, { name: 'Terry' });
      week.days.forEach((day) => Object.values(day.meals).forEach((meal) => { meal.text = long.repeat(6); }));
      const huge = renderWeekImages(week, { name: 'Terry' });
      const info = (r) => r.map(({ canvas, scale, maxLines, fits }) => ({
        w: canvas.width, h: canvas.height, scale, maxLines, fits,
      }));
      return { typical: info(typical), stressed: info(stressed), huge: info(huge) };
    });
    [...results.typical, ...results.stressed, ...results.huge].forEach((r) => {
      assert.strictEqual(r.w, 1080);
      assert.strictEqual(r.h, 1920);
      assert.ok(r.fits, `page should fit: ${JSON.stringify(r)}`);
    });
    assert.ok(results.typical[0].scale >= 0.7, `typical week should stay readable, got scale ${results.typical[0].scale}`);
    assert.ok(results.stressed[0].scale < results.typical[0].scale || results.stressed[0].maxLines < 3,
      'long text should shrink the layout');
  });

  await page.close();

  const fallbackPage = await freshPage(browser, url, removeFileSharing);

  await check('without file sharing, falls back to long-press hint and download links', async () => {
    await fallbackPage.fill('#share-name', 'Terry M');
    await fallbackPage.click('#create-images-btn');
    await waitForPreviewImages(fallbackPage);
    assert.ok(await fallbackPage.isHidden('#share-images-btn'), 'share button should be hidden');
    const hint = await fallbackPage.innerText('#share-longpress-hint');
    assert.ok(/press and hold/i.test(hint), `expected a long-press hint, got "${hint}"`);
    const links = await fallbackPage.$$eval('#share-download-links a', (els) => els.map((a) => a.getAttribute('download')));
    assert.strictEqual(links.length, 2);
    links.forEach((name) => assert.ok(/^food-journal-\d{4}-\d{2}-\d{2}-\d-of-2\.png$/.test(name), name));
  });

  await check('create images button is disabled until a plan exists', async () => {
    await fallbackPage.evaluate(() => localStorage.clear());
    await fallbackPage.reload();
    assert.ok(await fallbackPage.isDisabled('#create-images-btn'));
  });

  await browser.close();
  await close();
  process.exit(summary() ? 0 : 1);
})();
