// Service worker: caches the app shell so the planner keeps working offline
// after the first successful load (PRD 7.3), while making sure a deployed
// update is actually picked up on the next load with network access.
//
// Two deliberate design choices here, because this is a hand-written SW
// with no build-hash versioning of assets:
//
// 1. Fetch strategy is network-first, not cache-first. Cache is only a
//    fallback for offline use. A pure cache-first shell (the previous
//    approach) can serve a stale index.html/app.js forever once cached,
//    because the browser never has a reason to re-request it — that was
//    the root cause of installs not picking up new GitHub Pages deploys.
//
// 2. A newly installed worker does NOT call skipWaiting() automatically.
//    It sits in the `waiting` state until the page explicitly asks it to
//    take over (see the `message` listener below). app.js prompts the
//    user ("A new version is available") and only sends SKIP_WAITING when
//    they choose to update, so an in-progress edit is never interrupted
//    by a forced reload.
//
// Bump CACHE_NAME when the APP_SHELL file list changes (files added or
// removed) so the activate step repopulates it cleanly. It is no longer
// load-bearing for "does the update get noticed" — the network-first fetch
// handler and the update lifecycle in app.js handle that now.
const CACHE_NAME = 'mvf-food-journal-v4';

const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/dates.js',
  './js/generator.js',
  './js/mealLibrary.js',
  './js/rng.js',
  './js/storage.js',
  './manifest.json',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
});

// The page sends this once the user opts in to an available update.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Only cache well-formed, successful same-origin responses — never
    // cache an error page or an opaque/failed response as if it were
    // valid application content.
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Offline, nothing cached for this exact request — for a navigation,
    // fall back to the cached app shell so the planner still opens.
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});
