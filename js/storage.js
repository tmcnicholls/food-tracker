// Local-only persistence (FR-08). Everything lives in localStorage under one
// namespaced key. No network calls are made from this module, ever.

const STORAGE_KEY = 'mvf-food-journal-v1';
const SCHEMA_VERSION = 1;

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    currentWeekKey: null,
    weeks: {},
    preferences: {
      startWeekday: 'Tuesday',
      profile: 'great',
      takeawayEnabled: false,
      theme: 'auto',
    },
  };
}

// Some browsers (Safari private mode, locked-down WebViews) can throw on any
// localStorage access, not just when full. Detect once and fall back to an
// in-memory store so the app still works for the session, and tell the UI.
let memoryFallback = null;
let storageAvailable = true;

function detectStorage() {
  try {
    const testKey = '__mvf_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
storageAvailable = detectStorage();

export function isStorageAvailable() {
  return storageAvailable;
}

export function loadState() {
  if (!storageAvailable) {
    return memoryFallback ?? defaultState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.weeks) return defaultState();
    return { ...defaultState(), ...parsed, preferences: { ...defaultState().preferences, ...parsed.preferences } };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  if (!storageAvailable) {
    memoryFallback = state;
    return true;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearAll() {
  memoryFallback = null;
  if (!storageAvailable) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — nothing more we can do
  }
}
