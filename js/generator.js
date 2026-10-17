// Deterministic, testable meal-plan generator (PRD section 6.2).
//
// Given a start date, a consistency profile and a seed, always produces the
// same week. The app only calls this with a fresh seed when the user
// explicitly generates/regenerates — never on a plain page load.

import { breakfast, lunch, tea, snacks, takeaway, takeawayCategories } from './mealLibrary.js';
import { addDays, parseISODate, toISODate, weekdayName } from './dates.js';
import { mulberry32, pickFromArray, weightedPick } from './rng.js';

const WEEKEND_DAYS = new Set(['Saturday', 'Sunday']);

// How strongly each profile favours "structured" vs "convenience"/"irregular"
// meals. These are generation knobs only — never a judgement of the user.
const PROFILE_WEIGHTS = {
  great: { structuredBonus: 3, convenienceBonus: 0, irregularBonus: 0, leftoverChance: 0.3 },
  medium: { structuredBonus: 1, convenienceBonus: 1.5, irregularBonus: 0.4, leftoverChance: 0.3 },
  poor: { structuredBonus: 0, convenienceBonus: 3, irregularBonus: 1.6, leftoverChance: 0.2 },
};

function weightFor(item, { profile, isWeekday }) {
  const pw = PROFILE_WEIGHTS[profile] ?? PROFILE_WEIGHTS.great;
  const t = item.tags ?? {};
  let w = 1;
  if (t.structured) w += pw.structuredBonus;
  if (t.style === 'convenience') w += pw.convenienceBonus;
  if (t.irregular) w += pw.irregularBonus;

  if (isWeekday) {
    if (t.effort === 'high') w *= 0.3; // keep weekday meals easy, per FR
    if (t.weekend) w *= 0.4;
  } else if (t.weekend) {
    w *= 1.8;
  }
  return Math.max(w, 0.05);
}

function mainDishName(teaText) {
  const main = teaText.split(' with ')[0];
  return main.charAt(0).toLowerCase() + main.slice(1);
}

function makeMealEntry(text) {
  return { suggestion: text, text, status: 'suggested' };
}

/**
 * @param {object} opts
 * @param {string} opts.startDateISO - "YYYY-MM-DD"
 * @param {'great'|'medium'|'poor'} opts.profile
 * @param {boolean} opts.takeawayEnabled
 * @param {number} opts.seed
 * @returns {{ days: object[], takeawayCategory: string|null }}
 */
export function generateWeek({ startDateISO, profile, takeawayEnabled, seed }) {
  const rng = mulberry32(seed);
  const startDate = parseISODate(startDateISO);
  const usedTeaTexts = new Set();
  const days = [];

  const takeawayCategory = takeawayEnabled
    ? pickFromArray(takeawayCategories, rng)
    : null;

  let prevTea = null;

  for (let i = 0; i < 7; i += 1) {
    const date = addDays(startDate, i);
    const wName = weekdayName(date);
    const isWeekday = !WEEKEND_DAYS.has(wName);
    const ctx = { profile, isWeekday };

    const breakfastItem = weightedPick(breakfast, rng, (item) => weightFor(item, ctx));

    let lunchText;
    if (prevTea && prevTea.tags?.leftoverSource && rng() < (PROFILE_WEIGHTS[profile]?.leftoverChance ?? 0.25)) {
      lunchText = `Leftover ${mainDishName(prevTea.text)}`;
    } else {
      lunchText = weightedPick(lunch, rng, (item) => weightFor(item, ctx)).text;
    }

    let teaItem;
    if (wName === 'Saturday' && takeawayEnabled) {
      const text = pickFromArray(takeaway[takeawayCategory], rng);
      teaItem = { text, tags: { style: 'convenience', takeaway: true } };
    } else {
      const pool = tea.filter((item) => !usedTeaTexts.has(item.text));
      teaItem = weightedPick(pool.length ? pool : tea, rng, (item) => weightFor(item, ctx));
      usedTeaTexts.add(teaItem.text);
    }

    const snackItem = weightedPick(snacks, rng, (item) => weightFor(item, ctx));

    days.push({
      date: toISODate(date),
      weekday: wName,
      status: 'unassessed',
      meals: {
        breakfast: makeMealEntry(breakfastItem.text),
        lunch: makeMealEntry(lunchText),
        tea: makeMealEntry(teaItem.text),
        snacks: makeMealEntry(snackItem.text),
      },
    });

    prevTea = teaItem;
  }

  return { days, takeawayCategory };
}
