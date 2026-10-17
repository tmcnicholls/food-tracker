// Covers the Light/Dark/Auto theme toggle: following the OS scheme by
// default, an explicit choice overriding the OS scheme in either direction,
// and persistence across reload.
//
// Run directly: node tests/theme.test.js

const { chromium } = require('playwright');
const assert = require('assert');
const { startServer } = require('./helpers/static-server');
const { createChecker } = require('./helpers/check-runner');
const { REPO_ROOT } = require('./helpers/app-files');

(async () => {
  const { url, close } = await startServer(REPO_ROOT);
  const { check, summary } = createChecker();

  const browser = await chromium.launch();

  // 1. OS set to dark, app preference default 'auto' -> should render dark, no data-theme attr.
  const ctxDark = await browser.newContext({ colorScheme: 'dark' });
  const pageDark = await ctxDark.newPage();
  await pageDark.goto(`${url}/index.html`);
  await pageDark.evaluate(() => localStorage.clear());
  await pageDark.reload();

  await check('auto mode follows OS dark scheme (no data-theme attr, dark bg rendered)', async () => {
    const themeAttr = await pageDark.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert.strictEqual(themeAttr, null);
    const bg = await pageDark.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.strictEqual(bg, 'rgb(21, 23, 15)'); // --bg dark value #15170f
    const label = await pageDark.innerText('#theme-toggle-label');
    assert.strictEqual(label, 'Auto');
  });

  await check('clicking toggle cycles Auto -> Light and forces light bg despite OS dark', async () => {
    await pageDark.click('#theme-toggle-btn');
    const label = await pageDark.innerText('#theme-toggle-label');
    assert.strictEqual(label, 'Light');
    const themeAttr = await pageDark.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert.strictEqual(themeAttr, 'light');
    const bg = await pageDark.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.strictEqual(bg, 'rgb(246, 245, 241)'); // --bg light value #f6f5f1, overriding OS dark
  });

  await check('explicit Light choice persists across reload', async () => {
    await pageDark.reload();
    const label = await pageDark.innerText('#theme-toggle-label');
    assert.strictEqual(label, 'Light');
    const bg = await pageDark.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.strictEqual(bg, 'rgb(246, 245, 241)');
  });

  await check('clicking again cycles Light -> Dark', async () => {
    await pageDark.click('#theme-toggle-btn');
    const label = await pageDark.innerText('#theme-toggle-label');
    assert.strictEqual(label, 'Dark');
    const themeAttr = await pageDark.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert.strictEqual(themeAttr, 'dark');
  });

  await check('clicking again cycles Dark -> Auto, removes data-theme attr', async () => {
    await pageDark.click('#theme-toggle-btn');
    const label = await pageDark.innerText('#theme-toggle-label');
    assert.strictEqual(label, 'Auto');
    const themeAttr = await pageDark.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert.strictEqual(themeAttr, null);
  });

  // 2. OS set to light, explicit Dark choice should still force dark.
  const ctxLight = await browser.newContext({ colorScheme: 'light' });
  const pageLight = await ctxLight.newPage();
  await pageLight.goto(`${url}/index.html`);
  await pageLight.evaluate(() => localStorage.clear());
  await pageLight.reload();

  await check('on OS-light device, forcing Dark overrides the OS scheme', async () => {
    await pageLight.click('#theme-toggle-btn'); // auto -> light
    await pageLight.click('#theme-toggle-btn'); // light -> dark
    const label = await pageLight.innerText('#theme-toggle-label');
    assert.strictEqual(label, 'Dark');
    const bg = await pageLight.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.strictEqual(bg, 'rgb(21, 23, 15)');
  });

  await check('meta theme-color updates to match dark surface', async () => {
    const content = await pageLight.$eval('meta[name="theme-color"]', (m) => m.getAttribute('content'));
    assert.strictEqual(content, '#15170f');
  });

  await browser.close();
  await close();
  process.exit(summary() ? 0 : 1);
})();
