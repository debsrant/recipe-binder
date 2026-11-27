import {
  FLAVOR_FAMILIES,
  FLAVOR_PAIRINGS,
  FOOD_STORAGE_CATEGORIES,
  FOOD_STORAGE_TIMES,
  SUBSTITUTIONS,
  TECHNIQUE_CARDS,
} from '../data/referenceGuide.js';

function slugId(raw, fallback) {
  const clean = String(raw || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return clean || fallback;
}

function normalizeStringArray(value, splitPattern = /\r?\n/) {
  const items = Array.isArray(value) ? value : String(value || '').split(splitPattern);
  return items.map((s) => String(s || '').trim()).filter(Boolean);
}

/**
 * Normalizes a substitution entry (`{ id, missing, category, amount, substitute, notes }`).
 */
export function normalizeSubstitution(input, index = 0) {
  const missing = String(input?.missing || '').trim() || `Ingredient ${index + 1}`;
  const id = String(input?.id || '').trim() || `sub-${slugId(missing, `item-${index + 1}`)}`;
  return {
    id,
    missing,
    category: String(input?.category || '').trim() || 'Other',
    amount: String(input?.amount || '').trim() || '1 unit',
    substitute: String(input?.substitute || '').trim(),
    notes: String(input?.notes || '').trim(),
  };
}

/**
 * Normalizes a culinary technique card entry.
 */
export function normalizeTechnique(input, index = 0) {
  const title = String(input?.title || '').trim() || `Technique ${index + 1}`;
  const id = String(input?.id || '').trim() || `tech-${slugId(title, `item-${index + 1}`)}`;
  return {
    id,
    title,
    category: String(input?.category || '').trim() || 'Heat & Sauces',
    time: String(input?.time || '').trim() || '5 min',
    summary: String(input?.summary || '').trim(),
    keywords: normalizeStringArray(input?.keywords, /[,;\r\n]/),
    steps: normalizeStringArray(input?.steps, /\r?\n/),
    visualCue: String(input?.visualCue || '').trim(),
    commonMistake: String(input?.commonMistake || '').trim(),
  };
}

const VALID_FAMILY_IDS = new Set(FLAVOR_FAMILIES.map((f) => f.id));

/**
 * Normalizes a flavor wheel herb/spice pairing entry.
 */
export function normalizeFlavor(input, index = 0) {
  const name = String(input?.name || '').trim() || `Spice ${index + 1}`;
  const id = String(input?.id || '').trim() || slugId(name, `flavor-${index + 1}`);
  const rawFamily = String(input?.familyId || '').trim();
  const familyId = VALID_FAMILY_IDS.has(rawFamily) ? rawFamily : FLAVOR_FAMILIES[0].id;
  const rawFp = input?.foodPairings && typeof input.foodPairings === 'object' ? input.foodPairings : {};
  return {
    id,
    name,
    familyId,
    profile: String(input?.profile || '').trim(),
    cuisineVibe: String(input?.cuisineVibe || '').trim(),
    foodPairings: {
      meats: String(rawFp.meats || '').trim(),
      vegetables: String(rawFp.vegetables || '').trim(),
      soupsSalads: String(rawFp.soupsSalads || '').trim(),
      appetizersBaking: String(rawFp.appetizersBaking || '').trim(),
    },
    bestWith: normalizeStringArray(input?.bestWith, /[,;\r\n]/),
    pairsWellWith: normalizeStringArray(input?.pairsWellWith, /[,;\r\n]/),
    substitutes: String(input?.substitutes || '').trim(),
  };
}

const VALID_STORAGE_CAT_IDS = new Set(FOOD_STORAGE_CATEGORIES.map((c) => c.id));

/**
 * Normalizes a food storage duration row (`{ id, categoryId, food, fridge, freezer, pantry, notes }`).
 */
export function normalizeStorageTime(input, index = 0) {
  const food = String(input?.food || '').trim() || `Food Item ${index + 1}`;
  const id = String(input?.id || '').trim() || `st-${slugId(food, `item-${index + 1}`)}`;
  const rawCat = String(input?.categoryId || '').trim();
  const categoryId = VALID_STORAGE_CAT_IDS.has(rawCat)
    ? rawCat
    : FOOD_STORAGE_CATEGORIES[FOOD_STORAGE_CATEGORIES.length - 1].id;
  return {
    id,
    categoryId,
    food,
    fridge: String(input?.fridge || '').trim() || '—',
    freezer: String(input?.freezer || '').trim() || '—',
    pantry: String(input?.pantry || '').trim() || '—',
    notes: String(input?.notes || '').trim(),
  };
}

/**
 * Returns a fresh clone of the default Front Pocket reference data.
 */
export function getDefaultReferenceData() {
  return {
    substitutions: SUBSTITUTIONS.map((s, idx) => normalizeSubstitution(s, idx)),
    techniques: TECHNIQUE_CARDS.map((t, idx) => normalizeTechnique(t, idx)),
    flavors: FLAVOR_PAIRINGS.map((f, idx) => normalizeFlavor(f, idx)),
    storageTimes: FOOD_STORAGE_TIMES.map((st, idx) => normalizeStorageTime(st, idx)),
    updatedMs: 0,
  };
}

/**
 * Normalizes a full referenceData bundle, defaulting missing collections without discarding intentional empty lists.
 */
export function normalizeReferenceData(input) {
  const defaults = getDefaultReferenceData();
  const substitutions = Array.isArray(input?.substitutions)
    ? input.substitutions.map((s, idx) => normalizeSubstitution(s, idx))
    : defaults.substitutions;
  const techniques = Array.isArray(input?.techniques)
    ? input.techniques.map((t, idx) => normalizeTechnique(t, idx))
    : defaults.techniques;
  const flavors = Array.isArray(input?.flavors)
    ? input.flavors.map((f, idx) => normalizeFlavor(f, idx))
    : defaults.flavors;
  const storageTimes = Array.isArray(input?.storageTimes)
    ? input.storageTimes.map((st, idx) => normalizeStorageTime(st, idx))
    : defaults.storageTimes;
  const updatedMsNum = Number(input?.updatedMs || 0);

  return {
    substitutions,
    techniques,
    flavors,
    storageTimes,
    updatedMs: Number.isFinite(updatedMsNum) && updatedMsNum >= 0 ? updatedMsNum : 0,
  };
}

/**
 * Merges two referenceData bundles using last-write-wins by updatedMs.
 */
export function mergeReferenceData(localRef, remoteRef) {
  const hasLocal = Boolean(localRef);
  const hasRemote = Boolean(remoteRef);
  if (!hasLocal && !hasRemote) return getDefaultReferenceData();
  if (!hasRemote) return normalizeReferenceData(localRef);
  if (!hasLocal) return normalizeReferenceData(remoteRef);

  const localNorm = normalizeReferenceData(localRef);
  const remoteNorm = normalizeReferenceData(remoteRef);
  return remoteNorm.updatedMs > localNorm.updatedMs ? remoteNorm : localNorm;
}

/**
 * Inserts or updates an item by ID inside a reference list without mutating the input array.
 */
export function upsertReferenceItem(list, item) {
  const arr = Array.isArray(list) ? [...list] : [];
  const idx = arr.findIndex((entry) => entry?.id === item?.id);
  if (idx >= 0) {
    arr[idx] = item;
  } else {
    arr.push(item);
  }
  return arr;
}

/**
 * Deletes an item by ID from a reference list without mutating the input array.
 */
export function deleteReferenceItem(list, id) {
  return (Array.isArray(list) ? list : []).filter((entry) => entry?.id !== id);
}

/**
 * Deletes a flavor entry and prunes dangling references from other flavors' `pairsWellWith`.
 */
export function deleteFlavorItem(flavors, id) {
  return deleteReferenceItem(flavors, id).map((entry) => ({
    ...entry,
    pairsWellWith: (entry.pairsWellWith || []).filter((pairId) => pairId !== id),
  }));
}
