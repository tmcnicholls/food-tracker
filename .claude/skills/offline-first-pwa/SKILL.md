---
name: offline-first-pwa
description: Rules for building offline-first Progressive Web Apps that launch instantly from the home screen. Use when building, reviewing or debugging a PWA, or anything touching a service worker, a web app manifest, precaching, an in-app update prompt, iOS home screen behaviour, or safe-area/notch layout.
---

# Offline-first PWA

An offline-first PWA is an app that launches from cache in under a second with no network at
all, and updates itself in the background afterwards. Every rule below follows from that
sentence, and every one of them is here because it was gotten wrong first.

Stack-neutral. Where a rule needs a build step it says "your bundler's manifest", not a
specific tool.

## If you only apply three

1. Serve navigations **cache-first**, never network-first. A slow network does not reject a
   fetch, it hangs.
2. **Everything the app launches must be precached**, including assets only fetched at
   runtime. Missing one only breaks a cold or slow launch, which nobody tests by hand.
3. **Test slow, not offline.** They are different failure modes and only one of them is
   handled by accident.

## Service worker

- **Navigations are cache-first. Never network-first.** This is the big one and it is
  counter-intuitive enough to get written the wrong way round on purpose. The reasoning for
  network-first is usually "the page contains app logic, so a cached page is a stale app".
  True, and irrelevant next to how it fails: a `fetch().catch(() => cache)` fallback only
  fires when the device is *properly* offline. On a network that is technically up and
  crawling, the worker just waits. Measured with the page already in cache: 8s of added
  latency produced 8.1s to first paint, 20s produced 20s. Cache-first made the same launches
  64ms and 112ms.
- **Freshness is a separate mechanism from the fetch strategy.** Do not pay latency on every
  launch to solve a problem that happens on deploy day. Serve from cache, refetch the page in
  the background, compare the response body to what was served, and only if it actually
  differs `postMessage` the client so it can offer a refresh.
- **Read a cached response's body before you hand it to `respondWith()`.** Once returned, the
  body is locked and `clone()` throws. Getting this wrong is near-invisible: the throw happens
  inside the promise passed to `waitUntil()`, so it rejects in the background with nothing in
  the page console, the cache silently stops refreshing, and the app serves the same stale
  HTML forever. Take the `.clone().text()` synchronously, at the point where you still own the
  response.
- **Register the worker during parse, not on `window.load`.** Waiting for load means waiting
  for every subresource, so the cache gets warmed last on exactly the slow connection where it
  matters most. Registration does not block rendering.
- **Version the worker on a hash of the precache list plus the templates that compose the
  page.** Asset hashes alone miss an HTML-only edit, and then a copy change ships to nobody.
- **`start_url` and `scope` carry no trailing slash** (`/app`, not `/app/`), so the worker
  controls the app's own entry page. If the script is served from inside that path, send
  `Service-Worker-Allowed: /app` so its scope can widen one level up.
- **One app, one worker, one scope.** A nested page that registers a second worker puts a
  second cache of the same shell inside the first one's scope, neither aware of the other's
  version, and whichever claims the page last decides what you see. Nested apps share the
  parent's worker and scope, and get their *own* manifest, name and icon, which is what tells
  them apart on a home screen.
- **`Cache-Control: no-cache` on the worker script, immutable on hashed build assets.** A
  cached worker script is an app that can never update.

## Precaching

- **Whatever the app launches has to be in the precache list.** `start_url` and the offline
  page are the two entries it cannot open without. Drift there still works online and only
  breaks a cold or slow launch, so assert the list against your build manifest in CI rather
  than trusting a manual check.
- **Walk the whole bundler graph, not just the entry files.** Shared chunks, the entry's CSS,
  imported assets, and the chunks only fetched at runtime. A self-contained single-file entry
  hides the need for this, right up until one app is not.
- **So reference runtime assets by importing them, never by URL.** A literal
  `new Audio('/sounds/x.mp3')` is invisible to the build manifest, works online, and goes
  quiet exactly when someone is offline. `import url from './x.mp3'` lands in the manifest and
  gets precached.
- **Nothing goes on the critical path that the installed app cannot use.** The classic is the
  install prompt: a couple of hundred KB that can only ever render for someone who has *not*
  installed the app, downloaded and parsed on every launch of the installed app to render
  nothing. Dynamically import it behind a `display-mode: standalone` check. Apply the same
  test to anything new.
- **No webfonts.** A render-blocking request on the critical path of an app whose entire
  selling point is opening instantly, and every platform ships a good sans.

## Updates

- `skipWaiting()` + `clients.claim()`, then show a small "new version, refresh" banner on
  `controllerchange` and reload on tap. Poll `registration.update()` on `visibilitychange` and
  roughly hourly, which covers an installed app left open for days.
- **"Already controlled" is not the same test as "there is an update".** A worker with a
  broader scope controls a nested page from the moment you arrive, so `controllerchange` fires
  a second later with nothing new anywhere and the banner shows on first launch. Compare
  `navigator.serviceWorker.controller.scriptURL` before and after instead: the same URL means
  a new version of that worker, a different URL is just a handover. Reproduce it by loading
  the parent scope first and then navigating in; opening the nested page cold does not show
  it.
- **The first launch after a deploy is still slow, by design.** The *old* worker serves that
  navigation, updates itself in the background, and launch two onward is fast. Do not chase
  it as a bug.

## iOS

- **The home screen icon and title come from `apple-touch-icon` and
  `apple-mobile-web-app-title`, not from the manifest.** Set both per app.
- **iOS ignores `orientation` in the manifest.** An app that needs one orientation still has
  to say so itself, with a CSS-only `@media (orientation: portrait)` cover that is there
  before any script has loaded.
- **iOS has no programmatic install.** `beforeinstallprompt` does not exist there, so the
  install affordance is Share-sheet instructions, shown only on mobile, hidden once installed,
  and remembered as dismissed.
- **Detect standalone with an inline script in `<head>`, during parse**, and hide the chrome
  that only makes sense in a browser tab (a link back to a hub, a site header). Run it any
  later and that chrome flashes up before it disappears.
- **In anything you tap repeatedly, iOS pops its own "Copy / Look Up" bar over the UI.** It
  reads a fast second tap as a double tap, selects whatever is underneath, and shows the
  selection bar. It takes both halves to stop, and the second one is the one that gets missed:
  - CSS on the whole layout, not just the element you tap: `-webkit-user-select: none`,
    `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`,
    `touch-action: manipulation`. The bar belongs to whichever element takes the tap, so
    scoping this to the canvas alone leaves the surrounding UI exposed.
  - `preventDefault()` on `pointerdown` does **not** suppress it, on `touchstart` it does. iOS
    hangs selection and the callout off the touch event, so add a `touchstart` listener with
    `{ passive: false }` whose only job is `preventDefault()`. `pointerdown` fires first, so
    app logic can stay there.
  - Chrome cannot verify the callout half: it does not implement `-webkit-touch-callout`, so
    it drops the declaration from `cssRules` and from computed styles even though the property
    is in the built CSS. Grep the built stylesheet, then confirm on a real iPhone.

## Layout

- **Assume the top of the screen is not yours.** Installed PWAs run full-bleed
  (`viewport-fit=cover`, translucent status bar), so the top strip is clock, battery, notch or
  dynamic island, and the bottom is the home indicator. Never put the first row of UI flush
  against the top.
- **Pad with `max(env(safe-area-inset-top), <minimum>)`, never a bare `env()`.**
  `env(safe-area-inset-top)` is `0` in a normal browser tab and on devices that expose no
  inset, so on its own it reserves nothing and the UI slides under the status bar. The `max()`
  keeps a usable minimum everywhere and grows to the real inset when there is one. Anything
  `fixed` to an edge adds the same value to its offset.
- **The page itself never scrolls.** `100dvh` with `overflow: hidden` as a flex column, and
  the content pane is the `flex: 1; min-height: 0` slot that carries `overflow-y: auto`. An
  app that scrolls as a page does not read as an app.
- **To fit a fixed-ratio box into the leftover height, use container-query units, not a `dvh`
  guess.** `container-type: size` on the slot, then size the child off `cqw`/`cqh`. A guess
  like `max(17rem, 30dvh)` is wrong at some viewport by construction, and `height: 100%`
  together with `aspect-ratio` does not work either: the explicit height wins, so as soon as
  `max-width` binds you get rectangles instead of squares.
- **A phone layout stretched to a tablet looks like a mistake.** Cap the content column,
  centre it, and let controls grow *taller* rather than wider: a finger on a tablet is the
  same size as on a phone.

## Testing

- **Test slow, not offline.** Offline is the failure mode that works by accident; a network
  that is up and crawling is the one that hangs. Put real latency in front of the app (a small
  reverse proxy that sleeps before piping the upstream response works, and lets you change the
  delay at runtime) and read `performance.getEntriesByType('navigation')` plus
  `first-contentful-paint`.
- **DevTools network throttling does not apply to fetches made inside a service worker.** It
  will show you a fast load and tell you nothing.
- **When testing the update path, change something the version hash does not cover.** Editing
  a template bumps the worker version, so `controllerchange` fires and a completely broken
  background-content-update path still looks like it works. Change a string that is rendered
  but not hashed, confirm the worker version is unchanged, and then the banner can only have
  come from the mechanism under test. Check the negative too: relaunch with nothing changed
  and assert the banner stays hidden.
- **The worker will hand you yesterday's HTML while you debug.** Navigations are cache-first
  by design, so after a build a plain reload can still run the previous page and the previous
  script, and you will be looking at a bug you already fixed. Unregister and drop the caches
  before concluding anything:

  ```js
  (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister())
  (await caches.keys()).forEach(k => caches.delete(k))
  ```

## Moving an app to another origin

- **An installed PWA cannot follow its origin.** A home screen icon is welded to the origin it
  was installed from and there is no API to move it. The best available outcome is: get the
  window across, then tell the user the icon is stale.
- **Never redirect a service worker script.** The browser fetches it to check for an update; a
  redirect makes that fetch a network error, a failed update leaves the *old* worker
  registered, and that worker serves navigations from its cache by design. The app then keeps
  opening its cached copy of the old site and never learns anything changed.
- **Serve a real worker at the old URLs instead**, whose whole job is to delete every cache,
  unregister itself, and `client.navigate()` its windows to the new origin. It still needs its
  `Service-Worker-Allowed` header, because the old registration's scope may sit above the
  script's own directory, and without it the update is rejected on scope, which fails in
  exactly the same invisible way as the redirect.
- **The first launch after the move still shows the old app, once.** The old worker serves that
  navigation before it has any idea a new script exists, then moves the window a second later.