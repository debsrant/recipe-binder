import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatQuantity,
  parseQuantityToken,
  scaleIngredientLine,
} from '../src/lib/scaling.js';
import {
  collectMethods,
  collectTags,
  filterAndSortRecipes,
  getRecipeMethods,
  mergeCollectionSnapshots,
  normalizeRecipe,
  parseTagsInput,
} from '../src/lib/collection.js';
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
import { createZipBytes } from '../src/lib/zip.js';
import {
  FLAVOR_FAMILIES,
  FLAVOR_PAIRINGS,
  GRAIN_RATIOS,
  MEAT_TEMPERATURES,
  OIL_SMOKE_POINTS,
  SUBSTITUTIONS,
  TECHNIQUE_CARDS,
} from '../src/data/referenceGuide.js';
import { findMatchingTechniques, renderLinkedStepHtml } from '../src/lib/techniques.js';
import {
  convertIngredientLine,
  convertMeasurement,
  findIngredientDensity,
  getQuickEquivalents,
} from '../src/lib/units.js';

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

test('referenceGuide datasets are populated with valid flavor pairing cross-references', () => {
  assert.ok(MEAT_TEMPERATURES.length >= 10);
  assert.ok(GRAIN_RATIOS.length >= 10);
  assert.ok(OIL_SMOKE_POINTS.length >= 8);
  assert.ok(SUBSTITUTIONS.length >= 12);
  assert.ok(TECHNIQUE_CARDS.length >= 10);
  assert.equal(FLAVOR_FAMILIES.length, 5);

  const familyIds = new Set(FLAVOR_FAMILIES.map((f) => f.id));
  const flavorIds = new Set(FLAVOR_PAIRINGS.map((p) => p.id));
  for (const item of FLAVOR_PAIRINGS) {
    assert.ok(familyIds.has(item.familyId));
    for (const paired of item.pairsWellWith) {
      assert.ok(flavorIds.has(paired), `Unknown pairing ${paired} on ${item.id}`);
    }
  }
});
