import { getRecipeMethods } from './collection.js';
import { scaleIngredientLine } from './scaling.js';

const STORAGE_LOCATION_SET = new Set(['freezer', 'fridge']);

function cleanText(value, fallback = '') {
  const str = String(value ?? '').trim();
  return str || fallback;
}

function normalizeDateIso(value, fallback = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : fallback;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(isoDate, days) {
  const base = normalizeDateIso(isoDate, todayIsoDate());
  const ms = Date.parse(`${base}T00:00:00Z`);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms + days * 86400000).toISOString().slice(0, 10);
}

/**
 * Normalizes a derivative dish linked to a "Cook Once, Eat Thrice" template.
 */
export function normalizeDerivative(item) {
  const title = cleanText(item?.title, 'Derivative Meal');
  return {
    id:
      cleanText(item?.id) ||
      `deriv-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meal'}`,
    title,
    recipeId: cleanText(item?.recipeId),
    dayOffset: Number.isFinite(Number(item?.dayOffset))
      ? Math.max(0, Math.round(Number(item.dayOffset)))
      : 1,
    notes: cleanText(item?.notes),
  };
}

/**
 * Normalizes a "Cook Once, Eat Thrice" batch prep template.
 */
export function normalizeBatchTemplate(item) {
  const rawDerivatives = Array.isArray(item?.derivatives) ? item.derivatives : [];
  const derivatives = rawDerivatives.map(normalizeDerivative).filter((d) => d.title);
  const updatedNum = Number(item?.updatedMs);
  return {
    id: cleanText(item?.id) || `batch-${Date.now()}`,
    title: cleanText(item?.title, 'Batch Prep Plan'),
    baseRecipeId: cleanText(item?.baseRecipeId),
    baseLabel: cleanText(item?.baseLabel),
    batchYield: cleanText(item?.batchYield),
    prepTips: cleanText(item?.prepTips),
    derivatives,
    isCustom: Boolean(item?.isCustom),
    updatedMs: Number.isFinite(updatedNum) && updatedNum > 0 ? updatedNum : 1700000000000,
    deleted: Boolean(item?.deleted),
  };
}

/**
 * Normalizes a single Freezer or Fridge leftover inventory item.
 */
export function normalizeFreezerItem(item) {
  const storedDate = normalizeDateIso(item?.storedDate, todayIsoDate());
  const rawLocation = cleanText(item?.storageLocation, 'freezer').toLowerCase();
  const storageLocation = STORAGE_LOCATION_SET.has(rawLocation) ? rawLocation : 'freezer';
  const defaultBestBy = addDaysIso(storedDate, storageLocation === 'fridge' ? 4 : 90);
  const hasPortions =
    item?.portions !== '' && item?.portions !== null && item?.portions !== undefined;
  const rawPortions = hasPortions ? Number(item.portions) : NaN;
  const portions = Number.isFinite(rawPortions) && rawPortions >= 0 ? Number(rawPortions) : 1;
  const updatedNum = Number(item?.updatedMs);

  return {
    id: cleanText(item?.id) || `freez-${Date.now()}`,
    recipeId: cleanText(item?.recipeId),
    title: cleanText(item?.title, 'Stored Portion'),
    storageLocation,
    portions,
    servingSize: cleanText(item?.servingSize, '1 serving'),
    storedDate,
    bestByDate: normalizeDateIso(item?.bestByDate, defaultBestBy),
    reheatNotes: cleanText(item?.reheatNotes),
    isCustom: Boolean(item?.isCustom),
    updatedMs: Number.isFinite(updatedNum) && updatedNum > 0 ? updatedNum : 1700000000000,
    deleted: Boolean(item?.deleted),
  };
}

/**
 * Default seeded Meal Prep state with starter "Cook Once, Eat Thrice" template.
 */
export function getDefaultMealPrepData() {
  return {
    templates: [
      normalizeBatchTemplate({
        id: 'batch-sunday-chicken',
        title: 'Sunday Lemon Garlic Chicken Prep',
        baseRecipeId: 'seed-lemon-garlic-chicken',
        baseLabel: 'Roast a double batch of Lemon-Garlic Pan Chicken (8 thighs)',
        batchYield: '4 base servings + 4 extra thighs for Day 2 & 3',
        prepTips:
          'Save all pan drippings separately in a jar—they glaze warm rice bowls on Day 2 and brighten quick greens on Day 3.',
        derivatives: [
          {
            id: 'deriv-night-1',
            title: 'Night 1: Lemon-Garlic Chicken & Crisp Cucumber Salad',
            recipeId: 'seed-cucumber-herb-salad',
            dayOffset: 0,
            notes: 'Serve 4 thighs hot from the skillet alongside dressed cucumber-herb salad.',
          },
          {
            id: 'deriv-night-2',
            title: 'Night 2: Shredded Chicken Grain Bowls',
            recipeId: '',
            dayOffset: 2,
            notes: 'Slice cold thighs over warm farro or rice with spooned pan drippings and herbs.',
          },
          {
            id: 'deriv-night-3',
            title: 'Night 3: 10-Minute Garlic Chicken Flatbreads',
            recipeId: '',
            dayOffset: 3,
            notes: 'Broil shredded chicken on pita with feta, lemon zest, and chopped dill.',
          },
        ],
        isCustom: false,
        updatedMs: 1700000000000,
        deleted: false,
      }),
    ],
    freezerItems: [],
  };
}

function mergeItemArrays(defaults, localList, remoteList, normalizer) {
  const map = new Map();
  for (const item of defaults) {
    const norm = normalizer(item);
    map.set(norm.id, norm);
  }
  const applyList = (list) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      const norm = normalizer(raw);
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
 * Normalizes a persisted mealPrepData blob.
 */
export function normalizeMealPrepData(input) {
  const defaults = getDefaultMealPrepData();
  const hasTemplates = Array.isArray(input?.templates);
  const templates = hasTemplates
    ? mergeItemArrays(defaults.templates, input.templates, [], normalizeBatchTemplate)
    : defaults.templates;
  const freezerItems = Array.isArray(input?.freezerItems)
    ? input.freezerItems.map(normalizeFreezerItem)
    : [];

  return { templates, freezerItems };
}

/**
 * Timestamp-aware merge between local and remote mealPrepData blobs.
 */
export function mergeMealPrepData(localData, remoteData) {
  const defaults = getDefaultMealPrepData();
  return {
    templates: mergeItemArrays(
      defaults.templates,
      localData?.templates,
      remoteData?.templates,
      normalizeBatchTemplate
    ),
    freezerItems: mergeItemArrays(
      [],
      localData?.freezerItems,
      remoteData?.freezerItems,
      normalizeFreezerItem
    ),
  };
}

/**
 * Inserts or updates an item in a normalized collection array using updatedMs.
 */
export function upsertMealPrepItem(list, item, normalizer) {
  const nextItem = normalizer({
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
 * Tombstones (soft-deletes) an item so deletions propagate cleanly across sync.
 */
export function deleteMealPrepItem(list, id) {
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
 * Adjusts remaining portions on a freezer/fridge inventory item safely at >= 0.
 */
export function adjustFreezerPortions(item, delta) {
  const normalized = normalizeFreezerItem(item);
  const change = Number(delta);
  const nextPortions = Number.isFinite(change)
    ? Math.max(0, Math.round((normalized.portions + change) * 100) / 100)
    : normalized.portions;

  return {
    ...normalized,
    portions: nextPortions,
    updatedMs: Date.now(),
  };
}

/**
 * Computes storage freshness status for a freezer or fridge entry.
 * Returns: 'empty' | 'expired' | 'use-soon' | 'fresh'
 */
export function getFreezerItemStatus(item, referenceDate = todayIsoDate()) {
  const norm = normalizeFreezerItem(item);
  if (norm.portions <= 0) {
    return { status: 'empty', label: 'Empty', daysRemaining: 0 };
  }
  const refIso = normalizeDateIso(referenceDate, todayIsoDate());
  const bestIso = normalizeDateIso(norm.bestByDate);
  if (!bestIso) {
    return { status: 'fresh', label: 'Fresh', daysRemaining: null };
  }
  const refMs = Date.parse(`${refIso}T00:00:00Z`);
  const bestMs = Date.parse(`${bestIso}T00:00:00Z`);
  const daysRemaining = Math.round((bestMs - refMs) / 86400000);

  if (daysRemaining < 0) {
    return {
      status: 'expired',
      label: `Past Best-By (${Math.abs(daysRemaining)}d)`,
      daysRemaining,
    };
  }
  const threshold = norm.storageLocation === 'fridge' ? 1 : 14;
  if (daysRemaining <= threshold) {
    return {
      status: 'use-soon',
      label: daysRemaining === 0 ? 'Use Today' : `Use Soon (${daysRemaining}d)`,
      daysRemaining,
    };
  }
  return {
    status: 'fresh',
    label: `Fresh (${daysRemaining}d left)`,
    daysRemaining,
  };
}

const PREHEAT_RE = /\b(preheat|heat oven|heat the oven|set oven|broiler)\b/i;
const PREP_RE = /\b(chop|dice|mince|slice|whisk|mix|toss|marinate|peel|grate|zest|pat dry|season|measure|combine|stir)\b/i;
const FINISH_RE = /\b(garnish|serve|before serving|for serving|cool|rest|transfer to plates|plate up)\b/i;
const TEMP_RE = /\b(\d{3}\s*°\s*[FC]?|\d{3}\s*(?:degrees?\s*[FC]?|°F|°C|F|C))\b/gi;

function extractTemperatures(text) {
  const matches = String(text || '').match(TEMP_RE) || [];
  return matches.map((m) => m.replace(/\s+/g, '').toUpperCase());
}

/**
 * Merges multiple recipes into one chronological batch prep timeline.
 * @param {Array<{ recipe: Object, scale?: number, methodId?: string }>} entries
 */
export function buildMergedPrepTimeline(entries) {
  const normalizedEntries = (Array.isArray(entries) ? entries : [])
    .filter((e) => e?.recipe)
    .map((entry) => {
      const recipe = entry.recipe;
      const methods = getRecipeMethods(recipe);
      const method =
        methods.find((m) => m.id === entry.methodId) || methods[0];
      const rawScale = Number(entry.scale);
      const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
      const baseServings = Number(recipe.servings) > 0 ? Number(recipe.servings) : 4;
      const scaledServings = Math.round(baseServings * scale * 100) / 100;

      return {
        recipe,
        method,
        scale,
        scaledServings,
        servingSize: cleanText(recipe.servingSize),
        prepMinutes: Number(recipe.prepMinutes) || 0,
        cookMinutes: Number(method?.cookMinutes ?? recipe.cookMinutes) || 0,
      };
    });

  if (normalizedEntries.length === 0) {
    return {
      recipes: [],
      ovenTemps: [],
      ingredientsByRecipe: [],
      phases: [
        { id: 'preheat', title: '1. Preheat & Setup', steps: [] },
        { id: 'prep', title: '2. Chop & Mise en Place', steps: [] },
        { id: 'cook', title: '3. Active Cooking (Longest First)', steps: [] },
        { id: 'finish', title: '4. Rest, Finish & Pack', steps: [] },
      ],
    };
  }

  const ovenTempSet = new Set();
  const ingredientsByRecipe = normalizedEntries.map((entry) => ({
    recipeId: entry.recipe.id,
    title: entry.recipe.title,
    methodName: entry.method?.name || 'Standard',
    scale: entry.scale,
    scaledServings: entry.scaledServings,
    servingSize: entry.servingSize,
    ingredients: (entry.recipe.ingredients || []).map((line) =>
      scaleIngredientLine(line, entry.scale)
    ),
  }));

  const preheatSteps = [];
  const prepSteps = [];
  const cookSteps = [];
  const finishSteps = [];

  // Sort longest cook duration first so oven/stovetop bottlenecks start early
  const cookOrdered = [...normalizedEntries].sort(
    (a, b) => b.cookMinutes - a.cookMinutes || a.recipe.title.localeCompare(b.recipe.title)
  );

  for (const entry of cookOrdered) {
    const steps = Array.isArray(entry.method?.steps) ? entry.method.steps : [];
    const totalSteps = steps.length;
    steps.forEach((rawText, idx) => {
      const text = cleanText(rawText);
      if (!text) return;
      for (const temp of extractTemperatures(text)) {
        ovenTempSet.add(temp);
      }
      const stepObj = {
        id: `${entry.recipe.id}-${entry.method?.id || 'm'}-${idx + 1}`,
        recipeId: entry.recipe.id,
        recipeTitle: entry.recipe.title,
        methodName: entry.method?.name || 'Standard',
        cookMinutes: entry.cookMinutes,
        text,
      };
      if (PREHEAT_RE.test(text)) {
        preheatSteps.push(stepObj);
      } else if (idx === totalSteps - 1 && FINISH_RE.test(text)) {
        finishSteps.push(stepObj);
      } else if (idx === 0 && PREP_RE.test(text) && !/\b(bake|roast|simmer|boil|sear|broil|fry)\b/i.test(text)) {
        prepSteps.push(stepObj);
      } else if (idx < totalSteps - 1 && FINISH_RE.test(text) && /\b(cool|rest)\b/i.test(text) && idx >= totalSteps - 2) {
        finishSteps.push(stepObj);
      } else {
        cookSteps.push(stepObj);
      }
    });
  }

  return {
    recipes: normalizedEntries.map((e) => ({
      id: e.recipe.id,
      title: e.recipe.title,
      methodId: e.method?.id || '',
      methodName: e.method?.name || 'Standard',
      scale: e.scale,
      scaledServings: e.scaledServings,
      servingSize: e.servingSize,
      prepMinutes: e.prepMinutes,
      cookMinutes: e.cookMinutes,
    })),
    ovenTemps: Array.from(ovenTempSet),
    ingredientsByRecipe,
    phases: [
      { id: 'preheat', title: '1. Preheat & Setup', steps: preheatSteps },
      { id: 'prep', title: '2. Chop & Mise en Place', steps: prepSteps },
      { id: 'cook', title: '3. Active Cooking (Longest First)', steps: cookSteps },
      { id: 'finish', title: '4. Rest, Finish & Pack', steps: finishSteps },
    ],
  };
}
