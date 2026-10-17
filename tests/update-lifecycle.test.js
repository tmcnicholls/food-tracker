// Simulates two real builds — "v1" (first install) and "v2" (a new GitHub
// Pages deploy landing on disk) — against the actual PWA update lifecycle:
// detecting the update, prompting instead of silently activating, handing
// control over exactly once with no reload loop, surviving offline, and
// never losing existing localStorage data. Also checks correct operation
// under a GitHub Pages–style project subpath.
//
// Operates on a disposable copy of the app in the OS temp directory — never
// the real repo files — since it needs to mutate index.html/sw.js/app.js on
// disk to simulate a deploy. Always cleaned up, even on failure.
//
// Run directly: node tests/update-lifecycle.test.js

const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helpers/static-server');
const { createChecker } = require('./helpers/check-runner');
const { copyAppInto } = require('./helpers/app-files');

function readFile(root, rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function writeFile(root, rel, content) { fs.writeFileSync(path.join(root, rel), content); }

(async () => {
  const { check, summary } = createChecker();

  // Scratch copy for the main v1 -> v2 flow.
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'food-tracker-test-'));
  copyAppInto(appRoot);
  const mainServer = await startServer(appRoot);

  // A second scratch copy, nested one level under a parent dir, to prove
  // the app works correctly when served from a GitHub Pages–style project
  // subpath (https://user.github.io/food-tracker/) rather than the root.
  const subpathParent = fs.mkdtempSync(path.join(os.tmpdir(), 'food-tracker-subpath-'));
  copyAppInto(path.join(subpathParent, 'food-tracker'));
  const subpathServer = await startServer(subpathParent);

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Persist a counter across same-origin reloads so we can prove the app
    // reloads at most once per update activation (no reload loop).
    await page.addInitScript(() => {
      window.sessionStorage.setItem('__reloadProbe', String((Number(window.sessionStorage.getItem('__reloadProbe')) || 0) + 1));
    });

    // ---- "Build v1": first-ever visit / install ----
    await page.goto(`${mainServer.url}/index.html`);
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.removeItem('__reloadProbe'));
    await page.reload();

    await check('1. first visit installs a service worker with no update banner shown', async () => {
      const swState = await page.evaluate(() => navigator.serviceWorker.ready.then((reg) => {
        if (reg.active && reg.active.state === 'activated') return 'activated';
        return new Promise((resolve) => {
          reg.active.addEventListener('statechange', () => {
            if (reg.active.state === 'activated') resolve('activated');
          });
        });
      }));
      assert.strictEqual(swState, 'activated');
      const bannerHidden = await page.$eval('#update-banner', (el) => el.classList.contains('hidden'));
      assert.strictEqual(bannerHidden, true, 'no update banner on a first-ever install');
    });

    await check('setup: create real journal data before the deploy', async () => {
      await page.click('#generate-btn');
      await page.waitForSelector('details.day');
      await page.click('details.day[data-day-index="0"] .meal-row[data-meal-key="breakfast"] .confirm-btn');
      const raw = await page.evaluate(() => localStorage.getItem('mvf-food-journal-v1'));
      assert.ok(raw && raw.length > 50);
    });

    const journalBefore = await page.evaluate(() => localStorage.getItem('mvf-food-journal-v1'));

    // ---- Simulate a new GitHub Pages deploy landing on disk, same origin ----
    const originalHtml = readFile(appRoot, 'index.html');
    const originalSw = readFile(appRoot, 'sw.js');
    const originalAppJs = readFile(appRoot, 'js/app.js');

    writeFile(appRoot, 'index.html', originalHtml.replace('<head>', '<head>\n<meta name="build-marker" content="v2-test-marker">'));
    writeFile(appRoot, 'sw.js', originalSw.replace(/const CACHE_NAME = '[^']*';/, "const CACHE_NAME = 'mvf-food-journal-v2-TEST';"));
    writeFile(appRoot, 'js/app.js', `${originalAppJs}\n// v2-test-build-marker\n`);

    await check('2-3. a new build becoming available is detected (banner appears) after an update check', async () => {
      // Simulate what app.js's own checkForUpdate() does on foreground/return —
      // trigger the registration's real update() call.
      await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
      await page.waitForSelector('#update-banner:not(.hidden)', { timeout: 10000 });
    });

    const reloadCountAtBanner = await page.evaluate(() => Number(sessionStorage.getItem('__reloadProbe')));

    await check('4. the waiting worker is handled correctly: clicking "Update now" hands over control and reloads once', async () => {
      // Arm the navigation wait *before* the click, in the same tick, so we
      // don't race the controllerchange-triggered reload (waitForLoadState
      // alone can resolve against the pre-existing load state instead of
      // waiting for the new one).
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }),
        page.click('#update-apply-btn'),
      ]);
      await page.waitForTimeout(200);
      const reloadCountAfter = await page.evaluate(() => Number(sessionStorage.getItem('__reloadProbe')));
      assert.strictEqual(reloadCountAfter, reloadCountAtBanner + 1, `expected exactly one reload, went from ${reloadCountAtBanner} to ${reloadCountAfter}`);
    });

    await check('5. cached HTML/assets no longer indefinitely stale — new build marker is now present', async () => {
      const marker = await page.$('meta[name="build-marker"][content="v2-test-marker"]');
      assert.ok(marker, 'expected the v2 build marker meta tag to be present after update');
    });

    await check('9b. no further reload happens on its own after the one triggered reload', async () => {
      await page.waitForTimeout(1500);
      const stillSame = await page.evaluate(() => Number(sessionStorage.getItem('__reloadProbe')));
      assert.strictEqual(stillSame, reloadCountAtBanner + 1, 'unexpected extra reload');
    });

    await check('7. existing locally stored journal data survived the update', async () => {
      const journalAfter = await page.evaluate(() => localStorage.getItem('mvf-food-journal-v1'));
      assert.strictEqual(journalAfter, journalBefore, 'localStorage journal changed/was lost across the update');
      // and it's still usable in the UI, not just present as raw JSON
      await page.waitForSelector('details.day');
      const tag = await page.$eval('details.day[data-day-index="0"] .meal-row[data-meal-key="breakfast"] .meal-status-tag', (e) => e.textContent);
      assert.ok(tag.includes('Confirmed'), 'the confirmed meal from before the update should still show Confirmed');
    });

    await check('6. offline startup keeps working after the update (new shell now cached)', async () => {
      const context = page.context();
      await context.setOffline(true);
      await page.reload();
      await page.waitForSelector('details.day', { timeout: 5000 });
      const marker = await page.$('meta[name="build-marker"][content="v2-test-marker"]');
      assert.ok(marker, 'offline reload should still serve the updated (now cached) shell');
      await context.setOffline(false);
    });

    await check('8. a failed update check (offline) does not break normal app use or throw', async () => {
      // Whether the browser resolves or rejects registration.update() while
      // offline is an engine-specific implementation detail we don't control;
      // app.js's own checkForUpdate() already wraps it in .catch(() => {})
      // either way. What actually matters per the task: no uncaught error,
      // and the app keeps working.
      const context = page.context();
      await context.setOffline(true);
      const errorBefore = pageErrors.length;
      const outcome = await page.evaluate(() => navigator.serviceWorker.getRegistration()
        .then((r) => r.update().then(() => 'resolved', () => 'rejected'))
        .catch(() => 'threw'));
      console.log(`      (registration.update() while offline -> ${outcome})`);
      await context.setOffline(false);
      assert.strictEqual(pageErrors.length, errorBefore, `expected no new page errors, got: ${pageErrors.slice(errorBefore).join('; ')}`);
      // app still responds to interaction
      await page.click('details.day[data-day-index="1"] summary');
      const opened = await page.$eval('details.day[data-day-index="1"]', (d) => d.open);
      assert.ok(opened);
    });

    await check('10. correct operation when deployed under a non-root subpath', async () => {
      // GitHub Pages project sites serve from /<repo>/ — this app uses only
      // relative paths, so re-request everything through a subpath prefix to
      // prove there's no absolute-path assumption anywhere.
      const subpathPage = await browser.newPage();
      const subErrors = [];
      subpathPage.on('pageerror', (e) => subErrors.push(e.message));
      await subpathPage.goto(`${subpathServer.url}/food-tracker/index.html`);
      await subpathPage.evaluate(() => localStorage.clear());
      await subpathPage.reload();
      await subpathPage.click('#generate-btn');
      await subpathPage.waitForSelector('details.day');
      const swState = await subpathPage.evaluate(() => navigator.serviceWorker.ready.then((r) => r.active?.state));
      assert.strictEqual(swState, 'activated');
      const scope = await subpathPage.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.scope));
      assert.ok(scope.endsWith('/food-tracker/'), `expected scope under /food-tracker/, got ${scope}`);
      assert.strictEqual(subErrors.length, 0, `page errors under subpath: ${subErrors.join('; ')}`);
      await subpathPage.close();
    });
  } finally {
    await browser.close();
    await mainServer.close();
    await subpathServer.close();
    fs.rmSync(appRoot, { recursive: true, force: true });
    fs.rmSync(subpathParent, { recursive: true, force: true });
  }

  process.exit(summary() ? 0 : 1);
})();
