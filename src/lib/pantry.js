export const PANTRY_CATEGORIES = [
  { id: 'produce', label: 'Produce & Herbs' },
  { id: 'meat-seafood', label: 'Meat & Seafood' },
  { id: 'dairy-eggs', label: 'Dairy & Eggs' },
  { id: 'baking', label: 'Baking & Dry Goods' },
  { id: 'spices-oils', label: 'Spices, Oils & Condiments' },
  { id: 'canned-grains', label: 'Canned, Grains & Pasta' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'other', label: 'Other' },
];

export const PANTRY_LOCATIONS = [
  { id: 'pantry', label: 'Pantry' },
  { id: 'fridge', label: 'Fridge' },
  { id: 'freezer', label: 'Freezer' },
  { id: 'spice-rack', label: 'Spice Rack' },
];

export const PANTRY_STATUSES = [
  { id: 'in-stock', label: 'In Stock' },
  { id: 'low', label: 'Running Low' },
  { id: 'out', label: 'Out / Restock' },
];

const CATEGORY_SET = new Set(PANTRY_CATEGORIES.map((c) => c.id));
const LOCATION_SET = new Set(PANTRY_LOCATIONS.map((l) => l.id));
const STATUS_SET = new Set(PANTRY_STATUSES.map((s) => s.id));

const UNICODE_FRAC_RE = /[\u00BC-\u00BE\u2150-\u215E]/g;
const LEADING_QTY_RE =
  /^\s*(?:about|approx\.?|roughly)?\s*(?:(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(?:[-–—to]+\s*(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?))?\s*)+/i;
const UNIT_PREFIX_RE =
  /^(?:cups?|c\.?|tablespoons?|tbsps?\.?|teaspoons?|tsps?\.?|fluid\s+ounces?|fl\.?\s*oz\.?|ounces?|oz\.?|pounds?|lbs?\.?|grams?|g\.?|kilograms?|kgs?\.?|milliliters?|ml\.?|liters?|l\.?|pints?|pts?\.?|quarts?|qts?\.?|gallons?|gals?\.?|cloves?|cans?|sticks?|pinch(?:es)?|dash(?:es)?|bunche?s?|heads?|slices?|stalks?|sprigs?|packages?|pkgs?\.?|bags?|jars?|boxes?|large|medium|small)\b\s*(?:of\b\s*)?/i;

const TRAILING_NOTE_RE =
  /\b(?:divided|for\s+(?:finishing|serving|garnish|griddle|frying|greasing)|to\s+serve|to\s+taste|at\s+room\s+temperature|plus\s+extra\b.*|or\s+to\s+taste|if\s+desired|optional)\b.*$/i;

const MODIFIER_PREFIXES = [
  'freshly cracked',
  'freshly ground',
  'extra-virgin',
  'extra virgin',
  'boneless',
  'skinless',
  'unsalted',
  'salted',
  'packed',
  'fresh',
  'pure',
  'fine',
  'kosher',
  'flaky',
  'dark',
  'light',
  'bittersweet',
  'melted',
  'large',
  'small',
  'medium',
  'english',
];

function cleanText(value, fallback = '') {
  const str = String(value ?? '').trim();
  return str || fallback;
}

function singularizeWord(word) {
  if (!word || word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word === 'tomatoes' || word === 'potatoes') return word.slice(0, -2);
  if (word === 'thighs' || word === 'eggs' || word === 'cucumbers' || word === 'cloves') {
    return word.slice(0, -1);
  }
  if (!word.endsWith('ss') && !word.endsWith('us') && word.endsWith('s')) {
    return word.slice(0, -1);
  }
  return word;
}

function stripLeadingQuantitiesAndUnits(line) {
  let text = String(line || '')
    .replace(UNICODE_FRAC_RE, ' 1/2 ')
    .replace(/\([^)]*\)/g, ' ')
    .trim();

  // Strip up to two comma/semicolon prep tails after main ingredient
  text = text.split(/\s*(?:,|;|\s-\s)\s*/)[0] || '';
  text = text.replace(TRAILING_NOTE_RE, '').trim();

  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(LEADING_QTY_RE, '').replace(/^of\b\s+/i, '').trim();
    const withUnit = next.replace(UNIT_PREFIX_RE, '').trim();
    if (withUnit === text) break;
    text = withUnit;
  }

  // Handle "1 (14-oz) can diced tomatoes" leftovers
  text = text.replace(UNIT_PREFIX_RE, '').trim();
  return text;
}

/**
 * Extracts a clean, human-readable core ingredient name from a recipe line.
 */
export function extractCoreIngredientName(line) {
  let text = stripLeadingQuantitiesAndUnits(line)
    .replace(/\s+or\s+chips\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Normalizes an ingredient line or pantry name into a canonical lowercase matching key.
 */
export function normalizeIngredientKey(text) {
  let core = stripLeadingQuantitiesAndUnits(text)
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!core) return '';

  // Remove modifier prefixes iteratively
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of MODIFIER_PREFIXES) {
      const cleanPrefix = prefix.replace(/-/g, ' ');
      if (core === cleanPrefix) continue;
      if (core.startsWith(`${cleanPrefix} `)) {
        core = core.slice(cleanPrefix.length + 1).trim();
        changed = true;
      }
    }
  }

  const words = core.split(/\s+/).filter(Boolean).map(singularizeWord);
  return words.join(' ').trim();
}

/**
 * Normalizes a pantry item record.
 */
export function normalizePantryItem(item) {
  const name = cleanText(item?.name, 'Pantry Item');
  const rawCategory = cleanText(item?.category, 'other').toLowerCase();
  const category = CATEGORY_SET.has(rawCategory) ? rawCategory : 'other';
  const rawLocation = cleanText(item?.location, 'pantry').toLowerCase();
  const location = LOCATION_SET.has(rawLocation) ? rawLocation : 'pantry';
  const rawStatus = cleanText(item?.status, 'in-stock').toLowerCase();
  const status = STATUS_SET.has(rawStatus) ? rawStatus : 'in-stock';
  const updatedNum = Number(item?.updatedMs);
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    id: cleanText(item?.id) || `pan-${slug || Date.now()}`,
    name,
    category,
    quantity: cleanText(item?.quantity),
    location,
    status,
    alwaysStocked: Boolean(item?.alwaysStocked),
    notes: cleanText(item?.notes),
    isCustom: Boolean(item?.isCustom),
    updatedMs: Number.isFinite(updatedNum) && updatedNum > 0 ? updatedNum : 1700000000000,
    deleted: Boolean(item?.deleted),
  };
}

/**
 * Starter "Always Stocked" pantry staples.
 */
export function getDefaultPantryData() {
  const baseMs = 1700000000000;
  const starters = [
    { id: 'pan-kosher-salt', name: 'Kosher Salt', category: 'spices-oils', location: 'spice-rack', quantity: '1 box' },
    { id: 'pan-black-pepper', name: 'Black Pepper', category: 'spices-oils', location: 'spice-rack', quantity: '1 grinder' },
    { id: 'pan-olive-oil', name: 'Olive Oil', category: 'spices-oils', location: 'pantry', quantity: '1 bottle' },
    { id: 'pan-unsalted-butter', name: 'Unsalted Butter', category: 'dairy-eggs', location: 'fridge', quantity: '2 sticks' },
    { id: 'pan-garlic', name: 'Garlic', category: 'produce', location: 'pantry', quantity: '1 head' },
    { id: 'pan-ap-flour', name: 'All-Purpose Flour', category: 'baking', location: 'pantry', quantity: '1 bag' },
    { id: 'pan-granulated-sugar', name: 'Granulated Sugar', category: 'baking', location: 'pantry', quantity: '1 bag' },
    { id: 'pan-brown-sugar', name: 'Brown Sugar', category: 'baking', location: 'pantry', quantity: '1 bag' },
    { id: 'pan-baking-soda', name: 'Baking Soda', category: 'baking', location: 'pantry', quantity: '1 box' },
    { id: 'pan-baking-powder', name: 'Baking Powder', category: 'baking', location: 'pantry', quantity: '1 tin' },
    { id: 'pan-eggs', name: 'Eggs', category: 'dairy-eggs', location: 'fridge', quantity: '1 dozen' },
    { id: 'pan-vanilla-extract', name: 'Vanilla Extract', category: 'baking', location: 'pantry', quantity: '1 bottle' },
  ];

  return {
    items: starters.map((s) =>
      normalizePantryItem({
        ...s,
        status: 'in-stock',
        alwaysStocked: true,
        isCustom: false,
        updatedMs: baseMs,
        deleted: false,
      })
    ),
  };
}

function mergePantryArrays(defaults, localList, remoteList) {
  const map = new Map();
  for (const item of defaults) {
    const norm = normalizePantryItem(item);
    map.set(norm.id, norm);
  }
  const applyList = (list) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      const norm = normalizePantryItem(raw);
      const prev = map.get(norm.id);
      if (!prev || norm.updatedMs >= prev.updatedMs) {
        map.set(norm.id, norm);
      }
    }
  };
  applyList(localList);
  applyList(remoteList);
  return Array.from(map.values());
}

/**
 * Normalizes a persisted pantryData blob.
 */
export function normalizePantryData(input) {
  const defaults = getDefaultPantryData();
  const hasItems = Array.isArray(input?.items);
  return {
    items: hasItems
      ? mergePantryArrays(defaults.items, input.items, [])
      : defaults.items,
  };
}

/**
 * Timestamp-aware merge between local and remote pantryData blobs.
 */
export function mergePantryData(localData, remoteData) {
  const defaults = getDefaultPantryData();
  return {
    items: mergePantryArrays(defaults.items, localData?.items, remoteData?.items),
  };
}

/**
 * Inserts or updates a pantry item with a fresh updatedMs timestamp.
 */
export function upsertPantryItem(list, item) {
  const nextItem = normalizePantryItem({
    ...item,
    isCustom: item?.isCustom !== undefined ? item.isCustom : true,
    updatedMs: Date.now(),
    deleted: false,
  });
  const base = Array.isArray(list) ? [...list] : [];
  const idx = base.findIndex((entry) => entry.id === nextItem.id);
  if (idx >= 0) {
    base[idx] = nextItem;
  } else {
    base.push(nextItem);
  }
  return base;
}

/**
 * Soft-deletes (tombstones) a pantry item so deletions sync across devices.
 */
export function deletePantryItem(list, id) {
  const targetId = cleanText(id);
  const base = Array.isArray(list) ? [...list] : [];
  return base.map((item) =>
    item.id === targetId
      ? {
          ...item,
          deleted: true,
          updatedMs: Date.now(),
        }
      : item
  );
}

/**
 * Cycles item status: in-stock -> low -> out -> in-stock.
 */
export function cyclePantryStatus(item) {
  const norm = normalizePantryItem(item);
  const order = ['in-stock', 'low', 'out'];
  const nextIdx = (order.indexOf(norm.status) + 1) % order.length;
  return {
    ...norm,
    status: order[nextIdx],
    updatedMs: Date.now(),
  };
}

/**
 * Toggles the "Always Stocked" staple flag on a pantry item.
 */
export function toggleAlwaysStocked(item) {
  const norm = normalizePantryItem(item);
  return {
    ...norm,
    alwaysStocked: !norm.alwaysStocked,
    updatedMs: Date.now(),
  };
}

/**
 * Extracts unique normalized ingredients from active binder recipes for quick-add and matching.
 */
export function collectBinderIngredients(recipes) {
  const map = new Map();
  for (const recipe of recipes || []) {
    if (!recipe || recipe.deleted) continue;
    const seenInRecipe = new Set();
    for (const line of recipe.ingredients || []) {
      const key = normalizeIngredientKey(line);
      if (!key) continue;
      if (!map.has(key)) {
        const label = extractCoreIngredientName(line) || key;
        map.set(key, { key, label, recipeCount: 0 });
      }
      if (!seenInRecipe.has(key)) {
        seenInRecipe.add(key);
        map.get(key).recipeCount += 1;
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.recipeCount - a.recipeCount || a.label.localeCompare(b.label)
  );
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWordBoundaryPhrase(haystack, needle) {
  if (!haystack || !needle) return false;
  if (haystack === needle) return true;
  const re = new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'i');
  return re.test(haystack);
}

/**
 * Returns true if a recipe ingredient line matches any normalized key in availableKeys.
 */
export function ingredientLineMatches(recipeLine, availableKeys) {
  const lineKey = normalizeIngredientKey(recipeLine);
  if (!lineKey) return false;
  const keys = availableKeys instanceof Set ? availableKeys : new Set(availableKeys || []);
  if (keys.has(lineKey)) return true;

  for (const avail of keys) {
    if (!avail) continue;
    if (hasWordBoundaryPhrase(lineKey, avail) || hasWordBoundaryPhrase(avail, lineKey)) {
      return true;
    }
  }
  return false;
}

/**
 * Matches active recipes against selected ingredients + optional "Always Stocked" pantry staples.
 */
export function matchRecipesByIngredients(
  recipes,
  selectedNames,
  { includeAlwaysStocked = true, pantryItems = [], mode = 'all' } = {}
) {
  const availableKeys = new Set();

  for (const name of selectedNames || []) {
    const k = normalizeIngredientKey(name);
    if (k) availableKeys.add(k);
  }

  if (includeAlwaysStocked) {
    for (const item of pantryItems || []) {
      if (!item || item.deleted) continue;
      if (item.alwaysStocked && item.status !== 'out') {
        const k = normalizeIngredientKey(item.name);
        if (k) availableKeys.add(k);
      }
    }
  }

  if (availableKeys.size === 0) {
    return [];
  }

  const results = [];
  for (const recipe of recipes || []) {
    if (!recipe || recipe.deleted) continue;
    const ingredients = Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((l) => String(l || '').trim()).filter(Boolean)
      : [];
    if (ingredients.length === 0) continue;

    const matchedIngredients = [];
    const missingIngredients = [];
    for (const line of ingredients) {
      if (ingredientLineMatches(line, availableKeys)) {
        matchedIngredients.push(line);
      } else {
        missingIngredients.push(line);
      }
    }

    const totalIngredients = ingredients.length;
    const matchedCount = matchedIngredients.length;
    const missingCount = missingIngredients.length;
    const matchPercent = Math.round((matchedCount / totalIngredients) * 100);
    const canMakeNow = missingCount === 0 && totalIngredients > 0;

    if (mode === 'ready' && !canMakeNow) continue;
    if (mode === 'almost' && !(missingCount <= 2 && matchedCount > 0)) continue;
    if (mode === 'all' && matchedCount === 0) continue;

    results.push({
      recipe,
      totalIngredients,
      matchedIngredients,
      missingIngredients,
      matchedCount,
      missingCount,
      matchPercent,
      canMakeNow,
    });
  }

  return results.sort((a, b) => {
    if (a.canMakeNow !== b.canMakeNow) return a.canMakeNow ? -1 : 1;
    if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
    if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount;
    if (b.matchedCount !== a.matchedCount) return b.matchedCount - a.matchedCount;
    return String(a.recipe.title || '').localeCompare(String(b.recipe.title || ''));
  });
}
