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
 * Normalizes a recipe record into a consistent structure safe for storage and sync.
 */
export function normalizeRecipe(input, fallbackDividerId = 'weeknight') {
  const nowIso = new Date().toISOString();
  const prepNum = Number(input?.prepMinutes);
  const cookNum = Number(input?.cookMinutes);
  const servingsNum = Number(input?.servings);
  const updatedMsNum = Number(input?.updatedMs);

  return {
    id: String(input?.id || '').trim() || `rec-${Date.now()}`,
    title: String(input?.title || '').trim() || 'Untitled Recipe',
    dividerId: String(input?.dividerId || '').trim() || fallbackDividerId,
    summary: String(input?.summary || '').trim(),
    source: String(input?.source || '').trim(),
    prepMinutes: Number.isFinite(prepNum) && prepNum >= 0 ? Math.round(prepNum) : 0,
    cookMinutes: Number.isFinite(cookNum) && cookNum >= 0 ? Math.round(cookNum) : 0,
    servings: Number.isFinite(servingsNum) && servingsNum > 0 ? Number(servingsNum) : 4,
    tags: parseTagsInput(input?.tags || []),
    ingredients: normalizeStringList(input?.ingredients),
    steps: normalizeStringList(input?.steps),
    notes: String(input?.notes || '').trim(),
    favorite: Boolean(input?.favorite),
    createdAt: String(input?.createdAt || nowIso),
    updatedMs: Number.isFinite(updatedMsNum) && updatedMsNum > 0 ? updatedMsNum : Date.now(),
    deleted: Boolean(input?.deleted),
  };
}

/**
 * Filters active (non-deleted) recipes by divider, favorites, tag, and query, then sorts them.
 */
export function filterAndSortRecipes(
  recipes,
  { dividerId = 'all', favoritesOnly = false, tag = '', query = '', sortBy = 'updated' } = {}
) {
  const cleanQuery = String(query || '').trim().toLowerCase();
  const cleanTag = normalizeTag(tag);

  const filtered = (recipes || []).filter((recipe) => {
    if (!recipe || recipe.deleted) return false;
    if (favoritesOnly && !recipe.favorite) return false;
    if (dividerId && dividerId !== 'all' && recipe.dividerId !== dividerId) return false;
    if (cleanTag && !(recipe.tags || []).includes(cleanTag)) return false;

    if (cleanQuery) {
      const haystack = [
        recipe.title,
        recipe.summary,
        recipe.source,
        recipe.notes,
        ...(recipe.tags || []),
        ...(recipe.ingredients || []),
        ...(recipe.steps || []),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(cleanQuery)) return false;
    }

    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'time') {
      const totalA = (a.prepMinutes || 0) + (a.cookMinutes || 0);
      const totalB = (b.prepMinutes || 0) + (b.cookMinutes || 0);
      if (totalA !== totalB) return totalA - totalB;
      return a.title.localeCompare(b.title);
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

  return {
    dividers: mergedDividers,
    dividersUpdatedMs,
    recipes: Array.from(recipeMap.values()),
  };
}
