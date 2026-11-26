const UNICODE_FRACTIONS = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

const CLEAN_FRACTIONS = [
  { value: 0.125, label: '1/8' },
  { value: 0.25, label: '1/4' },
  { value: 1 / 3, label: '1/3' },
  { value: 0.375, label: '3/8' },
  { value: 0.5, label: '1/2' },
  { value: 0.625, label: '5/8' },
  { value: 2 / 3, label: '2/3' },
  { value: 0.75, label: '3/4' },
  { value: 0.875, label: '7/8' },
];

const QTY_TOKEN_SOURCE =
  '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])';

const LEADING_RANGE_RE = new RegExp(
  `^(\\s*)(${QTY_TOKEN_SOURCE})(\\s*(?:-|–|to)\\s*)(${QTY_TOKEN_SOURCE})(?=\\s|$|[a-zA-Z])`
);

const LEADING_SINGLE_RE = new RegExp(`^(\\s*)(${QTY_TOKEN_SOURCE})(?=\\s|$|[a-zA-Z])`);

/**
 * Parses an integer, decimal, slash fraction, mixed number, or Unicode fraction into a number.
 * Returns null if the token is not a positive numeric quantity.
 */
export function parseQuantityToken(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;

  if (UNICODE_FRACTIONS[raw] !== undefined) {
    return UNICODE_FRACTIONS[raw];
  }

  const unicodeMixed = raw.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (unicodeMixed) {
    return Number(unicodeMixed[1]) + UNICODE_FRACTIONS[unicodeMixed[2]];
  }

  const slashMixed = raw.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (slashMixed) {
    const denom = Number(slashMixed[3]);
    if (!denom) return null;
    return Number(slashMixed[1]) + Number(slashMixed[2]) / denom;
  }

  const slashOnly = raw.match(/^(\d+)\/(\d+)$/);
  if (slashOnly) {
    const denom = Number(slashOnly[2]);
    if (!denom) return null;
    return Number(slashOnly[1]) / denom;
  }

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  return null;
}

/**
 * Formats a positive numeric quantity using clean kitchen fractions when close, or trimmed decimals.
 */
export function formatQuantity(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';

  const whole = Math.floor(num);
  const remainder = num - whole;

  if (remainder < 0.02) {
    return String(whole || 0);
  }
  if (remainder > 0.98) {
    return String(whole + 1);
  }

  for (const frac of CLEAN_FRACTIONS) {
    if (Math.abs(remainder - frac.value) <= 0.02) {
      return whole > 0 ? `${whole} ${frac.label}` : frac.label;
    }
  }

  return String(Number(num.toFixed(2)));
}

/**
 * Scales leading quantity or quantity range in an ingredient line by the given factor.
 */
export function scaleIngredientLine(line, factor = 1) {
  const text = String(line ?? '');
  const numericFactor = Number(factor);
  if (!text.trim() || !Number.isFinite(numericFactor) || numericFactor === 1 || numericFactor <= 0) {
    return text;
  }

  const rangeMatch = text.match(LEADING_RANGE_RE);
  if (rangeMatch) {
    const [, prefix, startTok, sep, endTok] = rangeMatch;
    const startVal = parseQuantityToken(startTok);
    const endVal = parseQuantityToken(endTok);
    if (startVal !== null && endVal !== null) {
      const rest = text.slice(rangeMatch[0].length);
      return `${prefix}${formatQuantity(startVal * numericFactor)}${sep}${formatQuantity(
        endVal * numericFactor
      )}${rest}`;
    }
  }

  const singleMatch = text.match(LEADING_SINGLE_RE);
  if (singleMatch) {
    const [, prefix, qtyTok] = singleMatch;
    const qtyVal = parseQuantityToken(qtyTok);
    if (qtyVal !== null) {
      const rest = text.slice(singleMatch[0].length);
      return `${prefix}${formatQuantity(qtyVal * numericFactor)}${rest}`;
    }
  }

  return text;
}
