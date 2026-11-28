import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatQuantity,
  parseQuantityToken,
  scaleIngredientLine,
} from '../src/lib/scaling.js';
import {
  collectCuisines,
  collectMethods,
  collectTags,
  filterAndSortRecipes,
  getRecipeMethods,
  hasCanningSpecs,
  mergeCollectionSnapshots,
  normalizeCanningSpecs,
  normalizeRecipe,
  parseTagsInput,
} from '../src/lib/collection.js';
import {
  findMatchingMixes,
  getMixRecipes,
  isMixRecipe,
  renderLinkedIngredientHtml,
} from '../src/lib/subRecipes.js';
import {
  parseMarkdownRecipe,
  recipeToFilename,
  recipeToMarkdown,
  slugifyFilename,
} from '../src/lib/markdown.js';
import {
  decodeHtmlEntities,
  parseDurationMinutes,
  parseHtmlRecipe,
  parseImportedContent,
  parseTextRecipe,
} from '../src/lib/recipeImport.js';
import { validateRecipeUrl } from '../src/lib/webScraper.js';
import {
  METHOD_CONVERSION_PRESETS,
  aiJsonToRecipeDraft,
  aiJsonToRecipeMethod,
  appendGeneratedMethodToRecipe,
  buildRecipePromptContext,
  extractGeminiInteractionText,
  extractJsonObjectFromText,
  mergeAiAutofillIntoDraft,
  normalizeAiConfig,
} from '../src/lib/ai.js';
import { createZipBytes } from '../src/lib/zip.js';
import {
  deleteNoteItem,
  extractGoogleDriveFileId,
  extractVideoTimestamps,
  extractYouTubeId,
  filterAndSortNotes,
  normalizeSafeUrl,
  parseTimestampToSeconds,
  parseYouTubeTranscriptPayload,
  stripTranscriptTimestamps,
  upsertNoteItem,
} from '../src/lib/notes.js';
import {
  CANNING_ALTITUDE_ADJUSTMENTS,
  CANNING_HEADSPACE_GUIDE,
  FLAVOR_FAMILIES,
  FLAVOR_PAIRINGS,
  FOOD_STORAGE_CATEGORIES,
  FOOD_STORAGE_TIMES,
  GRAIN_RATIOS,
  MEAT_TEMPERATURES,
  OIL_SMOKE_POINTS,
  SUBSTITUTIONS,
  TECHNIQUE_CARDS,
} from '../src/data/referenceGuide.js';
import {
  deleteFlavorItem,
  deleteReferenceItem,
  getDefaultReferenceData,
  mergeReferenceData,
  normalizeFlavor,
  normalizeReferenceData,
  normalizeStorageTime,
  normalizeSubstitution,
  normalizeTechnique,
  upsertReferenceItem,
} from '../src/lib/reference.js';
import { findMatchingTechniques, renderLinkedStepHtml } from '../src/lib/techniques.js';
import {
  convertIngredientLine,
  convertMeasurement,
  findIngredientDensity,
  getQuickEquivalents,
} from '../src/lib/units.js';
import {
  buildMergedPrepTimeline,
  deleteMealPrepItem,
  getDefaultMealPrepData,
  mergeMealPrepData,
  normalizeBatchTemplate,
  normalizeMealPrepData,
  upsertMealPrepItem,
} from '../src/lib/mealPrep.js';
import {
  PANTRY_ITEM_TYPES,
  PANTRY_LOCATIONS,
  adjustInventoryPortions,
  collectBinderIngredients,
  cyclePantryStatus,
  deletePantryItem,
  extractCoreIngredientName,
  getDefaultBestByDays,
  getDefaultPantryData,
  getInventoryFreshness,
  matchRecipesByIngredients,
  mergePantryData,
  normalizeIngredientKey,
  normalizePantryItem,
  upsertPantryItem,
} from '../src/lib/pantry.js';

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

const TEST_DIVIDERS = [
  { id: 'weeknight', name: 'Weeknight Staples', order: 0 },
  { id: 'baking', name: 'Baking', order: 1 },
  { id: 'breakfast', name: 'Breakfast', order: 2 },
  { id: 'sides', name: 'Sides & Salads', order: 3 },
];

test('recipeToMarkdown and parseMarkdownRecipe round-trip frontmatter and scaled export', () => {
  const sample = {
    id: 'rec-garlic-pasta',
    title: 'Garlic Butter Pasta',
    dividerId: 'weeknight',
    source: 'Kitchen Notebook',
    summary: 'Quick weeknight buttered spaghetti with toasted garlic.',
    prepMinutes: 10,
    cookMinutes: 15,
    servings: 4,
    tags: ['30-mins', 'vegetarian'],
    ingredients: ['1 lb spaghetti', '2 tbsp unsalted butter', '1/2 tsp kosher salt'],
    steps: ['Boil spaghetti until al dente.', 'Toss with warm garlic butter.'],
    notes: 'Reserve 1/2 cup pasta water before draining.',
    favorite: true,
    createdAt: '2026-11-26T10:00:00.000Z',
    updatedMs: 1764150000000,
  };

  assert.equal(slugifyFilename(sample.title), 'garlic-butter-pasta');
  assert.equal(recipeToFilename(sample), 'garlic-butter-pasta.md');

  const md = recipeToMarkdown(sample, { dividerName: 'Weeknight Staples' });
  const parsed = parseMarkdownRecipe(md, { dividers: TEST_DIVIDERS });

  assert.equal(parsed.id, sample.id);
  assert.equal(parsed.title, sample.title);
  assert.equal(parsed.dividerId, 'weeknight');
  assert.equal(parsed.source, sample.source);
  assert.equal(parsed.summary, sample.summary);
  assert.equal(parsed.prepMinutes, 10);
  assert.equal(parsed.cookMinutes, 15);
  assert.equal(parsed.servings, 4);
  assert.deepEqual(parsed.tags, ['30-mins', 'vegetarian']);
  assert.deepEqual(parsed.ingredients, sample.ingredients);
  assert.deepEqual(parsed.steps, sample.steps);
  assert.equal(parsed.notes, sample.notes);
  assert.equal(parsed.favorite, true);

  const scaledMd = recipeToMarkdown(sample, { dividerName: 'Weeknight Staples', scaleFactor: 2 });
  const parsedScaled = parseMarkdownRecipe(scaledMd, { dividers: TEST_DIVIDERS });
  assert.equal(parsedScaled.servings, 8);
  assert.equal(parsedScaled.ingredients[0], '2 lb spaghetti');
  assert.equal(parsedScaled.ingredients[2], '1 tsp kosher salt');
});

test('parseMarkdownRecipe handles plain Markdown without frontmatter and uses filename fallback', () => {
  const plainMd = `# Blueberry Muffins

*Tender bakery-style muffins.*

**Prep:** 15m | **Cook:** 25m | **Servings:** 12
Source: Grandma's Binder

## Ingredients

- [ ] 2 cups all-purpose flour
- [x] 1 cup fresh blueberries

## Directions

1. Whisk dry ingredients together.
2. Fold in blueberries and bake at 375 F.

## Notes

Great with coarse sparkling sugar on top.
`;

  const parsed = parseMarkdownRecipe(plainMd, {
    filename: 'blueberry-muffins.md',
    dividers: TEST_DIVIDERS,
  });

  assert.equal(parsed.title, 'Blueberry Muffins');
  assert.equal(parsed.prepMinutes, 15);
  assert.equal(parsed.cookMinutes, 25);
  assert.equal(parsed.servings, 12);
  assert.equal(parsed.source, "Grandma's Binder");
  assert.deepEqual(parsed.ingredients, ['2 cups all-purpose flour', '1 cup fresh blueberries']);
  assert.deepEqual(parsed.steps, [
    'Whisk dry ingredients together.',
    'Fold in blueberries and bake at 375 F.',
  ]);
  assert.equal(parsed.notes, 'Great with coarse sparkling sugar on top.');

  const noTitle = parseMarkdownRecipe('## Ingredients\n- 2 eggs\n## Steps\n1. Scramble.', {
    filename: 'quick_scrambled_eggs.md',
    dividers: TEST_DIVIDERS,
  });
  assert.equal(noTitle.title, 'Quick Scrambled Eggs');
});

test('createZipBytes writes valid ZIP headers, EOCD record, and deduplicates filenames', () => {
  const bytes = createZipBytes([
    { name: 'baking/cookies.md', content: '# Cookies\n' },
    { name: 'baking/cookies.md', content: '# Cookies Batch 2\n' },
  ]);

  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50); // Local file header signature
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes('baking/cookies.md'));
  assert.ok(text.includes('baking/cookies-2.md'));
  assert.ok(text.includes('# Cookies Batch 2'));

  // EOCD is the final 22 bytes (0 comment length)
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 12, true), 2);
});

test('parseDurationMinutes and decodeHtmlEntities handle ISO-8601, human strings, and entities', () => {
  assert.equal(parseDurationMinutes('PT1H30M'), 90);
  assert.equal(parseDurationMinutes('PT45M'), 45);
  assert.equal(parseDurationMinutes('P0DT0H20M'), 20);
  assert.equal(parseDurationMinutes('1 hr 15 min'), 75);
  assert.equal(decodeHtmlEntities('Mom&apos;s &amp; Dad&#39;s &#8217; &frac12; tsp at 350&deg;F'), "Mom's & Dad's ’ 1/2 tsp at 350°F");
});

test('parseHtmlRecipe extracts Schema.org JSON-LD @graph with HowToSection and HTML entities', () => {
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>Test Cake</title>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              { "@type": "WebPage", "name": "Blog Post" },
              {
                "@type": "Recipe",
                "name": "Classic Chocolate Cake &amp; Frosting",
                "description": "Rich homemade chocolate cake.",
                "author": { "@type": "Person", "name": "Chef Ada" },
                "prepTime": "PT20M",
                "cookTime": "PT35M",
                "recipeYield": ["12", "12 slices"],
                "recipeCategory": "Dessert",
                "keywords": "chocolate, birthday, baking",
                "recipeIngredient": [
                  "2 cups all-purpose flour",
                  "&frac12; cup cocoa powder"
                ],
                "recipeInstructions": [
                  {
                    "@type": "HowToSection",
                    "name": "Cake Batter",
                    "itemListElement": [
                      { "@type": "HowToStep", "text": "Preheat oven to 350&deg;F." },
                      { "@type": "HowToStep", "text": "Whisk flour and cocoa powder." }
                    ]
                  }
                ]
              }
            ]
          }
        </script>
      </head>
      <body></body>
    </html>
  `;

  const parsed = parseHtmlRecipe(html, {
    sourceUrl: 'https://www.examplekitchen.com/chocolate-cake',
    dividers: TEST_DIVIDERS,
  });

  assert.equal(parsed.title, 'Classic Chocolate Cake & Frosting');
  assert.equal(parsed.dividerId, 'baking');
  assert.equal(parsed.source, 'Chef Ada (examplekitchen.com)');
  assert.equal(parsed.prepMinutes, 20);
  assert.equal(parsed.cookMinutes, 35);
  assert.equal(parsed.servings, 12);
  assert.deepEqual(parsed.ingredients, ['2 cups all-purpose flour', '1/2 cup cocoa powder']);
  assert.deepEqual(parsed.steps, [
    '[Cake Batter] Preheat oven to 350°F.',
    'Whisk flour and cocoa powder.',
  ]);
  assert.ok(parsed.tags.includes('chocolate'));
  assert.equal(parsed.notes, 'Imported from: https://www.examplekitchen.com/chocolate-cake');
});

test('parseHtmlRecipe falls back to Microdata itemprop attributes', () => {
  const html = `
    <html>
      <body>
        <h1 itemprop="name">Crispy Roast Potatoes</h1>
        <span itemprop="prepTime" datetime="PT15M">15m</span>
        <span itemprop="cookTime" datetime="PT40M">40m</span>
        <span itemprop="recipeYield">4 servings</span>
        <ul>
          <li itemprop="recipeIngredient">2 lb Yukon gold potatoes</li>
          <li itemprop="recipeIngredient">3 tbsp olive oil</li>
        </ul>
        <ol itemprop="recipeInstructions">
          <li>Cut potatoes into 1-inch chunks.</li>
          <li>Roast at 425 F until crisp.</li>
        </ol>
      </body>
    </html>
  `;

  const parsed = parseHtmlRecipe(html, { dividers: TEST_DIVIDERS });
  assert.equal(parsed.title, 'Crispy Roast Potatoes');
  assert.equal(parsed.prepMinutes, 15);
  assert.equal(parsed.cookMinutes, 40);
  assert.equal(parsed.servings, 4);
  assert.deepEqual(parsed.ingredients, ['2 lb Yukon gold potatoes', '3 tbsp olive oil']);
  assert.deepEqual(parsed.steps, [
    'Cut potatoes into 1-inch chunks.',
    'Roast at 425 F until crisp.',
  ]);
});

test('parseTextRecipe converts both headed text and heading-less copied recipe text', () => {
  const headedText = `
    Jump to Recipe
    Honey Mustard Chicken Salad
    Prep Time: 15 min
    Cook Time: 10 min
    Servings: 4

    Ingredients
    ▢ 2 cups shredded chicken
    ▢ 2 tbsp Dijon mustard
    ▢ 1 tbsp honey

    Directions
    1. Whisk mustard and honey together.
    Step 2: Toss with shredded chicken and greens.
  `;

  const parsedHeaded = parseTextRecipe(headedText, { dividers: TEST_DIVIDERS });
  assert.equal(parsedHeaded.title, 'Honey Mustard Chicken Salad');
  assert.equal(parsedHeaded.dividerId, 'sides');
  assert.equal(parsedHeaded.prepMinutes, 15);
  assert.equal(parsedHeaded.cookMinutes, 10);
  assert.equal(parsedHeaded.servings, 4);
  assert.deepEqual(parsedHeaded.ingredients, [
    '2 cups shredded chicken',
    '2 tbsp Dijon mustard',
    '1 tbsp honey',
  ]);
  assert.deepEqual(parsedHeaded.steps, [
    'Whisk mustard and honey together.',
    'Toss with shredded chicken and greens.',
  ]);

  const unheadedText = `
    Quick Garlic Toast
    4 slices sourdough bread
    2 tbsp softened butter
    1 clove garlic, minced
    Spread butter and garlic over the sourdough slices.
    Broil for 2 minutes until golden and bubbling around the edges.
  `;

  const parsedUnheaded = parseTextRecipe(unheadedText, { dividers: TEST_DIVIDERS });
  assert.equal(parsedUnheaded.title, 'Quick Garlic Toast');
  assert.deepEqual(parsedUnheaded.ingredients, [
    '4 slices sourdough bread',
    '2 tbsp softened butter',
    '1 clove garlic, minced',
  ]);
  assert.deepEqual(parsedUnheaded.steps, [
    'Spread butter and garlic over the sourdough slices.',
    'Broil for 2 minutes until golden and bubbling around the edges.',
  ]);
});

test('parseImportedContent dispatches .json snapshots, Schema.org JSON, and .md files', () => {
  const snapRes = parseImportedContent(
    JSON.stringify({ dividers: TEST_DIVIDERS, recipes: [{ id: 'x', title: 'Soup' }] }),
    { filename: 'backup.json', dividers: TEST_DIVIDERS }
  );
  assert.equal(snapRes.kind, 'snapshot');
  assert.equal(snapRes.snapshot.recipes.length, 1);

  const schemaRes = parseImportedContent(
    JSON.stringify({
      '@type': 'Recipe',
      name: 'JSON Chili',
      recipeIngredient: ['1 lb beef'],
      recipeInstructions: ['Brown beef in pot.'],
    }),
    { filename: 'chili.json', dividers: TEST_DIVIDERS }
  );
  assert.equal(schemaRes.kind, 'recipe');
  assert.equal(schemaRes.recipe.title, 'JSON Chili');

  const mdRes = parseImportedContent('# Simple Tea\n\n## Ingredients\n- 1 tea bag\n## Steps\n1. Steep 3 minutes.', {
    filename: 'tea.md',
    dividers: TEST_DIVIDERS,
  });
  assert.equal(mdRes.kind, 'recipe');
  assert.equal(mdRes.recipe.title, 'Simple Tea');
});

test('validateRecipeUrl normalizes domains and blocks unsafe schemes', () => {
  assert.equal(validateRecipeUrl('www.budgetbytes.com/pasta/'), 'https://www.budgetbytes.com/pasta/');
  assert.equal(validateRecipeUrl('https://example.com/recipe'), 'https://example.com/recipe');
  assert.throws(() => validateRecipeUrl('javascript:alert(1)'), /Only http:\/\/ and https:\/\//);
  assert.throws(() => validateRecipeUrl('file:///etc/passwd'), /Only http:\/\/ and https:\/\//);
});

test('normalizeRecipe and getRecipeMethods support multi-method recipes and single-method fallback', () => {
  const single = normalizeRecipe({
    id: 's1',
    title: 'Roast Carrots',
    cookMinutes: 25,
    methodName: 'Oven',
    steps: ['Toss with oil.', 'Roast at 425 F.'],
  });
  assert.equal(single.methods.length, 1);
  assert.equal(single.methods[0].name, 'Oven');
  assert.equal(single.methods[0].cookMinutes, 25);
  assert.deepEqual(single.steps, ['Toss with oil.', 'Roast at 425 F.']);

  const multi = normalizeRecipe({
    id: 'm1',
    title: 'White Chicken Chili',
    prepMinutes: 15,
    methods: [
      {
        id: 'instant-pot',
        name: 'Instant Pot',
        cookMinutes: 35,
        note: 'Use 1 cup broth minimum.',
        steps: ['Saute onion.', 'Pressure cook 20 min.'],
      },
      {
        id: 'slow-cooker',
        name: 'Slow Cooker',
        cookMinutes: 360,
        note: 'Reduce broth to 1/2 cup.',
        steps: ['Combine in crock.', 'Cook on Low 6 hours.'],
      },
    ],
  });
  assert.equal(multi.methods.length, 2);
  assert.equal(multi.cookMinutes, 35);
  assert.deepEqual(multi.steps, ['Saute onion.', 'Pressure cook 20 min.']);
  assert.equal(getRecipeMethods(multi)[1].name, 'Slow Cooker');
});

test('filterAndSortRecipes searches method names, notes, and steps and sorts by shortest cook time', () => {
  const recipes = [
    normalizeRecipe({
      id: 'slow-first',
      title: 'Pulled Pork',
      prepMinutes: 15,
      methods: [
        { name: 'Slow Cooker', cookMinutes: 480, note: 'Low and slow', steps: ['Cook 8 hours.'] },
        { name: 'Instant Pot', cookMinutes: 75, note: 'Quick pressure release', steps: ['Pressure cook 60 min.'] },
      ],
    }),
    normalizeRecipe({
      id: 'pasta',
      title: 'Quick Pasta',
      prepMinutes: 10,
      methods: [{ name: 'Stovetop', cookMinutes: 15, steps: ['Boil pasta.'] }],
    }),
    normalizeRecipe({
      id: 'roast',
      title: 'Slow Roast Beef',
      prepMinutes: 15,
      methods: [{ name: 'Oven', cookMinutes: 120, steps: ['Roast until tender.'] }],
    }),
  ];

  assert.deepEqual(
    filterAndSortRecipes(recipes, { query: 'instant pot' }).map((r) => r.id),
    ['slow-first']
  );
  assert.deepEqual(
    filterAndSortRecipes(recipes, { query: 'quick pressure release' }).map((r) => r.id),
    ['slow-first']
  );
  assert.deepEqual(
    filterAndSortRecipes(recipes, { sortBy: 'time' }).map((r) => r.id),
    ['pasta', 'slow-first', 'roast']
  );
});

test('recipeToMarkdown and parseMarkdownRecipe round-trip single-method names and multi-method sections', () => {
  const singleOven = normalizeRecipe({
    id: 'single-1',
    title: 'Sheet Pan Salmon',
    dividerId: 'weeknight',
    prepMinutes: 10,
    methods: [{ id: 'oven', name: 'Oven', cookMinutes: 18, note: '', steps: ['Season salmon.', 'Bake at 400 F.'] }],
    ingredients: ['4 salmon fillets'],
  });
  const singleMd = recipeToMarkdown(singleOven, { dividerName: 'Weeknight Staples' });
  assert.ok(singleMd.includes('method: "Oven"'));
  assert.ok(singleMd.includes('### Oven (18m)'));
  const parsedSingle = parseMarkdownRecipe(singleMd, { dividers: TEST_DIVIDERS });
  assert.equal(parsedSingle.methods.length, 1);
  assert.equal(parsedSingle.methods[0].name, 'Oven');
  assert.equal(parsedSingle.methods[0].cookMinutes, 18);

  const multiChili = normalizeRecipe({
    id: 'multi-1',
    title: 'Beef Chili',
    dividerId: 'weeknight',
    prepMinutes: 15,
    ingredients: ['1 lb ground beef', '1 can kidney beans'],
    methods: [
      {
        id: 'instant-pot',
        name: 'Instant Pot',
        cookMinutes: 35,
        note: 'Keep 1 cup broth for pressure.',
        steps: ['Brown beef on Saute.', 'Pressure cook 15 min.'],
      },
      {
        id: 'slow-cooker',
        name: 'Slow Cooker',
        cookMinutes: 360,
        note: 'Brown beef first for best flavor.',
        steps: ['Add all ingredients to slow cooker.', 'Cook on Low 6 hours.'],
      },
    ],
  });
  const multiMd = recipeToMarkdown(multiChili, { dividerName: 'Weeknight Staples' });
  assert.ok(multiMd.includes('### Instant Pot (35m)'));
  assert.ok(multiMd.includes('> Note: Keep 1 cup broth for pressure.'));
  assert.ok(multiMd.includes('### Slow Cooker (6h)'));

  const parsedMulti = parseMarkdownRecipe(multiMd, { dividers: TEST_DIVIDERS });
  assert.equal(parsedMulti.methods.length, 2);
  assert.equal(parsedMulti.methods[0].name, 'Instant Pot');
  assert.equal(parsedMulti.methods[0].cookMinutes, 35);
  assert.equal(parsedMulti.methods[0].note, 'Keep 1 cup broth for pressure.');
  assert.deepEqual(parsedMulti.methods[0].steps, ['Brown beef on Saute.', 'Pressure cook 15 min.']);
  assert.equal(parsedMulti.methods[1].name, 'Slow Cooker');
  assert.equal(parsedMulti.methods[1].cookMinutes, 360);
  assert.equal(parsedMulti.methods[1].note, 'Brown beef first for best flavor.');
  assert.deepEqual(parsedMulti.methods[1].steps, [
    'Add all ingredients to slow cooker.',
    'Cook on Low 6 hours.',
  ]);
});

test('parseHtmlRecipe splits multi-method HowToSection blocks into separate cooking methods', () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Shredded Chicken Tacos",
            "prepTime": "PT10M",
            "cookTime": "PT25M",
            "recipeIngredient": ["2 lb chicken breast", "1 packet taco seasoning"],
            "recipeInstructions": [
              {
                "@type": "HowToSection",
                "name": "Instant Pot",
                "itemListElement": [
                  { "@type": "HowToStep", "text": "Place chicken and broth in pot." },
                  { "@type": "HowToStep", "text": "Pressure cook 12 minutes." }
                ]
              },
              {
                "@type": "HowToSection",
                "name": "Slow Cooker (4h)",
                "itemListElement": [
                  { "@type": "HowToStep", "text": "Place chicken in crock." },
                  { "@type": "HowToStep", "text": "Cook on High 3-4 hours." }
                ]
              }
            ]
          }
        </script>
      </head>
      <body></body>
    </html>
  `;

  const parsed = parseHtmlRecipe(html, { dividers: TEST_DIVIDERS });
  assert.equal(parsed.methods.length, 2);
  assert.equal(parsed.methods[0].name, 'Instant Pot');
  assert.equal(parsed.methods[0].cookMinutes, 25);
  assert.equal(parsed.methods[1].name, 'Slow Cooker');
  assert.equal(parsed.methods[1].cookMinutes, 240);
});

test('parseTextRecipe splits Instant Pot and Slow Cooker subheadings into separate cooking methods', () => {
  const text = `
    Creamy Chicken Soup
    Prep: 15 min
    Servings: 6

    Ingredients
    1 1/2 lb chicken thighs
    4 cups chicken broth

    Instructions
    Instant Pot (30 min):
    1. Saute veggies 5 minutes.
    2. Pressure cook on High 10 minutes.
    Slow Cooker (6 hr):
    1. Add all ingredients to slow cooker.
    2. Cook on Low 6 hours until chicken shreds easily.
  `;

  const parsed = parseTextRecipe(text, { dividers: TEST_DIVIDERS });
  assert.equal(parsed.methods.length, 2);
  assert.equal(parsed.methods[0].name, 'Instant Pot');
  assert.equal(parsed.methods[0].cookMinutes, 30);
  assert.deepEqual(parsed.methods[0].steps, [
    'Saute veggies 5 minutes.',
    'Pressure cook on High 10 minutes.',
  ]);
  assert.equal(parsed.methods[1].name, 'Slow Cooker');
  assert.equal(parsed.methods[1].cookMinutes, 360);
  assert.deepEqual(parsed.methods[1].steps, [
    'Add all ingredients to slow cooker.',
    'Cook on Low 6 hours until chicken shreds easily.',
  ]);
});

test('collectMethods aggregates unique method counts and filterAndSortRecipes filters by method', () => {
  const recipes = [
    normalizeRecipe({
      id: 'r1',
      title: 'Chicken Chili',
      methods: [
        { name: 'Instant Pot', cookMinutes: 30, steps: ['Cook.'] },
        { name: 'Slow Cooker', cookMinutes: 360, steps: ['Simmer.'] },
      ],
    }),
    normalizeRecipe({
      id: 'r2',
      title: 'Pork Carnitas',
      methods: [{ name: 'Slow Cooker', cookMinutes: 480, steps: ['Cook.'] }],
    }),
    normalizeRecipe({
      id: 'r3',
      title: 'Deleted Stew',
      deleted: true,
      methods: [{ name: 'Instant Pot', cookMinutes: 25, steps: ['Cook.'] }],
    }),
  ];

  assert.deepEqual(collectMethods(recipes), [
    { method: 'Slow Cooker', count: 2 },
    { method: 'Instant Pot', count: 1 },
  ]);

  assert.deepEqual(
    filterAndSortRecipes(recipes, { method: 'instant pot' }).map((r) => r.id),
    ['r1']
  );
  assert.deepEqual(
    filterAndSortRecipes(recipes, { method: 'Slow Cooker' }).map((r) => r.id),
    ['r1', 'r2']
  );
});

test('convertMeasurement handles volume, weight, temperature, fractions, and ingredient density conversions', () => {
  const flourToGrams = convertMeasurement({
    value: '1 1/2',
    fromUnit: 'cup',
    toUnit: 'g',
    ingredientId: 'ap-flour',
  });
  assert.equal(flourToGrams.ok, true);
  assert.equal(flourToGrams.formatted, '180');

  const butterToCups = convertMeasurement({
    value: 227,
    fromUnit: 'g',
    toUnit: 'cup',
    ingredientId: 'butter',
  });
  assert.equal(butterToCups.ok, true);
  assert.equal(butterToCups.formatted, '1');

  const volRes = convertMeasurement({ value: '1/2', fromUnit: 'cup', toUnit: 'tbsp' });
  assert.equal(volRes.ok, true);
  assert.equal(volRes.formatted, '8');

  const weightRes = convertMeasurement({ value: 1, fromUnit: 'lb', toUnit: 'g' });
  assert.equal(weightRes.ok, true);
  assert.equal(weightRes.formatted, '454');

  const tempRes = convertMeasurement({ value: 350, fromUnit: 'f', toUnit: 'c' });
  assert.equal(tempRes.ok, true);
  assert.equal(tempRes.formatted, '177');

  const missingDensity = convertMeasurement({ value: 1, fromUnit: 'cup', toUnit: 'g' });
  assert.equal(missingDensity.ok, false);

  const equivs = getQuickEquivalents('1', 'cup', 'ap-flour');
  assert.ok(equivs.some((e) => e.value === '16 tbsp'));
  assert.ok(equivs.some((e) => e.value === '120 g'));
  assert.equal(findIngredientDensity('2 1/4 cups all-purpose flour')?.id, 'ap-flour');
});

test('convertIngredientLine converts scaled recipes to metric and us-weight safely', () => {
  assert.equal(
    convertIngredientLine('1 1/2 cups all-purpose flour', 'original', 2),
    '3 cups all-purpose flour'
  );
  assert.equal(
    convertIngredientLine('1 cup all-purpose flour', 'metric', 1),
    '120 g all-purpose flour'
  );
  assert.equal(
    convertIngredientLine('1/2 cup unsalted butter', 'metric', 2),
    '227 g unsalted butter'
  );
  assert.equal(
    convertIngredientLine('1 1/2 lb boneless skinless chicken thighs', 'metric', 1),
    '680 g boneless skinless chicken thighs'
  );
  assert.equal(
    convertIngredientLine('1 cup all-purpose flour', 'us-weight', 1),
    '4.23 oz all-purpose flour'
  );
  assert.equal(
    convertIngredientLine('2 large eggs, room temperature', 'metric', 1),
    '2 large eggs, room temperature'
  );
  assert.equal(
    convertIngredientLine('2-3 cloves garlic, minced', 'metric', 1),
    '2-3 cloves garlic, minced'
  );
});

test('findMatchingTechniques and renderLinkedStepHtml link culinary keywords safely', () => {
  const step = 'Sear the chicken until golden, then deglaze with broth & <script>alert(1)</script> simmer 3 minutes.';
  const matches = findMatchingTechniques(step);
  assert.ok(matches.some((m) => m.techniqueId === 'searing'));
  assert.ok(matches.some((m) => m.techniqueId === 'deglazing'));
  assert.ok(matches.some((m) => m.techniqueId === 'simmer-reduce'));

  const esc = (v) =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const html = renderLinkedStepHtml(step, esc);
  assert.ok(html.includes('data-action="open-technique-modal"'));
  assert.ok(html.includes('data-technique-id="deglazing"'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('referenceGuide datasets are populated with valid herb food pairings and storage times', () => {
  assert.ok(MEAT_TEMPERATURES.length >= 10);
  assert.ok(GRAIN_RATIOS.length >= 10);
  assert.ok(OIL_SMOKE_POINTS.length >= 8);
  assert.ok(SUBSTITUTIONS.length >= 12);
  assert.ok(TECHNIQUE_CARDS.length >= 10);
  assert.equal(FLAVOR_FAMILIES.length, 5);
  assert.equal(FOOD_STORAGE_CATEGORIES.length, 6);
  assert.ok(FOOD_STORAGE_TIMES.length >= 25);

  const storageCatIds = new Set(FOOD_STORAGE_CATEGORIES.map((c) => c.id));
  for (const row of FOOD_STORAGE_TIMES) {
    assert.ok(storageCatIds.has(row.categoryId), `Unknown storage category ${row.categoryId}`);
    assert.ok(row.food && row.fridge && row.freezer);
  }

  const familyIds = new Set(FLAVOR_FAMILIES.map((f) => f.id));
  const flavorIds = new Set(FLAVOR_PAIRINGS.map((p) => p.id));
  for (const expectedId of ['marjoram', 'tarragon', 'cloves', 'curry-powder']) {
    assert.ok(flavorIds.has(expectedId), `Missing expected herb/spice ${expectedId}`);
  }
  for (const item of FLAVOR_PAIRINGS) {
    assert.ok(familyIds.has(item.familyId));
    assert.ok(item.foodPairings && typeof item.foodPairings === 'object');
    assert.ok(item.foodPairings.meats, `Missing meats foodPairing on ${item.id}`);
    assert.ok(item.foodPairings.vegetables, `Missing vegetables foodPairing on ${item.id}`);
    assert.ok(item.foodPairings.soupsSalads, `Missing soupsSalads foodPairing on ${item.id}`);
    assert.ok(item.foodPairings.appetizersBaking, `Missing appetizersBaking foodPairing on ${item.id}`);
    for (const paired of item.pairsWellWith) {
      assert.ok(flavorIds.has(paired), `Unknown pairing ${paired} on ${item.id}`);
    }
  }
});

test('referenceData includes spice substitutions and supports upsert, delete, prune, and merge', () => {
  const defaults = getDefaultReferenceData();
  assert.ok(defaults.substitutions.some((s) => s.category === 'Spices & Herbs' && s.missing.includes('Cumin')));
  assert.ok(defaults.substitutions.some((s) => s.category === 'Spices & Herbs' && s.missing.includes('Cinnamon')));

  const customSub = normalizeSubstitution({
    missing: 'Sumac',
    category: 'Spices & Herbs',
    amount: '1 tsp',
    substitute: '1 tsp lemon zest + pinch salt',
  });
  const updatedSubs = upsertReferenceItem(defaults.substitutions, customSub);
  assert.equal(updatedSubs.length, defaults.substitutions.length + 1);
  assert.equal(deleteReferenceItem(updatedSubs, customSub.id).length, defaults.substitutions.length);

  // Deleting a flavor prunes dangling references from other flavors' pairsWellWith
  const pruned = deleteFlavorItem(defaults.flavors, 'garlic');
  assert.equal(pruned.some((f) => f.id === 'garlic'), false);
  assert.equal(pruned.some((f) => f.pairsWellWith.includes('garlic')), false);

  // normalizeReferenceData preserves intentional empty arrays
  const emptyNorm = normalizeReferenceData({ substitutions: [], techniques: [], flavors: [], updatedMs: 500 });
  assert.equal(emptyNorm.substitutions.length, 0);
  assert.equal(emptyNorm.techniques.length, 0);
  assert.equal(emptyNorm.flavors.length, 0);

  // mergeReferenceData picks newer updatedMs, and mergeCollectionSnapshots propagates it
  const mergedRef = mergeReferenceData(
    { ...defaults, updatedMs: 100 },
    { ...defaults, substitutions: updatedSubs, updatedMs: 900 }
  );
  assert.equal(mergedRef.substitutions.length, updatedSubs.length);

  const mergedSnap = mergeCollectionSnapshots(
    { dividers: [], recipes: [], referenceData: { ...defaults, updatedMs: 100 } },
    { dividers: [], recipes: [], referenceData: { ...defaults, substitutions: updatedSubs, updatedMs: 900 } }
  );
  assert.equal(mergedSnap.referenceData.substitutions.length, updatedSubs.length);

  // Custom user-added technique auto-links inside recipe steps
  const customTech = normalizeTechnique({
    title: 'Blooming Spices',
    category: 'Heat & Sauces',
    keywords: ['bloom the spices'],
    steps: ['Warm spices in oil 30 seconds.'],
  });
  const customHtml = renderLinkedStepHtml('First bloom the spices in hot oil.', (s) => s, [
    ...defaults.techniques,
    customTech,
  ]);
  assert.ok(customHtml.includes(`data-technique-id="${customTech.id}"`));

  const customFlavor = normalizeFlavor({
    name: 'Tarragon',
    familyId: 'fresh-herbs',
    foodPairings: {
      meats: 'Chicken, Salmon',
      vegetables: 'Asparagus, Carrots',
      soupsSalads: 'Bearnaise',
      appetizersBaking: 'Deviled eggs',
    },
    bestWith: ['Chicken', 'Eggs'],
    pairsWellWith: ['parsley', 'Lemon Zest', 'Chives'],
  });
  assert.equal(customFlavor.id, 'tarragon');
  assert.deepEqual(customFlavor.bestWith, ['Chicken', 'Eggs']);
  assert.deepEqual(customFlavor.pairsWellWith, ['parsley', 'Lemon Zest', 'Chives']);
  assert.equal(customFlavor.foodPairings.meats, 'Chicken, Salmon');
  assert.equal(customFlavor.foodPairings.appetizersBaking, 'Deviled eggs');

  // Food Storage Times CRUD & defaults
  assert.ok(Array.isArray(defaults.storageTimes) && defaults.storageTimes.length >= 25);
  const customStorage = normalizeStorageTime({
    food: 'Cooked Lentils',
    categoryId: 'storage-leftovers',
    fridge: '4-5 days',
    freezer: '3 months',
    pantry: 'Max 2 hrs',
    notes: 'Portion into 1-cup jars before freezing',
  });
  assert.equal(customStorage.categoryId, 'storage-leftovers');
  const updatedStorage = upsertReferenceItem(defaults.storageTimes, customStorage);
  assert.equal(updatedStorage.length, defaults.storageTimes.length + 1);
  assert.equal(deleteReferenceItem(updatedStorage, customStorage.id).length, defaults.storageTimes.length);
});

test('servingSize persists across normalizeRecipe, search, and Markdown round-trip', () => {
  const recipe = normalizeRecipe({
    id: 'rec-soup',
    title: 'Butternut Soup',
    dividerId: 'weeknight',
    servings: 6,
    servingSize: '1 1/2 cups',
    ingredients: ['2 lb butternut squash', '4 cups broth'],
    steps: ['Roast squash and blend with warm broth.'],
  });
  assert.equal(recipe.servingSize, '1 1/2 cups');

  const searchHits = filterAndSortRecipes([recipe], { query: '1/2 cups' });
  assert.equal(searchHits.length, 1);

  const md = recipeToMarkdown(recipe, { dividerName: 'Weeknight' });
  assert.ok(md.includes('servingSize: "1 1/2 cups"'));
  assert.ok(md.includes('1 1/2 cups each'));

  const parsed = parseMarkdownRecipe(md);
  assert.equal(parsed.servings, 6);
  assert.equal(parsed.servingSize, '1 1/2 cups');
});

test('mealPrep templates CRUD and snapshot merge work offline & synced', () => {
  const defaults = getDefaultMealPrepData();
  assert.ok(defaults.templates.some((t) => t.id === 'batch-sunday-chicken'));

  const customTpl = normalizeBatchTemplate({
    id: 'tpl-pulled-pork',
    title: 'Pulled Pork 3 Ways',
    baseLabel: 'Braise 4 lb shoulder',
    derivatives: [{ title: 'Tacos', dayOffset: 2 }],
    updatedMs: 900,
  });
  const added = upsertMealPrepItem([], customTpl, normalizeBatchTemplate);
  assert.equal(added.length, 1);

  const mergedMp = mergeMealPrepData(
    { templates: [{ ...customTpl, updatedMs: 100 }] },
    { templates: [customTpl] }
  );
  assert.ok(mergedMp.templates.some((t) => t.id === customTpl.id && t.updatedMs === 900));

  const tombstoned = deleteMealPrepItem(added, 'tpl-pulled-pork');
  assert.equal(tombstoned[0].deleted, true);

  const snapMerged = mergeCollectionSnapshots(
    { dividers: [], recipes: [], mealPrepData: { templates: [] } },
    { dividers: [], recipes: [], mealPrepData: { templates: [customTpl] } }
  );
  assert.ok(snapMerged.mealPrepData.templates.some((t) => t.id === 'tpl-pulled-pork'));
});

test('buildMergedPrepTimeline extracts temperatures, scales ingredients, and orders phases longest first', () => {
  const salad = normalizeRecipe({
    id: 'rec-salad',
    title: 'Quick Salad',
    cookMinutes: 0,
    servings: 2,
    servingSize: '1 cup',
    ingredients: ['2 cucumbers, sliced'],
    methods: [
      {
        id: 'nocook',
        name: 'No-Cook',
        cookMinutes: 0,
        steps: ['Slice cucumbers thinly.', 'Toss with dressing just before serving.'],
      },
    ],
  });
  const roast = normalizeRecipe({
    id: 'rec-roast',
    title: 'Roast Chicken',
    cookMinutes: 40,
    servings: 4,
    servingSize: '2 thighs',
    ingredients: ['1 1/2 lb chicken thighs'],
    methods: [
      {
        id: 'oven',
        name: 'Oven',
        cookMinutes: 40,
        steps: [
          'Preheat oven to 400 F.',
          'Season chicken on sheet pan.',
          'Roast 40 minutes until golden.',
          'Rest 5 minutes and garnish with herbs to serve.',
        ],
      },
    ],
  });

  const timeline = buildMergedPrepTimeline([
    { recipe: salad, scale: 2 },
    { recipe: roast, scale: 1.5, methodId: 'oven' },
  ]);

  assert.ok(timeline.ovenTemps.includes('400F'));
  assert.equal(timeline.ingredientsByRecipe.length, 2);
  assert.equal(timeline.ingredientsByRecipe[0].scaledServings, 4);
  assert.equal(timeline.ingredientsByRecipe[1].servingSize, '2 thighs');
  assert.ok(timeline.ingredientsByRecipe[1].ingredients[0].startsWith('2 1/4 lb'));

  const preheat = timeline.phases.find((p) => p.id === 'preheat');
  const prep = timeline.phases.find((p) => p.id === 'prep');
  const cook = timeline.phases.find((p) => p.id === 'cook');
  const finish = timeline.phases.find((p) => p.id === 'finish');

  assert.equal(preheat.steps.length, 1);
  assert.ok(prep.steps.some((s) => s.recipeId === 'rec-salad'));
  assert.ok(cook.steps.some((s) => s.recipeId === 'rec-roast'));
  assert.equal(finish.steps.length, 2);
});

test('pantry unified inventory supports itemType, best-by freshness, portion steppers with auto Low/Out, and snapshot merge', () => {
  assert.equal(extractCoreIngredientName('1 1/2 lb boneless skinless chicken thighs, patted dry'), 'Boneless skinless chicken thighs');
  assert.equal(normalizeIngredientKey('1 1/2 lb boneless skinless chicken thighs, patted dry'), 'chicken thigh');
  assert.equal(normalizeIngredientKey('2 tbsp unsalted butter, divided'), 'butter');
  assert.equal(normalizeIngredientKey('1/4 cup fresh dill, chopped'), 'dill');

  assert.ok(PANTRY_ITEM_TYPES.some((t) => t.id === 'cooked-meal'));
  assert.ok(PANTRY_ITEM_TYPES.some((t) => t.id === 'mix-canned'));
  assert.equal(getDefaultBestByDays('fridge'), 4);
  assert.equal(getDefaultBestByDays('freezer'), 90);
  assert.equal(getDefaultBestByDays('canning-shelf'), 365);

  const defaults = getDefaultPantryData();
  assert.ok(defaults.items.some((i) => i.id === 'pan-kosher-salt' && i.alwaysStocked));

  const chicken = normalizePantryItem({
    id: 'pan-chicken',
    name: 'Chicken Thighs',
    itemType: 'ingredient',
    category: 'meat-seafood',
    location: 'fridge',
    portions: 3,
    quantity: '1 lb pack',
    storedDate: '2026-11-24',
    bestByDate: '2026-11-27',
    status: 'in-stock',
  });
  assert.equal(getInventoryFreshness(chicken, '2026-11-26').status, 'use-soon');
  assert.equal(getInventoryFreshness({ ...chicken, bestByDate: '2026-11-20' }, '2026-11-26').status, 'expired');
  assert.equal(getInventoryFreshness({ ...chicken, bestByDate: '' }, '2026-11-26').status, 'none');

  const stepTwo = adjustInventoryPortions(chicken, -2);
  assert.equal(stepTwo.portions, 1);
  assert.equal(stepTwo.status, 'low');
  const stepZero = adjustInventoryPortions(stepTwo, -1);
  assert.equal(stepZero.portions, 0);
  assert.equal(stepZero.status, 'out');
  assert.equal(getInventoryFreshness(stepZero, '2026-11-26').status, 'empty');
  const restocked = adjustInventoryPortions(stepZero, 2);
  assert.equal(restocked.status, 'in-stock');

  const cycled = cyclePantryStatus(chicken);
  assert.equal(cycled.status, 'low');
  assert.equal(cyclePantryStatus(cycled).status, 'out');

  const cookedBatch = normalizePantryItem({
    id: 'pan-chili',
    name: 'Beef Chili Batch',
    itemType: 'cooked-meal',
    recipeId: 'rec-chili',
    location: 'freezer',
    portions: 4,
    quantity: '1 1/2 cups',
    reheatNotes: 'Microwave covered 2 min.',
  });
  assert.equal(cookedBatch.itemType, 'cooked-meal');
  assert.equal(cookedBatch.reheatNotes, 'Microwave covered 2 min.');

  const upserted = upsertPantryItem(defaults.items, chicken);
  assert.equal(upserted.length, defaults.items.length + 1);
  const removed = deletePantryItem(upserted, 'pan-chicken');
  assert.equal(removed.find((i) => i.id === 'pan-chicken').deleted, true);

  const merged = mergePantryData(
    { items: [{ ...chicken, updatedMs: 100 }] },
    { items: [{ ...chicken, status: 'low', updatedMs: 900 }] }
  );
  assert.equal(merged.items.find((i) => i.id === 'pan-chicken').status, 'low');

  const snapMerged = mergeCollectionSnapshots(
    { dividers: [], recipes: [], pantryData: { items: [] } },
    { dividers: [], recipes: [], pantryData: { items: [chicken, cookedBatch] } }
  );
  assert.ok(snapMerged.pantryData.items.some((i) => i.id === 'pan-chili'));
});

test('matchRecipesByIngredients ranks recipes by readiness, includes staples optionally, and uses word boundaries', () => {
  const salad = normalizeRecipe({
    id: 'rec-cuc',
    title: 'Cucumber Dill Salad',
    ingredients: [
      '2 English cucumbers, thinly sliced',
      '1/3 cup fresh dill, chopped',
      '2 tbsp olive oil',
      '1/2 tsp kosher salt',
    ],
    steps: ['Toss together.'],
  });
  const soup = normalizeRecipe({
    id: 'rec-soup',
    title: 'Diced Tomato Soup',
    ingredients: [
      '2 cans diced tomatoes',
      '1 tbsp olive oil',
      '2 cloves garlic, minced',
      '1 cup heavy cream',
    ],
    steps: ['Simmer tomatoes and blend with cream.'],
  });
  const deletedRec = normalizeRecipe({
    id: 'rec-del',
    title: 'Deleted Recipe',
    ingredients: ['1 cup sugar'],
    deleted: true,
  });

  const binderIngs = collectBinderIngredients([salad, soup, deletedRec]);
  assert.ok(binderIngs.some((i) => i.key === 'olive oil' && i.recipeCount === 2));
  assert.equal(binderIngs.some((i) => i.key === 'sugar'), false);

  const staples = getDefaultPantryData().items;

  // "ice" must NOT false-match "diced tomatoes"
  const iceMatches = matchRecipesByIngredients([soup], ['ice'], {
    includeAlwaysStocked: false,
    pantryItems: staples,
  });
  assert.equal(iceMatches.length, 0);

  // With staples (olive oil + kosher salt), selecting cucumber + dill makes salad 100% ready
  const readyMatches = matchRecipesByIngredients([salad, soup], ['Cucumber', 'Dill'], {
    includeAlwaysStocked: true,
    pantryItems: staples,
    mode: 'ready',
  });
  assert.equal(readyMatches.length, 1);
  assert.equal(readyMatches[0].recipe.id, 'rec-cuc');
  assert.equal(readyMatches[0].canMakeNow, true);

  // Without staples, cucumber + dill only matches 2/4 of salad
  const noStaples = matchRecipesByIngredients([salad], ['Cucumber', 'Dill'], {
    includeAlwaysStocked: false,
    pantryItems: staples,
    mode: 'all',
  });
  assert.equal(noStaples[0].matchedCount, 2);
  assert.equal(noStaples[0].missingCount, 2);
  assert.equal(noStaples[0].canMakeNow, false);
});

test('Notes URL, YouTube, Drive, and timestamp helpers extract IDs and seconds cleanly', () => {
  assert.equal(normalizeSafeUrl('javascript:alert(1)'), '');
  assert.equal(normalizeSafeUrl('seriouseats.com/pan-pizza'), 'https://seriouseats.com/pan-pizza');

  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');

  assert.equal(
    extractGoogleDriveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing'),
    '1AbCdEfGhIjKlMnOpQrStUvWxYz'
  );
  assert.equal(
    extractGoogleDriveFileId('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz'),
    '1AbCdEfGhIjKlMnOpQrStUvWxYz'
  );

  assert.equal(parseTimestampToSeconds('02:15'), 135);
  assert.equal(parseTimestampToSeconds('1:02:03'), 3723);
  assert.equal(parseTimestampToSeconds('bad'), null);

  const jumps = extractVideoTimestamps('01:30 - brown butter\n04:05: fold dough\n01:30 duplicate');
  assert.equal(jumps.length, 2);
  assert.deepEqual(jumps[0], { label: '01:30', seconds: 90, text: 'brown butter' });
  assert.deepEqual(jumps[1], { label: '04:05', seconds: 245, text: 'fold dough' });
});

test('Transcript cleaners and YouTube payload parsers strip all timestamps cleanly', () => {
  const vtt = `WEBVTT
Kind: captions
Language: en

1
00:00:01.000 --> 00:00:04.200
First preheat your oven to 450 &amp; oil the skillet.

2
[00:04] Watch the edges crisp up nicely.
00:12 - Pull when golden.`;

  const stripped = stripTranscriptTimestamps(vtt);
  assert.ok(stripped.includes('First preheat your oven to 450 & oil the skillet.'));
  assert.ok(stripped.includes('Watch the edges crisp up nicely.'));
  assert.ok(stripped.includes('Pull when golden.'));
  assert.equal(/\d{1,2}:\d{2}/.test(stripped), false);
  assert.equal(stripped.includes('WEBVTT'), false);

  const json3 = JSON.stringify({
    events: [
      { tStartMs: 1200, segs: [{ utf8: 'Warm the ' }, { utf8: 'butter gently.' }] },
      { tStartMs: 4500, segs: [{ utf8: '[00:04] Whisk until foamy.' }] },
    ],
  });
  const parsedJson3 = parseYouTubeTranscriptPayload(json3);
  assert.equal(parsedJson3, 'Warm the butter gently. Whisk until foamy.');
  assert.equal(/\d{1,2}:\d{2}/.test(parsedJson3), false);

  const xml = '<transcript><text start="1.2" dur="2.0">Add garlic &amp; ginger.</text><text start="4.5" dur="1.8">00:04 Stir for 30 seconds.</text></transcript>';
  const parsedXml = parseYouTubeTranscriptPayload(xml);
  assert.equal(parsedXml, 'Add garlic & ginger. Stir for 30 seconds.');
  assert.equal(/\d{1,2}:\d{2}/.test(parsedXml), false);
});

test('filterAndSortNotes pins first, auto-sorts A-Z, searches transcripts, and merges notesData', () => {
  const items = [
    { id: 'n1', type: 'note', title: 'Zucchini Brining', body: 'Salt strips.', updatedMs: 100 },
    {
      id: 'n2',
      type: 'video',
      title: 'Apple Tart Technique',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      transcript: 'Brush apricot glaze while hot.',
      tags: ['pastry'],
      recipeIds: ['r-pie'],
      updatedMs: 200,
    },
    { id: 'n3', type: 'website', title: 'Brine Ratios Chart', url: 'example.com/brine', updatedMs: 300 },
  ];

  // Unpinned sorted alphabetically: Apple Tart -> Brine Ratios -> Zucchini Brining
  const alpha = filterAndSortNotes({ items });
  assert.deepEqual(
    alpha.map((i) => i.id),
    ['n2', 'n3', 'n1']
  );

  // Pin Zucchini Brining -> moves to top while remaining stay A-Z
  const withPin = filterAndSortNotes({ items, pinnedSet: new Set(['note-n1']) });
  assert.deepEqual(
    withPin.map((i) => i.id),
    ['n1', 'n2', 'n3']
  );

  // Searches inside video transcripts
  const transcriptSearch = filterAndSortNotes({ items, query: 'apricot glaze' });
  assert.deepEqual(
    transcriptSearch.map((i) => i.id),
    ['n2']
  );

  const upserted = upsertNoteItem(items, { id: 'n1', type: 'note', title: 'Zucchini Update', body: 'Done.' });
  const deleted = deleteNoteItem(upserted, 'n3');
  assert.equal(deleted.find((i) => i.id === 'n3').deleted, true);

  const mergedSnap = mergeCollectionSnapshots(
    {
      dividers: [],
      recipes: [],
      notesData: { googleDriveFolderUrl: '', googleDriveUpdatedMs: 0, items: [] },
    },
    {
      dividers: [],
      recipes: [],
      notesData: {
        googleDriveFolderUrl: 'https://drive.google.com/drive/folders/abc12345678',
        googleDriveUpdatedMs: 500,
        items: deleted,
      },
    }
  );
  assert.equal(
    mergedSnap.notesData.googleDriveFolderUrl,
    'https://drive.google.com/drive/folders/abc12345678'
  );
  assert.equal(mergedSnap.notesData.items.find((i) => i.id === 'n3').deleted, true);
});

test('AI config normalization, Gemini v1 response extraction, and recipe draft mapping work reliably', () => {
  const upgraded = normalizeAiConfig({
    provider: 'gemini',
    geminiModel: 'gemini-2.5-flash',
    geminiApiKey: '  AIzaTestKey123  ',
    ollamaUrl: 'http://127.0.0.1:11434/',
  });
  assert.equal(upgraded.provider, 'gemini');
  assert.equal(upgraded.geminiModel, 'gemini-4-hydrogen');
  assert.equal(upgraded.geminiApiKey, 'AIzaTestKey123');
  assert.equal(upgraded.ollamaUrl, 'http://127.0.0.1:11434');

  assert.equal(
    extractGeminiInteractionText({
      output_text: 'OK.',
      steps: [],
    }),
    'OK.'
  );
  assert.equal(
    extractGeminiInteractionText({
      steps: [
        { type: 'model_output', content: [{ type: 'text', text: '{"title":"Soup"}' }] },
      ],
    }),
    '{"title":"Soup"}'
  );

  const parsedJson = extractJsonObjectFromText(
    'Here you go:\n```json\n{"title":"Crispy Tofu","prepMinutes":10,"servings":2,"ingredients":["14 oz tofu"],"methods":[{"name":"Air Fryer","cookMinutes":18,"steps":["Cube tofu.","Air fry at 400 F."]}]}\n```'
  );
  const draft = aiJsonToRecipeDraft(parsedJson, {
    sourceUrl: 'https://youtu.be/dQw4w9WgXcQ',
    dividers: TEST_DIVIDERS,
    fallbackDividerId: 'weeknight',
  });
  assert.equal(draft.title, 'Crispy Tofu');
  assert.equal(draft.source, 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(draft.methods[0].name, 'Air Fryer');
  assert.equal(draft.methods[0].cookMinutes, 18);
  assert.deepEqual(draft.ingredients, ['14 oz tofu']);
});

test('Step 3 Cook Mode AI helpers build context, normalize generated methods, and append cleanly', () => {
  const baseRecipe = normalizeRecipe({
    id: 'rec-salmon',
    title: 'Garlic Herb Salmon',
    prepMinutes: 10,
    servings: 2,
    servingSize: '1 fillet',
    ingredients: ['2 salmon fillets', '1 tbsp olive oil'],
    steps: ['Rub salmon with oil.', 'Bake at 400 F for 14 min.'],
    cookMinutes: 14,
    notes: 'Pat dry before seasoning.',
  });

  const ctx = buildRecipePromptContext({
    recipe: baseRecipe,
    scaleFactor: 2,
    unitMode: 'original',
  });
  assert.ok(ctx.includes('Garlic Herb Salmon'));
  assert.ok(ctx.includes('Scaled Yield (2x): 4 servings'));
  assert.ok(ctx.includes('4 salmon fillets'));
  assert.ok(ctx.includes('Pat dry before seasoning.'));

  const newMethod = aiJsonToRecipeMethod(
    {
      name: 'Air Fryer',
      cookMinutes: 9,
      note: 'No need to preheat.',
      steps: ['Place salmon in basket.', 'Air fry at 390 F for 8-9 min.'],
    },
    { existingMethods: getRecipeMethods(baseRecipe) }
  );
  assert.equal(newMethod.id, 'air-fryer');
  assert.equal(newMethod.cookMinutes, 9);

  const appended = appendGeneratedMethodToRecipe(baseRecipe, newMethod);
  assert.equal(appended.newMethodIndex, 1);
  assert.equal(appended.recipe.methods.length, 2);
  assert.equal(appended.recipe.methods[0].name, 'Original');
  assert.equal(appended.recipe.methods[1].name, 'Air Fryer');
});

test('Recipe image, storageNotes, reheatNotes, collection pinning/alphabetical sort, and AI autofill merge work properly', () => {
  const recA = normalizeRecipe({
    id: 'r-z',
    title: 'Zucchini Fritters',
    imageUrl: 'https://example.com/zucchini.jpg',
    storageNotes: 'Refrigerate up to 3 days.',
    reheatNotes: 'Air fry 3 min at 375 F.',
    notes: 'Squeeze zucchini dry.',
  });
  const md = recipeToMarkdown(recA, { dividerName: 'Sides' });
  assert.ok(md.includes('imageUrl: "https://example.com/zucchini.jpg"'));
  assert.ok(md.includes('## Storage & Freezer'));
  assert.ok(md.includes('## Reheating'));
  const roundTrip = parseMarkdownRecipe(md, { dividers: TEST_DIVIDERS });
  assert.equal(roundTrip.imageUrl, 'https://example.com/zucchini.jpg');
  assert.equal(roundTrip.storageNotes, 'Refrigerate up to 3 days.');
  assert.equal(roundTrip.reheatNotes, 'Air fry 3 min at 375 F.');

  const htmlWithImg = `
    <html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Recipe","name":"Chili","image":["https://cdn.example.com/chili.jpg"],"recipeIngredient":["1 lb beef"],"recipeInstructions":["Simmer."]}
    </script></head><body></body></html>
  `;
  const importedImg = parseHtmlRecipe(htmlWithImg, { dividers: TEST_DIVIDERS });
  assert.equal(importedImg.imageUrl, 'https://cdn.example.com/chili.jpg');

  const recB = normalizeRecipe({ id: 'r-a', title: 'Apple Crisp', favorite: false });
  const recC = normalizeRecipe({ id: 'r-m', title: 'Marinara', favorite: true });
  const pinnedFirst = filterAndSortRecipes([recA, recB, recC], {
    sortBy: 'title',
    pinnedSet: new Set(['r-z']),
  });
  assert.deepEqual(
    pinnedFirst.map((r) => r.id),
    ['r-z', 'r-a', 'r-m']
  );

  const mergedDraft = mergeAiAutofillIntoDraft(
    { title: 'My Custom Chili', prepMinutes: 0, servings: 4, storageNotes: '' },
    {
      title: 'Ignored Suggested Title',
      summary: 'Hearty beef chili.',
      prepMinutes: 15,
      servingSize: '1 1/2 cups',
      storageNotes: 'Freeze up to 3 months.',
      reheatNotes: 'Microwave 2 min covered.',
    }
  );
  assert.equal(mergedDraft.title, 'My Custom Chili');
  assert.equal(mergedDraft.prepMinutes, 15);
  assert.equal(mergedDraft.summary, 'Hearty beef chili.');
  assert.equal(mergedDraft.servingSize, '1 1/2 cups');
  assert.equal(mergedDraft.storageNotes, 'Freeze up to 3 months.');
  assert.equal(mergedDraft.reheatNotes, 'Microwave 2 min covered.');
});

test('Mix / sub-recipe helper identifies mixes and links matching ingredient phrases cleanly', () => {
  const mixDividers = [
    { id: 'weeknight', name: 'Weeknight', order: 0 },
    { id: 'mixes', name: 'Mixes & Staples', order: 1 },
  ];
  const onionMix = normalizeRecipe({
    id: 'rec-onion-mix',
    title: 'Onion Soup Mix',
    dividerId: 'weeknight',
    tags: ['mix'],
    ingredients: ['1/4 cup dried onion flakes', '2 tbsp beef bouillon granules'],
  });
  const tacoMix = normalizeRecipe({
    id: 'rec-taco-mix',
    title: 'Homemade Taco Seasoning',
    dividerId: 'mixes',
    ingredients: ['1 tbsp chili powder', '1 tsp cumin'],
  });
  const beefDip = normalizeRecipe({
    id: 'rec-dip',
    title: 'French Onion Dip',
    dividerId: 'weeknight',
    ingredients: ['2 cups sour cream', '3 tbsp Onion Soup Mix'],
  });

  assert.equal(isMixRecipe(onionMix, mixDividers), true);
  assert.equal(isMixRecipe(tacoMix, mixDividers), true);
  assert.equal(isMixRecipe(beefDip, mixDividers), false);

  const availableForDip = getMixRecipes([onionMix, tacoMix, beefDip], 'rec-dip', mixDividers);
  assert.deepEqual(
    availableForDip.map((r) => r.id),
    ['rec-onion-mix', 'rec-taco-mix']
  );

  const matches = findMatchingMixes('3 tbsp Onion Soup Mix <extra>', availableForDip);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].recipeId, 'rec-onion-mix');

  const escapeFn = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const linkedHtml = renderLinkedIngredientHtml('3 tbsp Onion Soup Mix <extra>', escapeFn, availableForDip);
  assert.ok(linkedHtml.includes('data-action="open-mix-modal"'));
  assert.ok(linkedHtml.includes('data-recipe-id="rec-onion-mix"'));
  assert.ok(linkedHtml.includes('&lt;extra&gt;'));
});

test('Canning specs normalize, round-trip via Markdown, search cleanly, and Canning Shelf defaults work', () => {
  const rawCanning = {
    method: 'Water Bath',
    jarSize: 'Pint',
    headspace: '1/2 inch',
    processingTime: '15 min',
    pressure: '',
    altitudeNote: '0-1,000 ft base; +5 min at 1,001-3,000 ft',
    testedSource: 'Ball Complete Book',
  };
  const normalizedSpecs = normalizeCanningSpecs(rawCanning);
  assert.equal(hasCanningSpecs(normalizedSpecs), true);
  assert.equal(hasCanningSpecs(normalizeCanningSpecs({})), false);

  const pickled = normalizeRecipe({
    id: 'rec-pickles',
    title: 'Dill Cucumber Pickles',
    dividerId: 'sides',
    tags: ['canning'],
    ingredients: ['4 lbs pickling cucumbers', '2 cups white vinegar'],
    methods: [{ id: 'm1', name: 'Water Bath Canner', cookMinutes: 15, note: '', steps: ['Process 15 min.'] }],
    canning: rawCanning,
  });

  const md = recipeToMarkdown(pickled, { dividerName: 'Sides' });
  assert.ok(md.includes('## Canning Specs'));
  assert.ok(md.includes('- Method: Water Bath'));
  assert.ok(md.includes('- Headspace: 1/2 inch'));
  assert.ok(md.includes('- Tested Source: Ball Complete Book'));

  const parsedBack = parseMarkdownRecipe(md, { dividers: TEST_DIVIDERS });
  assert.deepEqual(parsedBack.canning, normalizedSpecs);

  const searchMatches = filterAndSortRecipes([pickled], { query: 'Ball Complete Book' });
  assert.equal(searchMatches.length, 1);

  assert.ok(CANNING_HEADSPACE_GUIDE.length >= 3);
  assert.ok(CANNING_ALTITUDE_ADJUSTMENTS.length >= 4);

  assert.ok(PANTRY_LOCATIONS.some((loc) => loc.id === 'canning-shelf'));

  const cannedShelfEntry = normalizePantryItem({
    id: 'can-1',
    name: 'Dill Pickles (Pint)',
    itemType: 'mix-canned',
    location: 'canning-shelf',
    storedDate: '2026-01-01',
    bestByDate: '2027-01-01',
    portions: 6,
  });
  assert.equal(cannedShelfEntry.location, 'canning-shelf');
  assert.equal(cannedShelfEntry.bestByDate, '2027-01-01');
  assert.equal(getDefaultBestByDays('canning-shelf'), 365);

  assert.ok(METHOD_CONVERSION_PRESETS.includes('Toaster Oven'));
  assert.equal(METHOD_CONVERSION_PRESETS.includes('Pressure Canner'), false);
});

test('Author & cuisine auto-detect from JSON-LD, Microdata, meta tags, Markdown, AI, and filter search', () => {
  const jsonLdHtml = `
    <html><head>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Recipe",
          "name": "Weeknight Pad Thai",
          "author": { "@type": "Person", "name": "Pailin Chongchitnant" },
          "recipeCuisine": ["Thai", "Southeast Asian"],
          "recipeIngredient": ["8 oz rice noodles", "2 tbsp tamarind paste"],
          "recipeInstructions": ["Soak noodles.", "Stir fry sauce and noodles."]
        }
      </script>
    </head><body></body></html>
  `;
  const fromJsonLd = parseHtmlRecipe(jsonLdHtml, {
    sourceUrl: 'https://hot-thai-kitchen.com/pad-thai',
    dividers: TEST_DIVIDERS,
  });
  assert.equal(fromJsonLd.author, 'Pailin Chongchitnant');
  assert.equal(fromJsonLd.cuisine, 'Thai, Southeast Asian');
  assert.equal(fromJsonLd.source, 'Pailin Chongchitnant (hot-thai-kitchen.com)');

  const microHtml = `
    <html>
      <head><meta name="author" content="Meta Chef"></head>
      <body>
        <h1 itemprop="name">Tacos al Pastor</h1>
        <span itemprop="recipeCuisine">Mexican</span>
        <ul><li itemprop="recipeIngredient">2 lb pork shoulder</li></ul>
        <ol itemprop="recipeInstructions"><li>Roast and slice thinly.</li></ol>
      </body>
    </html>
  `;
  const fromMicro = parseHtmlRecipe(microHtml, {
    sourceUrl: 'https://example.org/tacos',
    dividers: TEST_DIVIDERS,
  });
  assert.equal(fromMicro.author, 'Meta Chef');
  assert.equal(fromMicro.cuisine, 'Mexican');
  assert.equal(fromMicro.source, 'Meta Chef (example.org)');

  const normalized = normalizeRecipe(fromMicro, 'weeknight');
  const md = recipeToMarkdown(normalized, { dividerName: 'Weeknight Staples' });
  assert.ok(md.includes('author: "Meta Chef"'));
  assert.ok(md.includes('cuisine: "Mexican"'));
  const roundTrip = parseMarkdownRecipe(md, { dividers: TEST_DIVIDERS });
  assert.equal(roundTrip.author, 'Meta Chef');
  assert.equal(roundTrip.cuisine, 'Mexican');

  const matchingCuisine = filterAndSortRecipes([normalized], { query: 'mexican' });
  const matchingAuthor = filterAndSortRecipes([normalized], { query: 'meta chef' });
  assert.equal(matchingCuisine.length, 1);
  assert.equal(matchingAuthor.length, 1);

  assert.deepEqual(collectCuisines([normalized]), [{ cuisine: 'Mexican', count: 1 }]);

  const videoAiDraft = aiJsonToRecipeDraft(
    {
      title: 'Crispy Potatoes',
      cuisine: 'Mediterranean',
      ingredients: ['2 lbs potatoes'],
      methods: [{ name: 'Oven', cookMinutes: 40, steps: ['Roast at 425 F.'] }],
    },
    {
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      sourceAuthor: 'Kenji Cooking Show',
      dividers: TEST_DIVIDERS,
    }
  );
  assert.equal(videoAiDraft.author, 'Kenji Cooking Show');
  assert.equal(videoAiDraft.cuisine, 'Mediterranean');

  const mergedMeta = mergeAiAutofillIntoDraft(
    { title: 'My Soup', author: 'Existing Author', cuisine: '', servings: 4 },
    { author: 'AI Guess Author', cuisine: 'French' }
  );
  assert.equal(mergedMeta.author, 'Existing Author');
  assert.equal(mergedMeta.cuisine, 'French');
});
