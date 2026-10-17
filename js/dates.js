// Local-calendar-date helpers.
//
// Everything here works with Date objects constructed from Y/M/D components
// (which JS resolves in the *local* timezone) rather than ISO-string parsing
// via `new Date('2026-01-01')` (which parses as UTC and can shift a day in
// negative-UTC-offset timezones). This matches FR-04's requirement to avoid
// UTC conversions that could shift a day.

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Parse a "YYYY-MM-DD" string into a local-midnight Date. */
export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a local Date as "YYYY-MM-DD" using local components (no UTC shift). */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Return a new Date n calendar days after the given local Date. */
export function addDays(date, n) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function weekdayName(date) {
  return WEEKDAY_NAMES[date.getDay()];
}

export function weekdayIndex(date) {
  return date.getDay(); // 0 = Sunday .. 6 = Saturday
}

/** "13 October 2026" */
export function formatLongDate(date) {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** "Tuesday 13 October 2026" */
export function formatWeekdayAndDate(date) {
  return `${weekdayName(date)} ${formatLongDate(date)}`;
}

/** "Tuesday 13 October – Monday 19 October 2026" (year shown once, at the end,
 *  or twice if the range spans a year boundary). */
export function formatWeekRange(startDate, endDate) {
  const startY = startDate.getFullYear();
  const endY = endDate.getFullYear();
  const startPart = `${weekdayName(startDate)} ${startDate.getDate()} ${MONTH_NAMES[startDate.getMonth()]}`;
  const endPart = `${weekdayName(endDate)} ${endDate.getDate()} ${MONTH_NAMES[endDate.getMonth()]}`;
  if (startY === endY) {
    return `${startPart} – ${endPart} ${endY}`;
  }
  return `${startPart} ${startY} – ${endPart} ${endY}`;
}

export const WEEKDAYS_MON_FIRST = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

/** Today, as a local-midnight Date with time stripped. */
export function todayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Given any local date and a target weekday name (e.g. "Tuesday"), return the
 * date within the same Mon-Sun calendar week that falls on that weekday.
 */
export function sameWeekOccurrence(date, targetWeekdayName) {
  const targetIdx = WEEKDAY_NAMES.indexOf(targetWeekdayName);
  const diff = targetIdx - date.getDay();
  return addDays(date, diff);
}
