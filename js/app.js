// Weekly Food Journal — app controller.
// Vanilla JS, no framework, no network calls. Everything here reads/writes
// the single `appState` object and re-renders from it.

import {
  addDays, parseISODate, toISODate, weekdayName,
  formatLongDate, formatWeekRange, sameWeekOccurrence, todayLocal,
} from './dates.js';
import { generateWeek, regenerateMeal } from './generator.js';
import { freshSeed } from './rng.js';
import { loadState, saveState, clearAll, isStorageAvailable } from './storage.js';

const MEAL_ORDER = ['breakfast', 'lunch', 'tea', 'snacks'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', tea: 'Tea', snacks: 'Snacks' };

const STATUS_META = {
  unassessed: { emoji: '⚪', label: 'Not yet reviewed' },
  green: { emoji: '🟢', label: 'Green — on track' },
  amber: { emoji: '🟠', label: 'Amber — mixed' },
  red: { emoji: '🔴', label: 'Red — off plan' },
};

// --- DOM references -------------------------------------------------------

const weekPickerEl = document.getElementById('week-picker');
const newWeekBtn = document.getElementById('new-week-btn');
const weekRangeEl = document.getElementById('week-range');
const startWeekdaySelect = document.getElementById('start-weekday');
const startDateInput = document.getElementById('start-date');
const profileButtons = Array.from(document.querySelectorAll('.seg-btn[data-profile]'));
const takeawayCheckbox = document.getElementById('takeaway-checkbox');
const generateBtn = document.getElementById('generate-btn');
const generateFeedbackEl = document.getElementById('generate-feedback');
const journalEl = document.getElementById('journal');
const copyBtn = document.getElementById('copy-btn');
const copyFeedbackEl = document.getElementById('copy-feedback');
const copyFallbackEl = document.getElementById('copy-fallback');
const clearDataBtn = document.getElementById('clear-data-btn');
const storageWarningEl = document.getElementById('storage-warning');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeToggleLabelEl = document.getElementById('theme-toggle-label');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const updateBannerEl = document.getElementById('update-banner');
const updateApplyBtn = document.getElementById('update-apply-btn');
const updateDismissBtn = document.getElementById('update-dismiss-btn');

const dialogEl = document.getElementById('confirm-dialog');
const dialogTitleEl = document.getElementById('confirm-dialog-title');
const dialogMessageEl = document.getElementById('confirm-dialog-message');
const dialogConfirmBtn = document.getElementById('confirm-dialog-confirm-btn');

// --- State ------------------------------------------------------------------

let appState = loadState();
let skipNextCommit = false;

function computeDefaultStartDate(weekdayStr) {
  let d = todayLocal();
  for (let i = 0; i < 7; i += 1) {
    if (weekdayName(d) === weekdayStr) return toISODate(d);
    d = addDays(d, -1);
  }
  return toISODate(todayLocal());
}

if (!appState.currentWeekKey) {
  appState.currentWeekKey = computeDefaultStartDate(appState.preferences.startWeekday);
}

function persist() {
  const ok = saveState(appState);
  if (!ok) storageWarningEl.classList.remove('hidden');
}

function getCurrentWeekRecord() {
  return appState.weeks[appState.currentWeekKey];
}

function isWeekProtected(week) {
  return week.days.some((day) => (
    day.status !== 'unassessed'
    || MEAL_ORDER.some((key) => {
      const meal = day.meals[key];
      return meal.status !== 'suggested' || meal.text !== meal.suggestion;
    })
  ));
}

// --- Theme (light / dark / auto) ----------------------------------------

const THEME_LABELS = { auto: 'Auto', light: 'Light', dark: 'Dark' };
const THEME_ICONS = { auto: '🌓', light: '☀️', dark: '🌙' };
const THEME_NEXT = { auto: 'light', light: 'dark', dark: 'auto' };
const darkSchemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  const isDark = theme === 'dark' || (theme === 'auto' && !!darkSchemeQuery?.matches);
  if (themeColorMeta) themeColorMeta.setAttribute('content', isDark ? '#15170f' : '#1b5e3d');

  const nextTheme = THEME_NEXT[theme] ?? 'auto';
  themeToggleLabelEl.textContent = THEME_LABELS[theme] ?? 'Auto';
  themeToggleBtn.querySelector('span[aria-hidden]').textContent = THEME_ICONS[theme] ?? THEME_ICONS.auto;
  themeToggleBtn.setAttribute('aria-label', `Theme: ${THEME_LABELS[theme] ?? 'Auto'}. Activate to switch to ${THEME_LABELS[nextTheme]}.`);
}

themeToggleBtn.addEventListener('click', () => {
  const current = appState.preferences.theme ?? 'auto';
  const nextTheme = THEME_NEXT[current] ?? 'auto';
  appState.preferences.theme = nextTheme;
  persist();
  applyTheme(nextTheme);
});

// If the user hasn't forced a theme, keep the status-bar colour in sync when
// the OS theme changes while the app is open.
darkSchemeQuery?.addEventListener('change', () => {
  if ((appState.preferences.theme ?? 'auto') === 'auto') applyTheme('auto');
});

// --- Small helpers -----------------------------------------------------

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

function showGenerateFeedback(message) {
  generateFeedbackEl.textContent = message;
}

function showCopyFeedback(message) {
  copyFeedbackEl.textContent = message;
}

/** Native <dialog>-backed confirm, with a window.confirm() fallback for
 *  browsers that don't support showModal(). Resolves true/false. */
function confirmDialog({ title, message, confirmLabel = 'Confirm' }) {
  if (typeof dialogEl.showModal !== 'function') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  dialogTitleEl.textContent = title;
  dialogMessageEl.textContent = message;
  dialogConfirmBtn.textContent = confirmLabel;
  dialogEl.showModal();
  return new Promise((resolve) => {
    function onClose() {
      dialogEl.removeEventListener('close', onClose);
      resolve(dialogEl.returnValue === 'confirm');
    }
    dialogEl.addEventListener('close', onClose);
  });
}

// --- Rendering ---------------------------------------------------------

function getSelectedProfile() {
  const active = profileButtons.find((b) => b.getAttribute('aria-pressed') === 'true');
  return active ? active.dataset.profile : appState.preferences.profile;
}

function setProfileButtons(profile) {
  profileButtons.forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.profile === profile));
  });
}

function renderWeekPicker() {
  const keys = new Set(Object.keys(appState.weeks));
  keys.add(appState.currentWeekKey);
  const sorted = Array.from(keys).sort((a, b) => b.localeCompare(a));
  weekPickerEl.innerHTML = sorted.map((key) => {
    const record = appState.weeks[key];
    const start = parseISODate(key);
    const end = addDays(start, 6);
    const suffix = record ? '' : ' (not generated yet)';
    const label = `${formatLongDate(start)} – ${formatLongDate(end)}${suffix}`;
    const selected = key === appState.currentWeekKey ? ' selected' : '';
    return `<option value="${key}"${selected}>${escapeHtml(label)}</option>`;
  }).join('');
}

function syncSettingsControls() {
  const startDate = parseISODate(appState.currentWeekKey);
  const record = getCurrentWeekRecord();
  startWeekdaySelect.value = weekdayName(startDate);
  startDateInput.value = appState.currentWeekKey;
  setProfileButtons(record?.profile ?? appState.preferences.profile);
  takeawayCheckbox.checked = record?.takeawayEnabled ?? appState.preferences.takeawayEnabled;
  weekRangeEl.textContent = `Week: ${formatWeekRange(startDate, addDays(startDate, 6))}`;
}

function updateGenerateButtonAndCopyState() {
  const record = getCurrentWeekRecord();
  generateBtn.textContent = record ? 'Regenerate plan' : 'Generate plan';
  copyBtn.disabled = !record;
}

function placeholderHtml() {
  return '<p class="hint">No plan yet for this week. Choose your settings above and press <strong>Generate plan</strong>.</p>';
}

function renderStatusButton(day, value, emoji, label) {
  const pressed = day.status === value;
  return `<button type="button" class="status-btn status-${value}" data-status="${value}" aria-pressed="${pressed}" aria-label="${label}${pressed ? ' (selected)' : ''}">${emoji}</button>`;
}

function renderMealRow(day, key) {
  const meal = day.meals[key];
  const label = MEAL_LABELS[key];
  const statusTag = meal.status === 'suggested' ? 'Suggested' : meal.status === 'confirmed' ? 'Confirmed' : 'Skipped';
  return `
  <div class="meal-row" data-meal-key="${key}">
    <div class="meal-row-top">
      <span class="meal-label">${label}</span>
      <div class="meal-controls">
        <button type="button" class="icon-btn regenerate-btn" data-action="regenerate" aria-label="Get a different ${label} suggestion">↻</button>
        <button type="button" class="icon-btn edit-btn" data-action="edit" aria-label="Edit ${label} text">✎</button>
        <button type="button" class="icon-btn confirm-btn" data-action="confirm" aria-pressed="${meal.status === 'confirmed'}" aria-label="Mark ${label} as confirmed">✓</button>
        <button type="button" class="icon-btn skip-btn" data-action="skip" aria-pressed="${meal.status === 'skipped'}" aria-label="Mark ${label} as skipped">⤬</button>
      </div>
    </div>
    <p class="meal-text${meal.status === 'skipped' ? ' is-skipped' : ''}" data-role="display">${escapeHtml(meal.text)}<span class="meal-status-tag">(${statusTag})</span></p>
    <input type="text" class="meal-text-input hidden" data-role="input" value="${escapeAttr(meal.text)}" aria-label="Edit ${label} text">
  </div>`;
}

function renderDayHtml(day, index, isOpen) {
  const date = parseISODate(day.date);
  const meta = STATUS_META[day.status] ?? STATUS_META.unassessed;
  const dateLabel = formatLongDate(date);
  return `
<details class="day" data-day-index="${index}"${isOpen ? ' open' : ''}>
  <summary>
    <span class="day-heading-text">
      <span class="day-heading-weekday">${meta.emoji} ${day.weekday}</span>
      <span class="day-heading-date">${dateLabel} · ${meta.label}</span>
    </span>
  </summary>
  <div class="day-body">
    <div class="day-status-group" role="group" aria-label="Set status for ${day.weekday} ${dateLabel}">
      ${renderStatusButton(day, 'green', '🟢', 'Green')}
      ${renderStatusButton(day, 'amber', '🟠', 'Amber')}
      ${renderStatusButton(day, 'red', '🔴', 'Red')}
    </div>
    <p class="day-hint">Tap a colour to set this day's status. Tap it again to clear it. A day can only turn green once all four meals below have been reviewed.</p>
    ${MEAL_ORDER.map((key) => renderMealRow(day, key)).join('')}
  </div>
</details>`;
}

function renderJournal() {
  const existingDetails = journalEl.querySelectorAll('details.day');
  let openIndices;
  if (existingDetails.length) {
    openIndices = new Set();
    existingDetails.forEach((d) => { if (d.open) openIndices.add(Number(d.dataset.dayIndex)); });
  } else {
    openIndices = new Set([0]);
  }

  const week = getCurrentWeekRecord();
  if (!week) {
    journalEl.innerHTML = placeholderHtml();
  } else {
    journalEl.innerHTML = week.days.map((day, i) => renderDayHtml(day, i, openIndices.has(i))).join('');
  }
  updateGenerateButtonAndCopyState();
}

function syncAll() {
  syncSettingsControls();
  renderWeekPicker();
  renderJournal();
}

// --- Export --------------------------------------------------------------

function buildExportText(week) {
  const startDate = parseISODate(week.startDate);
  const endDate = addDays(startDate, 6);
  const lines = [];
  lines.push('MAN v FAT — Weekly Food Journal');
  lines.push(`Week: ${formatWeekRange(startDate, endDate)}`);
  lines.push('');

  week.days.forEach((day) => {
    const date = parseISODate(day.date);
    const meta = STATUS_META[day.status] ?? STATUS_META.unassessed;
    lines.push(`${weekdayName(date)} ${formatLongDate(date)} ${meta.emoji}`);
    MEAL_ORDER.forEach((key) => {
      const meal = day.meals[key];
      const label = MEAL_LABELS[key];
      if (meal.status === 'skipped') {
        lines.push(`${label}: Skipped`);
      } else {
        lines.push(`${label}: ${meal.text}`);
      }
    });
    lines.push('');
  });

  return `${lines.join('\n').trim()}\n`;
}

async function copyJournal() {
  const week = getCurrentWeekRecord();
  if (!week) {
    showCopyFeedback('Generate a plan first.');
    return;
  }
  const text = buildExportText(week);

  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new Error('Clipboard API unavailable');
    }
    await navigator.clipboard.writeText(text);
    showCopyFeedback('Copied! Paste it into Apple Notes.');
    copyFallbackEl.classList.add('hidden');
  } catch {
    copyFallbackEl.value = text;
    copyFallbackEl.classList.remove('hidden');
    copyFallbackEl.focus();
    copyFallbackEl.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    showCopyFeedback(ok
      ? 'Copied! Paste it into Apple Notes.'
      : 'Could not copy automatically — the text below is selected, so copy it manually.');
  }
}

// --- Event handlers --------------------------------------------------------

async function handleGenerateClick() {
  const startISO = appState.currentWeekKey;
  const profile = getSelectedProfile();
  const takeawayEnabled = takeawayCheckbox.checked;
  const existing = appState.weeks[startISO];

  if (existing && isWeekProtected(existing)) {
    const ok = await confirmDialog({
      title: 'Replace this week?',
      message: 'This week has confirmed, edited or skipped entries. Regenerating will replace all of them with new suggestions.',
      confirmLabel: 'Replace week',
    });
    if (!ok) return;
  }

  const seed = freshSeed();
  const { days, takeawayCategory } = generateWeek({ startDateISO: startISO, profile, takeawayEnabled, seed });
  appState.weeks[startISO] = {
    startDate: startISO, profile, takeawayEnabled, takeawayCategory, seed, days, updatedAt: Date.now(),
  };
  appState.preferences = { startWeekday: weekdayName(parseISODate(startISO)), profile, takeawayEnabled };
  persist();
  renderWeekPicker();
  renderJournal();
  showGenerateFeedback(existing ? 'Plan regenerated.' : 'Plan generated — review and confirm your meals below.');
}

function handleStartNewWeek() {
  const base = parseISODate(appState.currentWeekKey);
  appState.currentWeekKey = toISODate(addDays(base, 7));
  persist();
  syncAll();
  showGenerateFeedback('Started a new week. Your previous week is saved and available from "Saved weeks" above.');
}

async function handleDayStatusClick(dayIndex, newStatus) {
  const week = getCurrentWeekRecord();
  if (!week) return;
  const day = week.days[dayIndex];
  const nextStatus = day.status === newStatus ? 'unassessed' : newStatus;

  if (nextStatus === 'green') {
    const allReviewed = MEAL_ORDER.every((k) => day.meals[k].status !== 'suggested');
    if (!allReviewed) {
      const ok = await confirmDialog({
        title: 'Mark this day green?',
        message: "Not all of this day's meals have been reviewed yet. Mark it green anyway?",
        confirmLabel: 'Mark green',
      });
      if (!ok) return;
    }
  }

  day.status = nextStatus;
  week.updatedAt = Date.now();
  persist();
  renderJournal();
}

function handleMealAction(dayIndex, mealKey, action) {
  const week = getCurrentWeekRecord();
  if (!week) return;
  const meal = week.days[dayIndex].meals[mealKey];
  if (action === 'confirm') {
    meal.status = meal.status === 'confirmed' ? 'suggested' : 'confirmed';
  } else if (action === 'skip') {
    meal.status = meal.status === 'skipped' ? 'suggested' : 'skipped';
  }
  week.updatedAt = Date.now();
  persist();
  renderJournal();
}

async function handleMealRegenerate(dayIndex, mealKey) {
  const week = getCurrentWeekRecord();
  if (!week) return;
  const meal = week.days[dayIndex].meals[mealKey];
  const label = MEAL_LABELS[mealKey];
  const alreadyReviewed = meal.status !== 'suggested' || meal.text !== meal.suggestion;

  if (alreadyReviewed) {
    const ok = await confirmDialog({
      title: 'Get a different suggestion?',
      message: `This ${label.toLowerCase()} has already been confirmed, skipped or edited. Getting a new suggestion will replace it.`,
      confirmLabel: 'Get new suggestion',
    });
    if (!ok) return;
  }

  week.days[dayIndex].meals[mealKey] = regenerateMeal(week, dayIndex, mealKey);
  week.updatedAt = Date.now();
  persist();
  renderJournal();
}

function handleEditToggle(rowEl) {
  rowEl.querySelector('[data-role="display"]').classList.add('hidden');
  const input = rowEl.querySelector('[data-role="input"]');
  input.classList.remove('hidden');
  input.focus();
  input.select();
}

function handleMealInputCommit(dayIndex, mealKey, inputEl) {
  if (skipNextCommit) {
    skipNextCommit = false;
    renderJournal();
    return;
  }
  const week = getCurrentWeekRecord();
  if (!week) return;
  const meal = week.days[dayIndex].meals[mealKey];
  const newText = inputEl.value.trim();
  if (newText && newText !== meal.text) {
    meal.text = newText;
    week.updatedAt = Date.now();
    persist();
  }
  renderJournal();
}

async function handleClearData() {
  const ok = await confirmDialog({
    title: 'Clear all local data?',
    message: 'This permanently deletes every saved week and preference stored on this device. This cannot be undone.',
    confirmLabel: 'Clear everything',
  });
  if (!ok) return;
  clearAll();
  appState = loadState();
  appState.currentWeekKey = computeDefaultStartDate(appState.preferences.startWeekday);
  syncAll();
  showGenerateFeedback('All local data cleared.');
  showCopyFeedback('');
}

// --- Wiring ----------------------------------------------------------------

weekPickerEl.addEventListener('change', () => {
  appState.currentWeekKey = weekPickerEl.value;
  appState.preferences.startWeekday = weekdayName(parseISODate(weekPickerEl.value));
  persist();
  syncAll();
});

newWeekBtn.addEventListener('click', handleStartNewWeek);

startWeekdaySelect.addEventListener('change', () => {
  const currentDate = parseISODate(appState.currentWeekKey);
  const newDate = sameWeekOccurrence(currentDate, startWeekdaySelect.value);
  appState.currentWeekKey = toISODate(newDate);
  appState.preferences.startWeekday = startWeekdaySelect.value;
  persist();
  syncAll();
});

startDateInput.addEventListener('change', () => {
  if (!startDateInput.value) return;
  appState.currentWeekKey = startDateInput.value;
  appState.preferences.startWeekday = weekdayName(parseISODate(startDateInput.value));
  persist();
  syncAll();
});

profileButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setProfileButtons(btn.dataset.profile);
    appState.preferences.profile = btn.dataset.profile;
    persist();
  });
});

takeawayCheckbox.addEventListener('change', () => {
  appState.preferences.takeawayEnabled = takeawayCheckbox.checked;
  persist();
});

generateBtn.addEventListener('click', handleGenerateClick);
copyBtn.addEventListener('click', copyJournal);
clearDataBtn.addEventListener('click', handleClearData);

journalEl.addEventListener('click', (e) => {
  const statusBtn = e.target.closest('.status-btn');
  if (statusBtn) {
    const dayIndex = Number(statusBtn.closest('.day').dataset.dayIndex);
    handleDayStatusClick(dayIndex, statusBtn.dataset.status);
    return;
  }
  const actionBtn = e.target.closest('.icon-btn');
  if (actionBtn) {
    const row = actionBtn.closest('.meal-row');
    const dayIndex = Number(row.closest('.day').dataset.dayIndex);
    const mealKey = row.dataset.mealKey;
    const action = actionBtn.dataset.action;
    if (action === 'edit') {
      handleEditToggle(row);
    } else if (action === 'regenerate') {
      handleMealRegenerate(dayIndex, mealKey);
    } else {
      handleMealAction(dayIndex, mealKey, action);
    }
  }
});

journalEl.addEventListener('keydown', (e) => {
  if (!e.target.matches('.meal-text-input')) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    skipNextCommit = true;
    e.target.blur();
  }
});

journalEl.addEventListener('focusout', (e) => {
  if (!e.target.matches('.meal-text-input')) return;
  const row = e.target.closest('.meal-row');
  const dayIndex = Number(row.closest('.day').dataset.dayIndex);
  const mealKey = row.dataset.mealKey;
  handleMealInputCommit(dayIndex, mealKey, e.target);
});

// --- App update lifecycle -----------------------------------------------
//
// sw.js deliberately holds a newly installed worker in the `waiting` state
// instead of activating it immediately (see comments there), so that an
// update never force-reloads the page out from under an in-progress edit.
// This section detects a waiting update, shows a prompt, and only tells the
// worker to take over once the user chooses to — then reloads exactly once.

const UPDATE_CHECK_MIN_INTERVAL_MS = 60_000;
let lastUpdateCheckAt = 0;
let hasReloadedForUpdate = false;
let updateRequested = false;
let swRegistration = null;

function showUpdateBanner() {
  updateBannerEl.classList.remove('hidden');
}

function hideUpdateBanner() {
  updateBannerEl.classList.add('hidden');
}

function checkForUpdate() {
  if (!swRegistration) return;
  const now = Date.now();
  if (now - lastUpdateCheckAt < UPDATE_CHECK_MIN_INTERVAL_MS) return;
  lastUpdateCheckAt = now;
  // A failed check (offline, flaky connection) must never break normal use.
  swRegistration.update().catch(() => {});
}

function watchForWaitingWorker(registration) {
  // Covers the case where an update finished installing while this page
  // wasn't open (e.g. a background check from a previous visit).
  if (registration.waiting && navigator.serviceWorker.controller) {
    showUpdateBanner();
  }
  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) return;
    newWorker.addEventListener('statechange', () => {
      // Only prompt for an *update* (a controller already exists from a
      // previous visit) — a first-ever install has nothing to replace.
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        showUpdateBanner();
      }
    });
  });
}

updateApplyBtn.addEventListener('click', () => {
  updateRequested = true;
  swRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
});

updateDismissBtn.addEventListener('click', hideUpdateBanner);

if ('serviceWorker' in navigator) {
  // `controllerchange` also fires the very first time a page is claimed
  // (no controller -> new worker), not just on a genuine update handoff —
  // reloading then would needlessly refresh a brand-new first visit. Only
  // reload when *we* asked for the update via the banner, and only once.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRequested || hasReloadedForUpdate) return;
    hasReloadedForUpdate = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    const base = new URL('.', window.location.href);
    navigator.serviceWorker.register(new URL('sw.js', base))
      .then((registration) => {
        swRegistration = registration;
        watchForWaitingWorker(registration);
        checkForUpdate();
      })
      .catch(() => {
        // offline support is a nice-to-have; ignore registration failures
      });
  });

  // iOS Home Screen PWAs are almost always *resumed*, not cold-launched —
  // re-check whenever the app comes back to the foreground, not just once
  // at load. Throttled by checkForUpdate() to avoid excessive polling.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('pageshow', () => checkForUpdate());
}

// --- Boot --------------------------------------------------------------

if (!isStorageAvailable()) {
  storageWarningEl.classList.remove('hidden');
}
applyTheme(appState.preferences.theme ?? 'auto');
syncAll();
