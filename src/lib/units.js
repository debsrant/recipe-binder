import { parseQuantityToken, scaleIngredientLine } from './scaling.js';

export const ML_PER_CUP = 236.588;

export const VOLUME_UNITS = {
  tsp: { id: 'tsp', label: 'tsp', name: 'Teaspoon', toMl: 4.92892 },
  tbsp: { id: 'tbsp', label: 'tbsp', name: 'Tablespoon', toMl: 14.7868 },
  'fl-oz': { id: 'fl-oz', label: 'fl oz', name: 'Fluid Ounce', toMl: 29.5735 },
  cup: { id: 'cup', label: 'cup', name: 'Cup', toMl: ML_PER_CUP },
  pint: { id: 'pint', label: 'pint', name: 'Pint', toMl: 473.176 },
  quart: { id: 'quart', label: 'qt', name: 'Quart', toMl: 946.353 },
  gallon: { id: 'gallon', label: 'gal', name: 'Gallon', toMl: 3785.41 },
  ml: { id: 'ml', label: 'ml', name: 'Milliliter', toMl: 1 },
  l: { id: 'l', label: 'L', name: 'Liter', toMl: 1000 },
};

export const WEIGHT_UNITS = {
  g: { id: 'g', label: 'g', name: 'Gram', toGrams: 1 },
  kg: { id: 'kg', label: 'kg', name: 'Kilogram', toGrams: 1000 },
  oz: { id: 'oz', label: 'oz', name: 'Ounce', toGrams: 28.3495 },
  lb: { id: 'lb', label: 'lb', name: 'Pound', toGrams: 453.592 },
};

export const TEMP_UNITS = {
  f: { id: 'f', label: '°F', name: 'Fahrenheit (°F)' },
  c: { id: 'c', label: '°C', name: 'Celsius (°C)' },
};

export const OVEN_TEMP_PRESETS = [
  { f: 250, c: 120, desc: 'Very slow / dehydrating' },
  { f: 300, c: 150, desc: 'Slow oven / meringues' },
  { f: 325, c: 165, desc: 'Low baking / custards' },
  { f: 350, c: 175, desc: 'Moderate / cookies & cakes' },
  { f: 375, c: 190, desc: 'Moderate-hot / muffins & pies' },
  { f: 400, c: 205, desc: 'Hot / roasting & sheet pans' },
  { f: 425, c: 220, desc: 'Very hot / crisp potatoes' },
  { f: 450, c: 230, desc: 'High heat / pizza & bread' },
  { f: 475, c: 245, desc: 'Maximum roast / sear' },
];

export const INGREDIENT_DENSITIES = [
  { id: 'ap-flour', name: 'All-Purpose Flour', gramsPerCup: 120, aliases: ['all-purpose flour', 'all purpose flour', 'ap flour', 'plain flour'] },
  { id: 'bread-flour', name: 'Bread Flour', gramsPerCup: 127, aliases: ['bread flour', 'strong flour'] },
  { id: 'whole-wheat-flour', name: 'Whole Wheat Flour', gramsPerCup: 113, aliases: ['whole wheat flour', 'whole-wheat flour', 'wholemeal flour'] },
  { id: 'cake-flour', name: 'Cake / Pastry Flour', gramsPerCup: 115, aliases: ['cake flour', 'pastry flour'] },
  { id: 'almond-flour', name: 'Almond Flour', gramsPerCup: 96, aliases: ['almond flour', 'almond meal'] },
  { id: 'granulated-sugar', name: 'Granulated Sugar', gramsPerCup: 200, aliases: ['granulated sugar', 'white sugar', 'caster sugar', 'sugar'] },
  { id: 'brown-sugar', name: 'Brown Sugar (packed)', gramsPerCup: 213, aliases: ['dark brown sugar', 'light brown sugar', 'brown sugar'] },
  { id: 'powdered-sugar', name: 'Powdered / Confectioners Sugar', gramsPerCup: 113, aliases: ['powdered sugar', 'confectioners sugar', 'icing sugar'] },
  { id: 'butter', name: 'Butter', gramsPerCup: 227, aliases: ['unsalted butter', 'salted butter', 'melted butter', 'butter'] },
  { id: 'milk', name: 'Milk / Buttermilk', gramsPerCup: 244, aliases: ['whole milk', 'buttermilk', 'skim milk', 'milk'] },
  { id: 'heavy-cream', name: 'Heavy Cream', gramsPerCup: 238, aliases: ['heavy whipping cream', 'heavy cream', 'whipping cream'] },
  { id: 'water', name: 'Water / Broth', gramsPerCup: 237, aliases: ['chicken broth', 'beef broth', 'vegetable broth', 'chicken stock', 'water', 'broth', 'stock', 'lemon juice'] },
  { id: 'oil', name: 'Cooking Oil (Olive / Vegetable)', gramsPerCup: 216, aliases: ['extra-virgin olive oil', 'olive oil', 'vegetable oil', 'canola oil', 'avocado oil', 'oil'] },
  { id: 'honey', name: 'Honey / Maple Syrup', gramsPerCup: 340, aliases: ['maple syrup', 'honey', 'molasses', 'corn syrup'] },
  { id: 'cocoa-powder', name: 'Cocoa Powder', gramsPerCup: 85, aliases: ['dutch-process cocoa', 'cocoa powder', 'cocoa'] },
  { id: 'chocolate-chips', name: 'Chocolate Chips / Chunks', gramsPerCup: 170, aliases: ['chocolate chips', 'chocolate chunks', 'bittersweet chocolate'] },
  { id: 'rolled-oats', name: 'Rolled Oats', gramsPerCup: 90, aliases: ['old-fashioned oats', 'rolled oats', 'quick oats', 'oats'] },
  { id: 'white-rice', name: 'Uncooked White Rice', gramsPerCup: 185, aliases: ['jasmine rice', 'basmati rice', 'white rice', 'rice'] },
  { id: 'kosher-salt', name: 'Kosher Salt', gramsPerCup: 144, aliases: ['kosher salt', 'flaky sea salt'] },
  { id: 'fine-salt', name: 'Fine Table / Sea Salt', gramsPerCup: 288, aliases: ['table salt', 'fine salt', 'fine sea salt', 'salt'] },
  { id: 'baking-powder', name: 'Baking Powder', gramsPerCup: 192, aliases: ['baking powder'] },
  { id: 'baking-soda', name: 'Baking Soda', gramsPerCup: 221, aliases: ['baking soda', 'bicarbonate of soda'] },
  { id: 'cornstarch', name: 'Cornstarch', gramsPerCup: 128, aliases: ['cornstarch', 'cornflour'] },
  { id: 'yogurt', name: 'Sour Cream / Greek Yogurt', gramsPerCup: 230, aliases: ['sour cream', 'greek yogurt', 'plain yogurt', 'yogurt'] },
  { id: 'shredded-cheese', name: 'Shredded Cheese / Crumbled Feta', gramsPerCup: 113, aliases: ['shredded cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta'] },
  { id: 'peanut-butter', name: 'Peanut / Nut Butter', gramsPerCup: 258, aliases: ['peanut butter', 'almond butter'] },
];

const SORTED_DENSITY_ALIASES = INGREDIENT_DENSITIES.flatMap((entry) =>
  entry.aliases.map((alias) => ({
    alias,
    entry,
    re: new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  }))
).sort((a, b) => b.alias.length - a.alias.length);

/**
 * Finds the best matching ingredient density entry by ID or ingredient line text.
 */
export function findIngredientDensity(textOrId) {
  const clean = String(textOrId || '').trim();
  if (!clean) return null;
  const byId = INGREDIENT_DENSITIES.find((d) => d.id === clean);
  if (byId) return byId;

  for (const candidate of SORTED_DENSITY_ALIASES) {
    if (candidate.re.test(clean)) {
      return candidate.entry;
    }
  }
  return null;
}

function getUnitKind(unitId) {
  if (VOLUME_UNITS[unitId]) return 'volume';
  if (WEIGHT_UNITS[unitId]) return 'weight';
  if (TEMP_UNITS[unitId]) return 'temp';
  return null;
}

function getUnitMeta(unitId) {
  return VOLUME_UNITS[unitId] || WEIGHT_UNITS[unitId] || TEMP_UNITS[unitId] || null;
}

function parseSignedQuantity(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (/^-\d+(?:\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return parseQuantityToken(trimmed);
}

/**
 * Formats a converted number cleanly for display in kitchen tools and ingredient lists.
 */
export function formatMeasureNumber(value, unitId = '') {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  if (unitId === 'f' || unitId === 'c') {
    return String(Math.round(num));
  }
  const abs = Math.abs(num);
  if (unitId === 'g' || unitId === 'ml') {
    if (abs >= 10) return String(Math.round(num));
    return String(Number(num.toFixed(1)));
  }
  if (abs >= 100) return String(Math.round(num));
  if (abs >= 10) return String(Number(num.toFixed(1)));
  return String(Number(num.toFixed(2)));
}

/**
 * Converts a measurement between Volume, Weight, Temperature, or Volume <-> Weight (using ingredient density).
 */
export function convertMeasurement({ value, fromUnit, toUnit, ingredientId = '' }) {
  const numeric = parseSignedQuantity(value);
  const fromMeta = getUnitMeta(fromUnit);
  const toMeta = getUnitMeta(toUnit);
  const fromKind = getUnitKind(fromUnit);
  const toKind = getUnitKind(toUnit);

  if (!fromMeta || !toMeta) {
    return { ok: false, error: 'Choose valid source and target units.' };
  }
  if (numeric === null) {
    return { ok: false, error: 'Enter a valid number or fraction (e.g., 1 1/2 or 0.75).' };
  }
  if (fromKind !== 'temp' && numeric < 0) {
    return { ok: false, error: 'Volume and weight quantities must be zero or positive.' };
  }

  if (fromUnit === toUnit) {
    return {
      ok: true,
      value: numeric,
      formatted: formatMeasureNumber(numeric, toUnit),
      fromLabel: fromMeta.label,
      toLabel: toMeta.label,
      note: '',
    };
  }

  if (fromKind === 'temp' || toKind === 'temp') {
    if (fromKind !== toKind) {
      return { ok: false, error: 'Temperature can only convert between °F and °C.' };
    }
    const result = fromUnit === 'f' ? ((numeric - 32) * 5) / 9 : (numeric * 9) / 5 + 32;
    return {
      ok: true,
      value: result,
      formatted: formatMeasureNumber(result, toUnit),
      fromLabel: fromMeta.label,
      toLabel: toMeta.label,
      note: `${numeric}°${fromUnit.toUpperCase()} = ${Math.round(result)}°${toUnit.toUpperCase()}`,
    };
  }

  if (fromKind === 'volume' && toKind === 'volume') {
    const ml = numeric * fromMeta.toMl;
    const result = ml / toMeta.toMl;
    return {
      ok: true,
      value: result,
      formatted: formatMeasureNumber(result, toUnit),
      fromLabel: fromMeta.label,
      toLabel: toMeta.label,
      note: '',
    };
  }

  if (fromKind === 'weight' && toKind === 'weight') {
    const grams = numeric * fromMeta.toGrams;
    const result = grams / toMeta.toGrams;
    return {
      ok: true,
      value: result,
      formatted: formatMeasureNumber(result, toUnit),
      fromLabel: fromMeta.label,
      toLabel: toMeta.label,
      note: '',
    };
  }

  const density = findIngredientDensity(ingredientId);
  if (!density) {
    return {
      ok: false,
      error: 'Select an ingredient density to convert between Volume and Weight.',
    };
  }

  let result;
  if (fromKind === 'volume' && toKind === 'weight') {
    const cups = (numeric * fromMeta.toMl) / ML_PER_CUP;
    const grams = cups * density.gramsPerCup;
    result = grams / toMeta.toGrams;
  } else {
    const grams = numeric * fromMeta.toGrams;
    const cups = grams / density.gramsPerCup;
    const ml = cups * ML_PER_CUP;
    result = ml / toMeta.toMl;
  }

  return {
    ok: true,
    value: result,
    formatted: formatMeasureNumber(result, toUnit),
    fromLabel: fromMeta.label,
    toLabel: toMeta.label,
    note: `Based on ${density.name} (~${density.gramsPerCup} g per cup)`,
  };
}

/**
 * Generates quick secondary kitchen equivalents for a given quantity & unit.
 */
export function getQuickEquivalents(rawValue, fromUnit, ingredientId = '') {
  const kind = getUnitKind(fromUnit);
  if (!kind) return [];

  let targets = [];
  if (kind === 'temp') {
    targets = [fromUnit === 'f' ? 'c' : 'f'];
  } else if (kind === 'volume') {
    targets = ['tsp', 'tbsp', 'fl-oz', 'cup', 'ml'].filter((u) => u !== fromUnit);
    if (findIngredientDensity(ingredientId)) {
      targets.push('g', 'oz');
    }
  } else {
    targets = ['g', 'kg', 'oz', 'lb'].filter((u) => u !== fromUnit);
    if (findIngredientDensity(ingredientId)) {
      targets.push('cup', 'tbsp');
    }
  }

  const items = [];
  for (const target of targets) {
    const res = convertMeasurement({
      value: rawValue,
      fromUnit,
      toUnit: target,
      ingredientId,
    });
    if (res.ok) {
      items.push({
        unit: target,
        label: res.toLabel,
        value: `${res.formatted} ${res.toLabel}`,
      });
    }
  }
  return items;
}

const UNIT_ALIASES = {
  tsp: 'tsp',
  tsps: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tbsp: 'tbsp',
  tbsps: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  'fl oz': 'fl-oz',
  'fl. oz': 'fl-oz',
  'fluid ounce': 'fl-oz',
  'fluid ounces': 'fl-oz',
  cup: 'cup',
  cups: 'cup',
  c: 'cup',
  pint: 'pint',
  pints: 'pint',
  pt: 'pint',
  quart: 'quart',
  quarts: 'quart',
  qt: 'quart',
  qts: 'quart',
  gallon: 'gallon',
  gallons: 'gallon',
  gal: 'gallon',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
};

const QTY_TOKEN =
  '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])';
const UNIT_PATTERN =
  'fl\\.?\\s*oz|fluid\\s+ounces?|tablespoons?|tbsps?|teaspoons?|tsps?|cups?|pints?|quarts?|gallons?|milliliters?|ml|liters?|kilograms?|kg|grams?|ounces?|oz|pounds?|lbs?|lb|qt|qts|pt|gal|g|l';

const LEADING_UNIT_RANGE_RE = new RegExp(
  `^(\\s*)(${QTY_TOKEN})(\\s*(?:-|–|to)\\s*)(${QTY_TOKEN})\\s+(${UNIT_PATTERN})\\b\\.?(\\s+.*)?$`,
  'i'
);

const LEADING_UNIT_SINGLE_RE = new RegExp(
  `^(\\s*)(${QTY_TOKEN})\\s+(${UNIT_PATTERN})\\b\\.?(\\s+.*)?$`,
  'i'
);

function normalizeParsedUnit(rawUnit) {
  const key = String(rawUnit || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return UNIT_ALIASES[key] || null;
}

function chooseConvertedTarget(value, fromUnit, unitMode, ingredientRest) {
  const kind = getUnitKind(fromUnit);
  if (!kind || kind === 'temp') return null;

  if (unitMode === 'metric') {
    if (fromUnit === 'g' || fromUnit === 'kg' || fromUnit === 'ml' || fromUnit === 'l') {
      return null;
    }
    if (kind === 'weight') {
      const grams = value * WEIGHT_UNITS[fromUnit].toGrams;
      return grams >= 1000 ? 'kg' : 'g';
    }
    if (kind === 'volume') {
      const density = findIngredientDensity(ingredientRest);
      if (density) {
        const cups = (value * VOLUME_UNITS[fromUnit].toMl) / ML_PER_CUP;
        const grams = cups * density.gramsPerCup;
        return grams >= 1000 ? 'kg' : 'g';
      }
      const ml = value * VOLUME_UNITS[fromUnit].toMl;
      return ml >= 1000 ? 'l' : 'ml';
    }
  }

  if (unitMode === 'us-weight') {
    if (fromUnit === 'oz' || fromUnit === 'lb') {
      return null;
    }
    if (kind === 'weight') {
      const oz = (value * WEIGHT_UNITS[fromUnit].toGrams) / WEIGHT_UNITS.oz.toGrams;
      return oz >= 16 ? 'lb' : 'oz';
    }
    if (kind === 'volume') {
      const density = findIngredientDensity(ingredientRest);
      if (!density) return null;
      const cups = (value * VOLUME_UNITS[fromUnit].toMl) / ML_PER_CUP;
      const oz = (cups * density.gramsPerCup) / WEIGHT_UNITS.oz.toGrams;
      return oz >= 16 ? 'lb' : 'oz';
    }
  }

  return null;
}

/**
 * Scales an ingredient line and optionally converts its unit to Metric (`g / ml`) or US Weight (`oz / lb`).
 */
export function convertIngredientLine(line, unitMode = 'original', scaleFactor = 1) {
  const scaled = scaleIngredientLine(line, scaleFactor);
  if (!scaled || unitMode === 'original') return scaled;

  const rangeMatch = scaled.match(LEADING_UNIT_RANGE_RE);
  if (rangeMatch) {
    const [, prefix, startTok, sep, endTok, rawUnit, rest = ''] = rangeMatch;
    const fromUnit = normalizeParsedUnit(rawUnit);
    const startVal = parseQuantityToken(startTok);
    const endVal = parseQuantityToken(endTok);
    if (fromUnit && startVal !== null && endVal !== null) {
      const targetUnit = chooseConvertedTarget(endVal, fromUnit, unitMode, rest);
      if (targetUnit) {
        const density = findIngredientDensity(rest);
        const startRes = convertMeasurement({
          value: startVal,
          fromUnit,
          toUnit: targetUnit,
          ingredientId: density?.id || '',
        });
        const endRes = convertMeasurement({
          value: endVal,
          fromUnit,
          toUnit: targetUnit,
          ingredientId: density?.id || '',
        });
        if (startRes.ok && endRes.ok) {
          return `${prefix}${startRes.formatted}${sep}${endRes.formatted} ${endRes.toLabel}${rest}`;
        }
      }
    }
  }

  const singleMatch = scaled.match(LEADING_UNIT_SINGLE_RE);
  if (singleMatch) {
    const [, prefix, qtyTok, rawUnit, rest = ''] = singleMatch;
    const fromUnit = normalizeParsedUnit(rawUnit);
    const qtyVal = parseQuantityToken(qtyTok);
    if (fromUnit && qtyVal !== null) {
      const targetUnit = chooseConvertedTarget(qtyVal, fromUnit, unitMode, rest);
      if (targetUnit) {
        const density = findIngredientDensity(rest);
        const res = convertMeasurement({
          value: qtyVal,
          fromUnit,
          toUnit: targetUnit,
          ingredientId: density?.id || '',
        });
        if (res.ok) {
          return `${prefix}${res.formatted} ${res.toLabel}${rest}`;
        }
      }
    }
  }

  return scaled;
}
