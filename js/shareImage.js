// Share-as-images export: draws the week onto two portrait 9:16 images
// (days 1–4, then days 5–7) so a teammate can show the journal to the coach
// from a group chat on weeks the user can't attend.
//
// Drawn directly with the 2D canvas API from the saved week data rather
// than by capturing the DOM: no third-party library, no network, works
// offline, and the output looks identical whatever theme or screen size
// the app is being viewed in.

import { addDays, parseISODate, formatLongDate, formatWeekRange, weekdayName } from './dates.js';

export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1920;
export const DAYS_PER_PAGE = [4, 3];

const MEAL_ORDER = ['breakfast', 'lunch', 'tea', 'snacks'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', tea: 'Tea', snacks: 'Snacks' };

// Fixed light palette (matches the app's light theme) so every image looks
// the same regardless of the sharer's theme setting.
const COLOURS = {
  bg: '#f6f5f1',
  card: '#ffffff',
  border: '#d9d6cc',
  text: '#1c1c1a',
  muted: '#5b5a54',
  header: '#1b5e3d',
  headerText: '#ffffff',
  headerMuted: 'rgba(255, 255, 255, 0.82)',
  unassessed: '#d9d6cc',
};

// Short labels for the image; the coloured dot carries the RAG colour and
// the word means it never relies on colour alone (PRD section 8).
const STATUS_STYLE = {
  green: { label: 'On track', colour: '#1b5e3d' },
  amber: { label: 'Mixed', colour: '#b5650a' },
  red: { label: 'Off plan', colour: '#a4302a' },
};

const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const MARGIN = 48;
const HEADER_HEIGHT = 280;
const FOOTER_HEIGHT = 100;
const CONTENT_GAP = 32;
const CONTENT_TOP = HEADER_HEIGHT + CONTENT_GAP;
const CONTENT_BOTTOM = IMAGE_HEIGHT - FOOTER_HEIGHT - CONTENT_GAP;

// Base sizes for a day card at scale 1. Long meal text shrinks the whole
// page's scale (and, as a last resort, the lines allowed per meal) until
// every card fits, so nothing is ever cut off the bottom of an image.
const CARD = {
  pad: 28,
  strip: 10,
  radius: 24,
  headingSize: 44,
  headingLine: 52,
  headingGap: 12,
  chipSize: 30,
  chipDot: 12,
  labelSize: 32,
  labelColumn: 190,
  textSize: 36,
  textLine: 46,
  rowGap: 10,
  cardGap: 28,
};
const SCALES = [1, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.68, 0.64, 0.6];
const MAX_LINES_STEPS = [3, 2, 1];

function font(weight, size, style = 'normal') {
  return `${style} ${weight} ${Math.round(size)}px ${FONT_FAMILY}`;
}

/**
 * Turn a saved week into the content of each image, independent of any
 * drawing. Follows the same rules as the plain-text export: unreviewed
 * days show no status, unconfirmed meals print plainly, skipped meals say
 * "Skipped".
 */
export function buildPages(week, { name = '' } = {}) {
  const start = parseISODate(week.startDate);
  const weekRange = formatWeekRange(start, addDays(start, 6));
  const days = week.days.map((day) => {
    const date = parseISODate(day.date);
    return {
      heading: `${weekdayName(date)} ${formatLongDate(date)}`,
      status: STATUS_STYLE[day.status] ?? null,
      meals: MEAL_ORDER.map((key) => {
        const meal = day.meals[key];
        const skipped = meal.status === 'skipped';
        return { label: MEAL_LABELS[key], text: skipped ? 'Skipped' : meal.text, skipped };
      }),
    };
  });

  let next = 0;
  return DAYS_PER_PAGE.map((count, i) => {
    const first = next + 1;
    const pageDays = days.slice(next, next + count);
    next += pageDays.length;
    return {
      name: name.trim(),
      weekRange,
      pageNumber: i + 1,
      pageCount: DAYS_PER_PAGE.length,
      dayRangeLabel: `Days ${first}–${next} of ${days.length}`,
      days: pageDays,
    };
  });
}

/** Word-wrap `text` to `maxWidth`, ending with an ellipsis past `maxLines`. */
function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      return;
    }
    if (line) lines.push(line);
    line = word;
    // A single word wider than the column gets broken mid-word.
    while (ctx.measureText(line).width > maxWidth && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut -= 1;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  });
  if (line) lines.push(line);
  if (!lines.length) return [''];
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/** Largest font size (from `size` down to `minSize`) at which `text` fits. */
function fitFontSize(ctx, text, weight, size, minSize, maxWidth) {
  let s = size;
  ctx.font = font(weight, s);
  while (s > minSize && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = font(weight, s);
  }
  return s;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function layoutDay(ctx, day, scale, maxLines) {
  const c = Object.fromEntries(Object.entries(CARD).map(([k, v]) => [k, v * scale]));
  const textWidth = IMAGE_WIDTH - 2 * MARGIN - 2 * c.pad - c.strip - c.labelColumn;
  const meals = day.meals.map((meal) => {
    ctx.font = font(400, c.textSize, meal.skipped ? 'italic' : 'normal');
    return { ...meal, lines: wrapText(ctx, meal.text, textWidth, maxLines) };
  });
  const mealsHeight = meals.reduce((sum, m) => sum + m.lines.length * c.textLine, 0)
    + c.rowGap * (meals.length - 1);
  const height = 2 * c.pad + c.headingLine + c.headingGap + mealsHeight;
  return { day, meals, height, c };
}

/** Pick the largest scale (then most lines per meal) at which all cards fit. */
function layoutPage(ctx, page) {
  const available = CONTENT_BOTTOM - CONTENT_TOP;
  let last = null;
  for (const maxLines of MAX_LINES_STEPS) {
    for (const scale of SCALES) {
      const cards = page.days.map((day) => layoutDay(ctx, day, scale, maxLines));
      const total = cards.reduce((sum, card) => sum + card.height, 0)
        + CARD.cardGap * scale * (cards.length - 1);
      last = { cards, scale, maxLines, total, fits: total <= available };
      if (last.fits) return last;
    }
  }
  return last;
}

function drawHeader(ctx, page) {
  ctx.fillStyle = COLOURS.header;
  ctx.fillRect(0, 0, IMAGE_WIDTH, HEADER_HEIGHT);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const pill = `${page.pageNumber} / ${page.pageCount}`;
  ctx.font = font(700, 28);
  const pillWidth = ctx.measureText(pill).width + 36;
  const pillX = IMAGE_WIDTH - MARGIN - pillWidth;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  roundRectPath(ctx, pillX, 46, pillWidth, 48, 24);
  ctx.fill();
  ctx.fillStyle = COLOURS.headerText;
  ctx.fillText(pill, pillX + 18, 71);

  ctx.font = font(600, 32);
  ctx.fillStyle = COLOURS.headerMuted;
  ctx.fillText('MAN v FAT · Weekly Food Journal', MARGIN, 70);

  const fullWidth = IMAGE_WIDTH - 2 * MARGIN;
  if (page.name) {
    fitFontSize(ctx, page.name, 700, 64, 36, fullWidth);
    ctx.fillStyle = COLOURS.headerText;
    ctx.fillText(page.name, MARGIN, 148);
  }

  fitFontSize(ctx, page.weekRange, 500, 36, 24, fullWidth);
  ctx.fillStyle = COLOURS.headerText;
  ctx.fillText(page.weekRange, MARGIN, 220);
}

function drawFooter(ctx, page) {
  const y = IMAGE_HEIGHT - FOOTER_HEIGHT;
  ctx.fillStyle = COLOURS.border;
  ctx.fillRect(MARGIN, y, IMAGE_WIDTH - 2 * MARGIN, 2);

  const mid = y + FOOTER_HEIGHT / 2;
  ctx.textBaseline = 'middle';
  ctx.font = font(500, 28);
  let x = MARGIN;
  Object.values(STATUS_STYLE).forEach(({ label, colour }) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x + 11, mid, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.muted;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 30, mid);
    x += 30 + ctx.measureText(label).width + 36;
  });

  ctx.textAlign = 'right';
  ctx.fillText(page.dayRangeLabel, IMAGE_WIDTH - MARGIN, mid);
  ctx.textAlign = 'left';
}

function drawCard(ctx, card, y) {
  const { c, day, meals, height } = card;
  const x = MARGIN;
  const w = IMAGE_WIDTH - 2 * MARGIN;

  ctx.save();
  roundRectPath(ctx, x, y, w, height, c.radius);
  ctx.fillStyle = COLOURS.card;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = day.status ? day.status.colour : COLOURS.unassessed;
  ctx.fillRect(x, y, c.strip, height);
  ctx.restore();
  roundRectPath(ctx, x, y, w, height, c.radius);
  ctx.strokeStyle = COLOURS.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  const left = x + c.strip + c.pad;
  const right = x + w - c.pad;
  const headingMid = y + c.pad + c.headingLine / 2;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLOURS.text;
  ctx.font = font(700, c.headingSize);
  ctx.fillText(day.heading, left, headingMid);

  if (day.status) {
    ctx.font = font(700, c.chipSize);
    const labelWidth = ctx.measureText(day.status.label).width;
    ctx.fillStyle = day.status.colour;
    ctx.fillText(day.status.label, right - labelWidth, headingMid);
    ctx.beginPath();
    ctx.arc(right - labelWidth - c.chipDot - 10, headingMid, c.chipDot, 0, Math.PI * 2);
    ctx.fill();
  }

  let rowY = y + c.pad + c.headingLine + c.headingGap;
  meals.forEach((meal) => {
    ctx.font = font(600, c.labelSize);
    ctx.fillStyle = COLOURS.muted;
    ctx.fillText(meal.label, left, rowY + c.textLine / 2);

    ctx.font = font(400, c.textSize, meal.skipped ? 'italic' : 'normal');
    ctx.fillStyle = meal.skipped ? COLOURS.muted : COLOURS.text;
    meal.lines.forEach((line, i) => {
      ctx.fillText(line, left + c.labelColumn, rowY + c.textLine * i + c.textLine / 2);
    });
    rowY += meal.lines.length * c.textLine + c.rowGap;
  });
}

function renderPage(canvas, page) {
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLOURS.bg;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  drawHeader(ctx, page);
  const layout = layoutPage(ctx, page);
  let y = CONTENT_TOP;
  layout.cards.forEach((card) => {
    drawCard(ctx, card, y);
    y += card.height + CARD.cardGap * layout.scale;
  });
  drawFooter(ctx, page);

  return { scale: layout.scale, maxLines: layout.maxLines, fits: layout.fits };
}

/** Draw every page of the week; returns one canvas (plus layout info) per image. */
export function renderWeekImages(week, { name = '' } = {}, doc = document) {
  return buildPages(week, { name }).map((page) => {
    const canvas = doc.createElement('canvas');
    return { canvas, page, ...renderPage(canvas, page) };
  });
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image'))), 'image/png');
  });
}
