import Dexie from 'dexie';
import { DB_NAME, IS_TEST_STAGE } from '../config.js';
import { DEFAULT_DIVIDERS, SEED_RECIPES } from '../data/seedRecipes.js';
import { normalizeDivider, normalizeRecipe } from '../lib/collection.js';
import { getDefaultReferenceData, normalizeReferenceData } from '../lib/reference.js';
import { getDefaultMealPrepData, normalizeMealPrepData } from '../lib/mealPrep.js';
import { getDefaultPantryData, normalizePantryData } from '../lib/pantry.js';
import { getDefaultNotesData, normalizeNotesData } from '../lib/notes.js';

export const db = new Dexie(DB_NAME);

db.version(1).stores({
  recipes: 'id, dividerId, updatedMs, favorite',
  dividers: 'id, order',
  meta: 'key',
});

/**
 * Ensures Dexie is open and seeds starter binder dividers & recipes once on first launch.
 */
export async function initDatabase() {
  await db.open();
  const seededMeta = await db.meta.get('seeded');
  if (!seededMeta) {
    const dividerCount = await db.dividers.count();
    const recipeCount = await db.recipes.count();
    await db.transaction('rw', db.dividers, db.recipes, db.meta, async () => {
      if (dividerCount === 0) {
        await db.dividers.bulkPut(DEFAULT_DIVIDERS.map((d, idx) => normalizeDivider(d, idx)));
      }
      if (recipeCount === 0) {
        await db.recipes.bulkPut(SEED_RECIPES.map((r) => normalizeRecipe(r, 'weeknight')));
      }
      await db.meta.put({ key: 'seeded', value: true, updatedMs: Date.now() });
      await db.meta.put({ key: 'dividersUpdatedMs', value: 1764000000000 });
    });
  }
  return getSnapshot();
}

/**
 * Reads the full local snapshot (recipes including tombstones, ordered dividers, referenceData, mealPrepData, pantryData, notesData, and timestamp).
 */
export async function getSnapshot() {
  const [recipes, dividers, divMeta, refMeta, mealPrepMeta, pantryMeta, notesMeta] =
    await Promise.all([
      db.recipes.toArray(),
      db.dividers.orderBy('order').toArray(),
      db.meta.get('dividersUpdatedMs'),
      db.meta.get('referenceData'),
      db.meta.get('mealPrepData'),
      db.meta.get('pantryData'),
      db.meta.get('notesData'),
    ]);
  return {
    recipes,
    dividers: dividers.length > 0 ? dividers : DEFAULT_DIVIDERS,
    dividersUpdatedMs: Number(divMeta?.value || 0),
    referenceData: refMeta?.value ? normalizeReferenceData(refMeta.value) : getDefaultReferenceData(),
    mealPrepData: mealPrepMeta?.value
      ? normalizeMealPrepData(mealPrepMeta.value)
      : getDefaultMealPrepData(),
    pantryData: pantryMeta?.value
      ? normalizePantryData(pantryMeta.value)
      : getDefaultPantryData(),
    notesData: notesMeta?.value
      ? normalizeNotesData(notesMeta.value)
      : getDefaultNotesData(),
  };
}

/**
 * Inserts or updates a recipe record with a fresh updatedMs timestamp.
 */
export async function saveRecipe(recipeInput) {
  const dividers = await db.dividers.orderBy('order').toArray();
  const fallbackId = dividers[0]?.id || 'weeknight';
  const normalized = normalizeRecipe(
    {
      ...recipeInput,
      updatedMs: Date.now(),
      deleted: false,
    },
    fallbackId
  );
  await db.recipes.put(normalized);
  return normalized;
}

/**
 * Marks a recipe as soft-deleted so deletions propagate across synced devices.
 */
export async function softDeleteRecipe(id) {
  const existing = await db.recipes.get(id);
  if (!existing) return null;
  const tombstoned = {
    ...existing,
    deleted: true,
    updatedMs: Date.now(),
  };
  await db.recipes.put(tombstoned);
  return tombstoned;
}

/**
 * Clones an existing recipe into a new editable copy.
 */
export async function duplicateRecipe(id, newId) {
  const existing = await db.recipes.get(id);
  if (!existing || existing.deleted) return null;
  const now = Date.now();
  const copy = {
    ...existing,
    id: newId,
    title: `${existing.title} (Copy)`,
    favorite: false,
    createdAt: new Date().toISOString(),
    updatedMs: now,
    deleted: false,
  };
  await db.recipes.put(copy);
  return copy;
}

/**
 * Toggles the favorite flag on a recipe and bumps its sync timestamp.
 */
export async function toggleFavorite(id) {
  const existing = await db.recipes.get(id);
  if (!existing || existing.deleted) return null;
  const updated = {
    ...existing,
    favorite: !existing.favorite,
    updatedMs: Date.now(),
  };
  await db.recipes.put(updated);
  return updated;
}

/**
 * Replaces divider tabs and bumps dividersUpdatedMs.
 */
export async function saveDividers(dividersInput) {
  const clean = (dividersInput || []).map((d, idx) => ({
    ...normalizeDivider(d, idx),
    order: idx,
  }));
  const updatedMs = Date.now();
  await db.transaction('rw', db.dividers, db.meta, async () => {
    await db.dividers.clear();
    if (clean.length > 0) {
      await db.dividers.bulkPut(clean);
    }
    await db.meta.put({ key: 'dividersUpdatedMs', value: updatedMs });
  });
  return { dividers: clean, dividersUpdatedMs: updatedMs };
}

/**
 * Saves updated reference data (substitutions, technique cards, flavor wheel) with a fresh timestamp.
 */
export async function saveReferenceData(referenceInput) {
  const normalized = normalizeReferenceData({
    ...referenceInput,
    updatedMs: Date.now(),
  });
  await db.meta.put({ key: 'referenceData', value: normalized });
  return normalized;
}

/**
 * Saves updated meal prep data (Cook Once Eat Thrice templates & freezer/leftover inventory).
 */
export async function saveMealPrepData(mealPrepInput) {
  const normalized = normalizeMealPrepData(mealPrepInput);
  await db.meta.put({ key: 'mealPrepData', value: normalized });
  return normalized;
}

/**
 * Saves updated virtual pantry inventory data.
 */
export async function savePantryData(pantryInput) {
  const normalized = normalizePantryData(pantryInput);
  await db.meta.put({ key: 'pantryData', value: normalized });
  return normalized;
}

/**
 * Saves updated kitchen notes, links, videos & Drive folder data.
 */
export async function saveNotesData(notesInput) {
  const normalized = normalizeNotesData({
    ...notesInput,
    updatedMs: Date.now(),
  });
  await db.meta.put({ key: 'notesData', value: normalized });
  return normalized;
}

/**
 * Applies a merged snapshot (from cloud sync or merge import) into IndexedDB.
 */
export async function applyMergedSnapshot(snapshot) {
  const dividers = (snapshot?.dividers || []).map((d, idx) => ({
    ...normalizeDivider(d, idx),
    order: idx,
  }));
  const fallbackId = dividers[0]?.id || 'weeknight';
  const recipes = (snapshot?.recipes || []).map((r) => normalizeRecipe(r, fallbackId));
  const dividersUpdatedMs = Number(snapshot?.dividersUpdatedMs || Date.now());
  const hasRef = Boolean(snapshot?.referenceData);
  const hasMealPrep = Boolean(snapshot?.mealPrepData);
  const hasPantry = Boolean(snapshot?.pantryData);
  const hasNotes = Boolean(snapshot?.notesData);

  await db.transaction('rw', db.dividers, db.recipes, db.meta, async () => {
    if (dividers.length > 0) {
      await db.dividers.clear();
      await db.dividers.bulkPut(dividers);
    }
    if (recipes.length > 0) {
      await db.recipes.bulkPut(recipes);
    }
    if (hasRef) {
      await db.meta.put({
        key: 'referenceData',
        value: normalizeReferenceData(snapshot.referenceData),
      });
    }
    if (hasMealPrep) {
      await db.meta.put({
        key: 'mealPrepData',
        value: normalizeMealPrepData(snapshot.mealPrepData),
      });
    }
    if (hasPantry) {
      await db.meta.put({
        key: 'pantryData',
        value: normalizePantryData(snapshot.pantryData),
      });
    }
    if (hasNotes) {
      await db.meta.put({
        key: 'notesData',
        value: normalizeNotesData(snapshot.notesData),
      });
    }
    await db.meta.put({ key: 'dividersUpdatedMs', value: dividersUpdatedMs });
    await db.meta.put({ key: 'seeded', value: true, updatedMs: Date.now() });
  });

  return getSnapshot();
}

/**
 * Replaces the entire local binder with an imported backup snapshot.
 */
export async function replaceAllData(snapshot) {
  const rawDividers = Array.isArray(snapshot?.dividers) && snapshot.dividers.length > 0
    ? snapshot.dividers
    : DEFAULT_DIVIDERS;
  const dividers = rawDividers.map((d, idx) => ({
    ...normalizeDivider(d, idx),
    order: idx,
  }));
  const fallbackId = dividers[0]?.id || 'weeknight';
  const recipes = (snapshot?.recipes || []).map((r) => normalizeRecipe(r, fallbackId));
  const dividersUpdatedMs = Number(snapshot?.dividersUpdatedMs || Date.now());
  const hasRef = Boolean(snapshot?.referenceData);
  const hasMealPrep = Boolean(snapshot?.mealPrepData);
  const hasPantry = Boolean(snapshot?.pantryData);
  const hasNotes = Boolean(snapshot?.notesData);

  await db.transaction('rw', db.dividers, db.recipes, db.meta, async () => {
    await db.dividers.clear();
    await db.recipes.clear();
    await db.dividers.bulkPut(dividers);
    if (recipes.length > 0) {
      await db.recipes.bulkPut(recipes);
    }
    if (hasRef) {
      await db.meta.put({
        key: 'referenceData',
        value: normalizeReferenceData(snapshot.referenceData),
      });
    }
    if (hasMealPrep) {
      await db.meta.put({
        key: 'mealPrepData',
        value: normalizeMealPrepData(snapshot.mealPrepData),
      });
    }
    if (hasPantry) {
      await db.meta.put({
        key: 'pantryData',
        value: normalizePantryData(snapshot.pantryData),
      });
    }
    if (hasNotes) {
      await db.meta.put({
        key: 'notesData',
        value: normalizeNotesData(snapshot.notesData),
      });
    }
    await db.meta.put({ key: 'dividersUpdatedMs', value: dividersUpdatedMs });
    await db.meta.put({ key: 'seeded', value: true, updatedMs: Date.now() });
  });

  return getSnapshot();
}

/**
 * TEST-stage only: restores default starter dividers and sample recipes.
 */
export async function resetToSeedData() {
  if (!IS_TEST_STAGE) {
    throw new Error('resetToSeedData is blocked in LIVE stage.');
  }
  return replaceAllData({
    dividers: DEFAULT_DIVIDERS,
    dividersUpdatedMs: Date.now(),
    recipes: SEED_RECIPES.map((r) => ({ ...r, updatedMs: Date.now() })),
    referenceData: getDefaultReferenceData(),
    mealPrepData: getDefaultMealPrepData(),
    pantryData: getDefaultPantryData(),
    notesData: getDefaultNotesData(),
  });
}

/**
 * TEST-stage only: clears all recipes while keeping the default dividers intact.
 */
export async function clearAllTestData() {
  if (!IS_TEST_STAGE) {
    throw new Error('clearAllTestData is blocked in LIVE stage.');
  }
  return replaceAllData({
    dividers: DEFAULT_DIVIDERS,
    dividersUpdatedMs: Date.now(),
    recipes: [],
    mealPrepData: getDefaultMealPrepData(),
    pantryData: getDefaultPantryData(),
    notesData: getDefaultNotesData(),
  });
}
