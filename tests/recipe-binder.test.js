import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatQuantity,
  parseQuantityToken,
  scaleIngredientLine,
} from '../src/lib/scaling.js';
import {
  collectTags,
  filterAndSortRecipes,
  mergeCollectionSnapshots,
  parseTagsInput,
} from '../src/lib/collection.js';

test('parseQuantityToken handles integers, decimals, slash fractions, mixed numbers, and Unicode', () => {
  assert.equal(parseQuantityToken('2'), 2);
  assert.equal(parseQuantityToken('1.5'), 1.5);
  assert.equal(parseQuantityToken('1/2'), 0.5);
  assert.equal(parseQuantityToken('1 1/2'), 1.5);
  assert.equal(parseQuantityToken('½'), 0.5);
  assert.equal(parseQuantityToken('1½'), 1.5);
  assert.equal(parseQuantityToken('Pinch'), null);
});

test('formatQuantity produces clean kitchen fractions and trimmed decimals', () => {
  assert.equal(formatQuantity(0.5), '1/2');
  assert.equal(formatQuantity(1.5), '1 1/2');
  assert.equal(formatQuantity(0.75), '3/4');
  assert.equal(formatQuantity(2 / 3), '2/3');
  assert.equal(formatQuantity(3), '3');
  assert.equal(formatQuantity(1.42), '1.42');
});

test('scaleIngredientLine scales single quantities, ranges, and leaves non-numeric lines intact', () => {
  assert.equal(scaleIngredientLine('1 1/2 cups all-purpose flour', 2), '3 cups all-purpose flour');
  assert.equal(scaleIngredientLine('1 cup unsalted butter', 0.5), '1/2 cup unsalted butter');
  assert.equal(scaleIngredientLine('½ tsp kosher salt', 3), '1 1/2 tsp kosher salt');
  assert.equal(scaleIngredientLine('2-3 cloves garlic, minced', 2), '4-6 cloves garlic, minced');
  assert.equal(scaleIngredientLine('Freshly ground black pepper to taste', 2), 'Freshly ground black pepper to taste');
  assert.equal(scaleIngredientLine('2 tbsp olive oil', 1), '2 tbsp olive oil');
});

test('parseTagsInput normalizes and deduplicates comma-separated tags', () => {
  assert.deepEqual(parseTagsInput(' #30 Mins, Dairy Free, 30-mins , Quick!! '), [
    '30-mins',
    'dairy-free',
    'quick',
  ]);
});

test('filterAndSortRecipes excludes deleted cards and filters by divider, favorite, tag, and query', () => {
  const sample = [
    {
      id: 'a',
      title: 'Garlic Chicken',
      dividerId: 'weeknight',
      summary: 'Pan seared',
      source: 'Binder',
      prepMinutes: 10,
      cookMinutes: 20,
      servings: 4,
      tags: ['30-mins', 'one-pan'],
      ingredients: ['1 lb chicken thighs'],
      steps: ['Sear chicken'],
      notes: '',
      favorite: true,
      updatedMs: 200,
      deleted: false,
    },
    {
      id: 'b',
      title: 'Apple Pie',
      dividerId: 'baking',
      summary: 'Flaky crust',
      source: 'Index Card',
      prepMinutes: 30,
      cookMinutes: 45,
      servings: 8,
      tags: ['sweet'],
      ingredients: ['6 apples'],
      steps: ['Bake pie'],
      notes: 'Use tart apples',
      favorite: false,
      updatedMs: 300,
      deleted: false,
    },
    {
      id: 'c',
      title: 'Deleted Soup',
      dividerId: 'weeknight',
      tags: ['30-mins'],
      ingredients: [],
      steps: [],
      favorite: true,
      updatedMs: 500,
      deleted: true,
    },
  ];

  assert.deepEqual(
    filterAndSortRecipes(sample, { dividerId: 'weeknight' }).map((r) => r.id),
    ['a']
  );
  assert.deepEqual(
    filterAndSortRecipes(sample, { favoritesOnly: true }).map((r) => r.id),
    ['a']
  );
  assert.deepEqual(
    filterAndSortRecipes(sample, { tag: 'sweet' }).map((r) => r.id),
    ['b']
  );
  assert.deepEqual(
    filterAndSortRecipes(sample, { query: 'tart apples' }).map((r) => r.id),
    ['b']
  );
  assert.deepEqual(
    filterAndSortRecipes(sample, { sortBy: 'title' }).map((r) => r.id),
    ['b', 'a']
  );
});

test('collectTags ignores deleted recipes and counts active tags', () => {
  const tags = collectTags([
    { id: '1', tags: ['30-mins', 'quick'], deleted: false },
    { id: '2', tags: ['30-mins'], deleted: false },
    { id: '3', tags: ['30-mins', 'deleted-tag'], deleted: true },
  ]);
  assert.deepEqual(tags, [
    { tag: '30-mins', count: 2 },
    { tag: 'quick', count: 1 },
  ]);
});

test('mergeCollectionSnapshots resolves recipe conflicts by updatedMs and preserves delete tombstones', () => {
  const local = {
    dividers: [{ id: 'weeknight', name: 'Weeknight', order: 0 }],
    dividersUpdatedMs: 100,
    recipes: [
      { id: 'r1', title: 'Local Old', dividerId: 'weeknight', updatedMs: 100, deleted: false },
      { id: 'r2', title: 'Local Newer', dividerId: 'weeknight', updatedMs: 500, deleted: false },
      { id: 'r3', title: 'To Delete', dividerId: 'weeknight', updatedMs: 200, deleted: false },
    ],
  };

  const remote = {
    dividers: [
      { id: 'weeknight', name: 'Weeknight Staples', order: 0 },
      { id: 'baking', name: 'Baking', order: 1 },
    ],
    dividersUpdatedMs: 250,
    recipes: [
      { id: 'r1', title: 'Remote Newer', dividerId: 'weeknight', updatedMs: 400, deleted: false },
      { id: 'r2', title: 'Remote Old', dividerId: 'weeknight', updatedMs: 300, deleted: false },
      { id: 'r3', title: 'To Delete', dividerId: 'weeknight', updatedMs: 600, deleted: true },
    ],
  };

  const merged = mergeCollectionSnapshots(local, remote);
  assert.equal(merged.dividers.length, 2);
  assert.equal(merged.dividers[0].name, 'Weeknight Staples');

  const byId = new Map(merged.recipes.map((r) => [r.id, r]));
  assert.equal(byId.get('r1').title, 'Remote Newer');
  assert.equal(byId.get('r2').title, 'Local Newer');
  assert.equal(byId.get('r3').deleted, true);
});
