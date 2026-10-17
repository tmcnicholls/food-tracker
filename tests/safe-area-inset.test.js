// Confirms the header clears an iPhone Dynamic Island / notch: regular
// devices get unchanged padding, and a simulated safe-area-inset-top
// (via Chrome DevTools Protocol, using the iPhone 15 Pro's real 59px
// value) pushes the header — and the theme toggle inside it — below the
// inset instead of sitting underneath it.
//
// Run directly: node tests/safe-area-inset.test.js

const { chromium } = require('playwright');
const assert = require('assert');
const { startServer } = require('./helpers/static-server');
const { createChecker } = require('./helpers/check-runner');
const { REPO_ROOT } = require('./helpers/app-files');

(async () => {
  const { url, close } = await startServer(REPO_ROOT);
  const { check, summary } = createChecker();

  const browser = await chromium.launch();

  await check('regular device (no safe-area inset): header padding-top unaffected', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${url}/index.html`);
    const paddingTop = await page.evaluate(() => getComputedStyle(document.querySelector('.app-header')).paddingTop);
    assert.strictEqual(paddingTop, '24px', `expected unchanged 1.5rem (24px) padding-top, got ${paddingTop}`);
    await page.close();
  });

  await check('Dynamic-Island-style inset (59px): header grows to clear it, toggle sits below it', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 59, bottom: 34, left: 0, right: 0 },
    });
    await page.goto(`${url}/index.html`);

    const paddingTop = await page.evaluate(() => getComputedStyle(document.querySelector('.app-header')).paddingTop);
    assert.strictEqual(paddingTop, '83px', `expected 24px + 59px = 83px, got ${paddingTop}`);

    const toggleTop = await page.evaluate(() => document.getElementById('theme-toggle-btn').getBoundingClientRect().top);
    assert.ok(toggleTop >= 59, `expected the toggle to start at/after the 59px inset, got ${toggleTop}`);

    await page.close();
  });

  await browser.close();
  await close();
  process.exit(summary() ? 0 : 1);
})();
