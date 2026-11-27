import { mergeReferenceData } from './reference.js';
import { mergeMealPrepData } from './mealPrep.js';
import { mergePantryData } from './pantry.js';
import { mergeNotesData } from './notes.js';

/**
 * Normalizes a single tag into lowercase kebab-case without leading hashes.
 */
export function normalizeTag(raw) {
  return String(raw || '')
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Splits a comma-separated tag input into unique normalized tags.
 */
export function parseTagsInput(rawInput) {
  const parts = Array.isArray(rawInput) ? rawInput : String(rawInput || '').split(',');
  const seen = new Set();
  const result = [];
  for (const part of parts) {
    const clean = normalizeTag(part);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  return result;
}

/**
 * Normalizes a binder divider entry.
 */
export function normalizeDivider(input, index = 0) {
  const name = String(input?.name || '').trim() || `Section ${index + 1}`;
  const rawId = String(input?.id || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
  const id = rawId || `divider-${index + 1}`;
  const order = Number.isFinite(Number(input?.order)) ? Number(input.order) : index;
  return { id, name, order };
}

function normalizeStringList(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  return items.map((line) => String(line || '').trim()).filter(Boolean);
}

/**
 * Normalizes a single cooking method entry (`{ id, name, cookMinutes, note, steps }`).
 */
export function normalizeMethod(input, index = 0, fallbackCookMinutes = 0) {
  const name = String(input?.name || '').trim();
  const rawId = String(input?.id || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
  const id = rawId || `method-${index + 1}`;
  const cookRaw = input?.cookMinutes;
  const cookNum =
    cookRaw === undefined || cookRaw === null || cookRaw === ''
      ? Number(fallbackCookMinutes)
      : Number(cookRaw);
  const cookMinutes = Number.isFinite(cookNum) && cookNum >= 0 ? Math.round(cookNum) : 0;

  return {
    id,
    name,
    cookMinutes,
    note: String(input?.note || '').trim(),
    steps: normalizeStringList(input?.steps),
  };
}

/**
 * Resolves the normalized array of cooking methods for a recipe, falling back to single-method fields.
 */
export function getRecipeMethods(recipe) {
  const fallbackCookRaw = Number(recipe?.cookMinutes);
  const fallbackCook =
    Number.isFinite(fallbackCookRaw) && fallbackCookRaw >= 0 ? Math.round(fallbackCookRaw) : 0;

  if (Array.isArray(recipe?.methods) && recipe.methods.length > 0) {
    return recipe.methods.map((m, idx) => normalizeMethod(m, idx, idx === 0 ? fallbackCook : 0));
  }

  return [
    normalizeMethod(
      {
        id: 'method-1',
        name: recipe?.methodName || '',
        cookMinutes: fallbackCook,
        note: recipe?.methodNote || '',
        steps: recipe?.steps || [],
      },
      0,
      fallbackCook
    ),
  ];
}

function getMinCookMinutes(recipe) {
  const methods = getRecipeMethods(recipe);
  return Math.min(...methods.map((m) => m.cookMinutes || 0));
}

/**
 * Validates and normalizes a recipe image URL (`http:`, `https:`, or compressed `data:image/` URL).
 */
export function normalizeSafeImageUrl(rawUrl) {
  const candidate = String(rawUrl || '').trim();
  if (!candidate) return '';
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(candidate)) {
    return candidate;
  }
  const withScheme =
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate) && /^[^\s]+\.[^\s]+/.test(candidate)
      ? `https://${candidate}`
      : candidate;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Normalizes optional home canning & preserving specifications on a recipe card.
 */
export function normalizeCanningSpecs(raw) {
  return {
    method: String(raw?.method || '').trim(),
    jarSize: String(raw?.jarSize || '').trim(),
    headspace: String(raw?.headspace || '').trim(),
    processingTime: String(raw?.processingTime || '').trim(),
    pressure: String(raw?.pressure || '').trim(),
    altitudeNote: String(raw?.altitudeNote || '').trim(),
    testedSource: String(raw?.testedSource || '').trim(),
  };
}

/**
 * Returns true if any canning specification field is populated.
 */
export function hasCanningSpecs(canning) {
  if (!canning || typeof canning !== 'object') return false;
  return Boolean(
    String(canning.method || '').trim() ||
      String(canning.jarSize || '').trim() ||
      String(canning.headspace || '').trim() ||
      String(canning.processingTime || '').trim() ||
      String(canning.pressure || '').trim() ||
      String(canning.altitudeNote || '').trim() ||
      String(canning.testedSource || '').trim()
  );
}

/**
 * Normalizes a recipe record into a consistent structure safe for storage and sync.
 */
export function normalizeRecipe(input, fallbackDividerId = 'weeknight') {
  const nowIso = new Date().toISOString();
  const prepNum = Number(input?.prepMinutes);
  const servingsNum = Number(input?.servings);
  const updatedMsNum = Number(input?.updatedMs);
  const methods = getRecipeMethods(input);
  const primaryMethod = methods[0];

  return {
    id: String(input?.id || '').trim() || `rec-${Date.now()}`,
    title: String(input?.title || '').trim() || 'Untitled Recipe',
    dividerId: String(input?.dividerId || '').trim() || fallbackDividerId,
    summary: String(input?.summary || '').trim(),
    source: String(input?.source || '').trim(),
    imageUrl: normalizeSafeImageUrl(input?.imageUrl || ''),
    prepMinutes: Number.isFinite(prepNum) && prepNum >= 0 ? Math.round(prepNum) : 0,
    cookMinutes: primaryMethod.cookMinutes,
    servings: Number.isFinite(servingsNum) && servingsNum > 0 ? Number(servingsNum) : 4,
    servingSize: String(input?.servingSize || '').trim(),
    tags: parseTagsInput(input?.tags || []),
    ingredients: normalizeStringList(input?.ingredients),
    steps: primaryMethod.steps,
    methods,
    notes: String(input?.notes || '').trim(),
    storageNotes: String(input?.storageNotes || '').trim(),
    reheatNotes: String(input?.reheatNotes || '').trim(),
    sourceTranscript: String(input?.sourceTranscript || '').trim(),
    canning: normalizeCanningSpecs(input?.canning),
    favorite: Boolean(input?.favorite),
    createdAt: String(input?.createdAt || nowIso),
    updatedMs: Number.isFinite(updatedMsNum) && updatedMsNum > 0 ? updatedMsNum : Date.now(),
    deleted: Boolean(input?.deleted),
  };
}

/**
 * Filters active (non-deleted) recipes by divider, favorites, pinnedOnly, tag, and query,
 * keeping pinned items first in pinned order and sorting remaining items by `sortBy`.
 */
export function filterAndSortRecipes(
  recipes,
  {
    dividerId = 'all',
    favoritesOnly = false,
    method = '',
    tag = '',
    query = '',
    sortBy = 'updated',
    pinnedSet = null,
    pinnedOnly = false,
  } = {}
) {
  const cleanQuery = String(query || '').trim().toLowerCase();
  const cleanMethod = String(method || '').trim().toLowerCase();
  const cleanTag = normalizeTag(tag);
  const pinSet =
    pinnedSet instanceof Set
      ? pinnedSet
      : Array.isArray(pinnedSet)
      ? new Set(pinnedSet)
      : new Set();

  const pinOrder = new Map();
  let pinIdx = 0;
  for (const id of pinSet) {
    pinOrder.set(id, pinIdx++);
  }

  const filtered = (recipes || []).filter((recipe) => {
    if (!recipe || recipe.deleted) return false;
    if (pinnedOnly && !pinSet.has(recipe.id)) return false;
    if (favoritesOnly && !recipe.favorite) return false;
    if (dividerId && dividerId !== 'all' && recipe.dividerId !== dividerId) return false;
    if (cleanTag && !(recipe.tags || []).includes(cleanTag)) return false;

    const methods = getRecipeMethods(recipe);
    if (
      cleanMethod &&
      !methods.some((m) => String(m.name || '').trim().toLowerCase() === cleanMethod)
    ) {
      return false;
    }

    if (cleanQuery) {
      const haystack = [
        recipe.title,
        recipe.summary,
        recipe.source,
        recipe.servingSize,
        recipe.notes,
        recipe.storageNotes,
        recipe.reheatNotes,
        recipe.canning?.method,
        recipe.canning?.jarSize,
        recipe.canning?.testedSource,
        recipe.canning?.altitudeNote,
        ...(recipe.tags || []),
        ...(recipe.ingredients || []),
        ...(recipe.steps || []),
        ...methods.flatMap((m) => [m.name, m.note, ...(m.steps || [])]),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(cleanQuery)) return false;
    }

    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (pinSet.size > 0) {
      const aPinned = pinSet.has(a.id);
      const bPinned = pinSet.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (aPinned && bPinned) {
        return (pinOrder.get(a.id) ?? 0) - (pinOrder.get(b.id) ?? 0);
      }
    }

    if (sortBy === 'title') {
      return String(a.title || '')
        .trim()
        .localeCompare(String(b.title || '').trim(), undefined, { sensitivity: 'base' });
    }
    if (sortBy === 'time') {
      const totalA = (a.prepMinutes || 0) + getMinCookMinutes(a);
      const totalB = (b.prepMinutes || 0) + getMinCookMinutes(b);
      if (totalA !== totalB) return totalA - totalB;
      return String(a.title || '')
        .trim()
        .localeCompare(String(b.title || '').trim(), undefined, { sensitivity: 'base' });
    }
    if (sortBy === 'favorite') {
      if (Boolean(a.favorite) !== Boolean(b.favorite)) {
        return a.favorite ? -1 : 1;
      }
      return (b.updatedMs || 0) - (a.updatedMs || 0);
    }
    return (b.updatedMs || 0) - (a.updatedMs || 0);
  });

  return sorted;
}

/**
 * Aggregates unique cooking method names and recipe counts across active (non-deleted) recipes.
 */
export function collectMethods(recipes) {
  const counts = new Map();
  for (const recipe of recipes || []) {
    if (!recipe || recipe.deleted) continue;
    const seenForRecipe = new Set();
    for (const method of getRecipeMethods(recipe)) {
      const rawName = String(method?.name || '').trim();
      if (!rawName) continue;
      const key = rawName.toLowerCase();
      if (seenForRecipe.has(key)) continue;
      seenForRecipe.add(key);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { method: rawName, count: 1 });
      }
    }
  }
  return Array.from(counts.values()).sort((a, b) =>
    b.count !== a.count ? b.count - a.count : a.method.localeCompare(b.method)
  );
}

/**
 * Aggregates unique tags and usage counts across active (non-deleted) recipes.
 */
export function collectTags(recipes) {
  const counts = new Map();
  for (const recipe of recipes || []) {
    if (!recipe || recipe.deleted) continue;
    for (const tag of recipe.tags || []) {
      const clean = normalizeTag(tag);
      if (!clean) continue;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.tag.localeCompare(b.tag)));
}

/**
 * Merges two binder snapshots using last-write-wins per recipe (including delete tombstones)
 * and newer dividersUpdatedMs for divider tab configuration.
 */
export function mergeCollectionSnapshots(localSnapshot, remoteSnapshot) {
  const localDividers = Array.isArray(localSnapshot?.dividers) ? localSnapshot.dividers : [];
  const remoteDividers = Array.isArray(remoteSnapshot?.dividers) ? remoteSnapshot.dividers : [];
  const localDivUpdated = Number(localSnapshot?.dividersUpdatedMs || 0);
  const remoteDivUpdated = Number(remoteSnapshot?.dividersUpdatedMs || 0);

  let mergedDividers = [];
  let dividersUpdatedMs = Math.max(localDivUpdated, remoteDivUpdated);

  if (remoteDivUpdated > localDivUpdated && remoteDividers.length > 0) {
    mergedDividers = remoteDividers.map((d, idx) => normalizeDivider(d, idx));
  } else if (localDivUpdated > remoteDivUpdated && localDividers.length > 0) {
    mergedDividers = localDividers.map((d, idx) => normalizeDivider(d, idx));
  } else {
    const byId = new Map();
    [...localDividers, ...remoteDividers].forEach((d, idx) => {
      const norm = normalizeDivider(d, idx);
      if (!byId.has(norm.id)) {
        byId.set(norm.id, norm);
      }
    });
    mergedDividers = Array.from(byId.values());
  }

  mergedDividers.sort((a, b) => a.order - b.order);
  mergedDividers = mergedDividers.map((d, idx) => ({ ...d, order: idx }));

  const fallbackDividerId = mergedDividers[0]?.id || 'weeknight';
  const recipeMap = new Map();

  for (const raw of localSnapshot?.recipes || []) {
    if (!raw?.id) continue;
    const norm = normalizeRecipe(raw, fallbackDividerId);
    recipeMap.set(norm.id, norm);
  }

  for (const raw of remoteSnapshot?.recipes || []) {
    if (!raw?.id) continue;
    const norm = normalizeRecipe(raw, fallbackDividerId);
    const existing = recipeMap.get(norm.id);
    if (!existing || norm.updatedMs > existing.updatedMs) {
      recipeMap.set(norm.id, norm);
    }
  }

  const merged = {
    dividers: mergedDividers,
    dividersUpdatedMs,
    recipes: Array.from(recipeMap.values()),
  };
  if (localSnapshot?.referenceData || remoteSnapshot?.referenceData) {
    merged.referenceData = mergeReferenceData(
      localSnapshot?.referenceData,
      remoteSnapshot?.referenceData
    );
  }
  if (localSnapshot?.mealPrepData || remoteSnapshot?.mealPrepData) {
    merged.mealPrepData = mergeMealPrepData(
      localSnapshot?.mealPrepData,
      remoteSnapshot?.mealPrepData
    );
  }
  if (localSnapshot?.pantryData || remoteSnapshot?.pantryData) {
    merged.pantryData = mergePantryData(
      localSnapshot?.pantryData,
      remoteSnapshot?.pantryData
    );
  }
  if (localSnapshot?.notesData || remoteSnapshot?.notesData) {
    merged.notesData = mergeNotesData(
      localSnapshot?.notesData,
      remoteSnapshot?.notesData
    );
  }
  return merged;
}
