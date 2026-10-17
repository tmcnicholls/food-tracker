// Deterministic, testable meal-plan generator (PRD section 6.2).
//
// Given a start date, a consistency profile and a seed, always produces the
// same week. The app only calls this with a fresh seed when the user
// explicitly generates/regenerates — never on a plain page load.

import { breakfast, lunch, tea, snacks, takeaway, takeawayCategories } from './mealLibrary.js';
import { addDays, parseISODate, toISODate, weekdayName } from './dates.js';
import {
  mulberry32, pickFromArray, weightedPick, freshSeed,
} from './rng.js';

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

const SIMPLE_LIBRARIES = { breakfast, lunch, snacks };

/**
 * Re-roll a single meal within an already-generated week, without touching
 * anything else. Used by the per-meal "get a different suggestion" button.
 * Picks a fresh random replacement (not derived from the week's stored
 * seed), excludes the meal's current text, and — for tea — still avoids
 * repeating another day's tea (or, for a Saturday takeaway, stays within
 * the week's already-chosen takeaway category).
 *
 * @param {object} week - a week record as produced by generateWeek()
 * @param {number} dayIndex - 0-6
 * @param {'breakfast'|'lunch'|'tea'|'snacks'} mealKey
 * @returns {{ suggestion: string, text: string, status: 'suggested' }}
 */
export function regenerateMeal(week, dayIndex, mealKey) {
  const rng = mulberry32(freshSeed());
  const day = week.days[dayIndex];
  const isWeekday = !WEEKEND_DAYS.has(day.weekday);
  const ctx = { profile: week.profile, isWeekday };
  const currentText = day.meals[mealKey].text;

  let newText;

  if (mealKey === 'tea' && day.weekday === 'Saturday' && week.takeawayEnabled && week.takeawayCategory) {
    const options = takeaway[week.takeawayCategory].filter((t) => t !== currentText);
    newText = pickFromArray(options.length ? options : takeaway[week.takeawayCategory], rng);
  } else if (mealKey === 'tea') {
    const usedElsewhere = new Set(
      week.days
        .filter((_, i) => i !== dayIndex)
        .map((d) => d.meals.tea.text),
    );
    usedElsewhere.add(currentText);
    const pool = tea.filter((item) => !usedElsewhere.has(item.text));
    newText = weightedPick(pool.length ? pool : tea, rng, (item) => weightFor(item, ctx)).text;
  } else if (mealKey === 'lunch') {
    const prevDay = dayIndex > 0 ? week.days[dayIndex - 1] : null;
    const prevTeaItem = prevDay ? tea.find((item) => item.text === prevDay.meals.tea.text) : null;
    const leftoverChance = PROFILE_WEIGHTS[week.profile]?.leftoverChance ?? 0.25;
    if (prevTeaItem?.tags?.leftoverSource && rng() < leftoverChance) {
      const leftoverText = `Leftover ${mainDishName(prevTeaItem.text)}`;
      newText = leftoverText !== currentText ? leftoverText : undefined;
    }
    if (!newText) {
      const pool = lunch.filter((item) => item.text !== currentText);
      newText = weightedPick(pool.length ? pool : lunch, rng, (item) => weightFor(item, ctx)).text;
    }
  } else {
    const lib = SIMPLE_LIBRARIES[mealKey];
    const pool = lib.filter((item) => item.text !== currentText);
    newText = weightedPick(pool.length ? pool : lib, rng, (item) => weightFor(item, ctx)).text;
  }

  return { suggestion: newText, text: newText, status: 'suggested' };
}
