import { parseTagsInput } from './collection.js';
import { parseMarkdownRecipe, slugifyFilename } from './markdown.js';
import { parseQuantityToken } from './scaling.js';

const METHOD_KEYWORD_PATTERNS = [
  { name: 'Instant Pot', re: /\b(?:instant\s*pot|pressure\s*cook(?:er|ing)?)\b/i },
  { name: 'Slow Cooker', re: /\b(?:slow\s*cooker|crock[\s-]?pot)\b/i },
  { name: 'Air Fryer', re: /\bair\s*fry(?:er|ing)?\b/i },
  { name: 'Dutch Oven', re: /\bdutch\s*oven\b/i },
  { name: 'Grill', re: /\bgrill(?:ed|ing)?\b/i },
  { name: 'Griddle', re: /\bgriddle\b/i },
  { name: 'Skillet', re: /\bskillet\b/i },
  { name: 'Oven', re: /\b(?:preheat\s+oven|oven|bake|roast|broil)\b/i },
  { name: 'Stovetop', re: /\b(?:stovetop|stove\s*top|simmer|boil|saut[eé]|saucepan)\b/i },
  { name: 'No-Cook', re: /\bno[\s-]?cook\b/i },
];

/**
 * Detects a common cooking method name (e.g. Instant Pot, Slow Cooker, Oven, Skillet) from text.
 */
export function detectCookingMethodName(candidateTexts) {
  const haystack = (Array.isArray(candidateTexts) ? candidateTexts : [candidateTexts])
    .filter(Boolean)
    .join(' ');
  if (!haystack.trim()) return '';
  for (const entry of METHOD_KEYWORD_PATTERNS) {
    if (entry.re.test(haystack)) return entry.name;
  }
  return '';
}

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  deg: '°',
  frac12: '1/2',
  frac14: '1/4',
  frac34: '3/4',
  frac13: '1/3',
  frac23: '2/3',
  frac18: '1/8',
  frac38: '3/8',
  frac58: '5/8',
  frac78: '7/8',
  times: '×',
  middot: '·',
  bull: '•',
};

/**
 * Decodes common named and numeric HTML entities into plain UTF-8 characters.
 */
export function decodeHtmlEntities(input) {
  return String(input ?? '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z0-9]+);/g, (full, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : full;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : full;
    }
    const mapped = NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()];
    return mapped !== undefined ? mapped : full;
  });
}

/**
 * Strips HTML tags and normalizes whitespace while preserving line breaks at block boundaries.
 */
export function stripHtmlTags(html) {
  const withoutBlocks = String(html ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeHtmlEntities(withoutBlocks)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses ISO-8601 recipe durations (e.g. "PT1H30M") or human strings (e.g. "1 hr 15 min") into minutes.
 */
export function parseDurationMinutes(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  const text = String(raw).trim();
  if (!text) return 0;

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    return Math.max(0, Math.round(Number(text)));
  }

  const isoMatch = text.match(
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
  );
  if (isoMatch && (isoMatch[1] || isoMatch[2] || isoMatch[3] || isoMatch[4])) {
    const days = Number(isoMatch[1] || 0);
    const hours = Number(isoMatch[2] || 0);
    const mins = Number(isoMatch[3] || 0);
    const secs = Number(isoMatch[4] || 0);
    return Math.max(0, Math.round(days * 1440 + hours * 60 + mins + secs / 60));
  }

  const lower = text.toLowerCase();
  let total = 0;
  let matched = false;
  const hrMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  if (hrMatch) {
    total += Number(hrMatch[1]) * 60;
    matched = true;
  }
  const minMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);
  if (minMatch) {
    total += Number(minMatch[1]);
    matched = true;
  }
  if (matched) return Math.max(0, Math.round(total));

  const numeric = lower.match(/(\d+(?:\.\d+)?)/);
  return numeric ? Math.max(0, Math.round(Number(numeric[1]))) : 0;
}

/**
 * Extracts a positive serving count from Schema.org recipeYield or human text.
 */
export function parseServingsNumber(raw) {
  const candidate = Array.isArray(raw) ? raw.find(Boolean) : raw;
  if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
    return candidate;
  }
  const text = decodeHtmlEntities(String(candidate || '')).trim();
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 4;
  const num = Number(match[1]);
  return Number.isFinite(num) && num > 0 ? num : 4;
}

/**
 * Guesses the best matching binder divider ID from category, tag, or title keywords.
 */
export function guessDividerId(candidateTexts, dividers, fallbackDividerId = 'weeknight') {
  const list = Array.isArray(dividers) ? dividers : [];
  const haystack = (Array.isArray(candidateTexts) ? candidateTexts : [candidateTexts])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack || list.length === 0) {
    return fallbackDividerId || list[0]?.id || 'weeknight';
  }

  for (const div of list) {
    const nameLower = String(div.name || '').toLowerCase();
    const idLower = String(div.id || '').toLowerCase();
    if (nameLower && haystack.includes(nameLower)) return div.id;
    if (idLower && haystack.includes(idLower)) return div.id;
  }

  const keywordGroups = [
    {
      match: /\b(bake|baking|cake|cookie|cookies|brownie|bread|sourdough|muffin|pie|tart|pastry|dessert|sweet|cupcake)\b/,
      target: ['baking', 'dessert', 'desserts', 'sweets'],
    },
    {
      match: /\b(breakfast|brunch|pancake|pancakes|waffle|oatmeal|granola|omelet|frittata|toast|egg)\b/,
      target: ['breakfast', 'brunch', 'morning'],
    },
    {
      match: /\b(salad|side|sides|slaw|appetizer|dip|starter|soup)\b/,
      target: ['sides', 'salads', 'salad', 'sides & salads', 'appetizers'],
    },
    {
      match: /\b(holiday|thanksgiving|christmas|festive|roast|cranberry|stuffing|gravy)\b/,
      target: ['holiday', 'holidays', 'holiday classics'],
    },
  ];

  for (const group of keywordGroups) {
    if (!group.match.test(haystack)) continue;
    const found = list.find((d) =>
      group.target.some((t) => d.id.toLowerCase().includes(t) || d.name.toLowerCase().includes(t))
    );
    if (found) return found.id;
  }

  return fallbackDividerId || list[0]?.id || 'weeknight';
}

function isRecipeNodeType(typeValue) {
  if (!typeValue) return false;
  if (Array.isArray(typeValue)) {
    return typeValue.some((entry) => isRecipeNodeType(entry));
  }
  const str = String(typeValue).trim().toLowerCase();
  return str === 'recipe' || str.endsWith('/recipe') || str.endsWith(':recipe');
}

function findRecipeNode(node, seen = new Set()) {
  if (!node || typeof node !== 'object') return null;
  if (seen.has(node)) return null;
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item, seen);
      if (found) return found;
    }
    return null;
  }

  if (isRecipeNodeType(node['@type'])) {
    return node;
  }

  if (Array.isArray(node['@graph'])) {
    const found = findRecipeNode(node['@graph'], seen);
    if (found) return found;
  }

  if (node.mainEntity) {
    const found = findRecipeNode(node.mainEntity, seen);
    if (found) return found;
  }

  for (const val of Object.values(node)) {
    if (val && typeof val === 'object') {
      const found = findRecipeNode(val, seen);
      if (found) return found;
    }
  }

  return null;
}

function extractAuthorName(author) {
  if (!author) return '';
  if (typeof author === 'string') return decodeHtmlEntities(author).trim();
  if (Array.isArray(author)) {
    return author.map((a) => extractAuthorName(a)).filter(Boolean).join(', ');
  }
  if (typeof author === 'object') {
    return decodeHtmlEntities(author.name || author.alternateName || '').trim();
  }
  return '';
}

function flattenInstructions(rawInstructions) {
  const steps = [];

  function pushStep(text, prefix = '') {
    const clean = stripHtmlTags(text).replace(/\s*\n+\s*/g, ' ').trim();
    if (!clean) return;
    const stripped = clean.replace(/^(?:step\s+\d+\s*[:.)-]?\s*|\d+[.)]\s+)/i, '').trim();
    if (!stripped) return;
    steps.push(prefix ? `[${prefix}] ${stripped}` : stripped);
  }

  function walk(item, sectionName = '') {
    if (!item) return;
    if (typeof item === 'string') {
      for (const line of item.split(/\r?\n+/)) {
        pushStep(line, sectionName);
      }
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((entry) => walk(entry, sectionName));
      return;
    }
    if (typeof item === 'object') {
      const typeStr = String(item['@type'] || '').toLowerCase();
      if (typeStr.includes('howtosection') || Array.isArray(item.itemListElement)) {
        const subName = stripHtmlTags(item.name || '');
        const items = item.itemListElement || item.steps || [];
        if (Array.isArray(items)) {
          items.forEach((child, idx) => walk(child, idx === 0 && subName ? subName : ''));
        } else {
          walk(items, subName);
        }
        return;
      }
      const text = item.text || item.name || item.description || '';
      pushStep(text, sectionName);
    }
  }

  walk(rawInstructions);
  return steps;
}

function extractImageUrl(rawImage, baseUrl = '') {
  const pickUrl = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return decodeHtmlEntities(val).trim();
    if (Array.isArray(val)) {
      for (const entry of val) {
        const found = pickUrl(entry);
        if (found) return found;
      }
      return '';
    }
    if (typeof val === 'object') {
      return pickUrl(val.url || val.contentUrl || val.thumbnailUrl || '');
    }
    return '';
  };

  const candidate = pickUrl(rawImage);
  if (!candidate) return '';
  try {
    const resolved = baseUrl ? new URL(candidate, baseUrl) : new URL(candidate);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return '';
    return resolved.toString();
  } catch {
    return /^https?:\/\//i.test(candidate) ? candidate : '';
  }
}

function extractMetaOgImage(html, baseUrl = '') {
  const m =
    html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);
  return m?.[1] ? extractImageUrl(m[1], baseUrl) : '';
}

function buildSourceLabel(authorRaw, sourceUrl) {
  const author = extractAuthorName(authorRaw);
  let hostname = '';
  if (sourceUrl) {
    try {
      hostname = new URL(sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      hostname = '';
    }
  }
  if (author && hostname && !author.toLowerCase().includes(hostname.toLowerCase())) {
    return `${author} (${hostname})`;
  }
  return author || hostname || '';
}

function extractMethodSections(rawInstructions, fallbackCookMinutes = 0) {
  if (!Array.isArray(rawInstructions)) return null;
  const howToSections = rawInstructions.filter(
    (item) =>
      item &&
      typeof item === 'object' &&
      (String(item['@type'] || '').toLowerCase().includes('howtosection') ||
        Array.isArray(item.itemListElement)) &&
      item.name
  );
  if (howToSections.length < 2) return null;

  const matchedMethods = [];
  for (let idx = 0; idx < howToSections.length; idx += 1) {
    const sec = howToSections[idx];
    const secName = stripHtmlTags(sec.name || '');
    const detected = detectCookingMethodName(secName);
    if (!detected) continue;

    const cleanName = secName
      .replace(/\s*(?:method|instructions|directions|version)\s*$/i, '')
      .trim() || detected;
    const steps = flattenInstructions(sec.itemListElement || sec.steps || []);
    const durationMatch = secName.match(/\(([^)]+)\)/);
    const parsedCook = durationMatch ? parseDurationMinutes(durationMatch[1]) : 0;

    matchedMethods.push({
      id: slugifyFilename(cleanName, `method-${idx + 1}`),
      name: cleanName.replace(/\s*\([^)]+\)\s*$/, '').trim() || detected,
      cookMinutes: parsedCook || (idx === 0 ? fallbackCookMinutes : 0),
      note: '',
      steps,
    });
  }

  return matchedMethods.length >= 2 ? matchedMethods : null;
}

function recipeFromJsonLdNode(node, { sourceUrl = '', dividers = [], fallbackDividerId = 'weeknight' } = {}) {
  const title = stripHtmlTags(node.name || node.headline || '') || 'Imported Recipe';
  const summary = stripHtmlTags(node.description || '').split('\n')[0] || '';
  const source = buildSourceLabel(node.author, sourceUrl);
  const imageUrl = extractImageUrl(node.image, sourceUrl);

  const prepMinutes = parseDurationMinutes(node.prepTime);
  let cookMinutes = parseDurationMinutes(node.cookTime);
  const totalMinutes = parseDurationMinutes(node.totalTime);
  if (prepMinutes === 0 && cookMinutes === 0 && totalMinutes > 0) {
    cookMinutes = totalMinutes;
  }

  const servings = parseServingsNumber(node.recipeYield);

  const rawIngredients = node.recipeIngredient || node.ingredients || [];
  const ingredients = (Array.isArray(rawIngredients) ? rawIngredients : [rawIngredients])
    .flatMap((line) => String(line ?? '').split(/\r?\n/))
    .map((line) => stripHtmlTags(line).replace(/^[-*•▢☐]\s*/, '').trim())
    .filter(Boolean);

  const tagInputs = [];
  const pushTags = (val) => {
    if (!val) return;
    if (Array.isArray(val)) val.forEach(pushTags);
    else tagInputs.push(decodeHtmlEntities(String(val)));
  };
  pushTags(node.recipeCategory);
  pushTags(node.recipeCuisine);
  pushTags(node.keywords);
  const tags = parseTagsInput(tagInputs.join(',')).slice(0, 8);

  const multiMethods = extractMethodSections(node.recipeInstructions, cookMinutes);
  const steps = multiMethods ? multiMethods[0].steps : flattenInstructions(node.recipeInstructions);
  const methods = multiMethods || [
    {
      id: 'method-1',
      name: detectCookingMethodName([title, ...tags, ...steps]),
      cookMinutes,
      note: '',
      steps,
    },
  ];

  const dividerId = guessDividerId(
    [title, node.recipeCategory, node.recipeCuisine, ...(tags || [])],
    dividers,
    fallbackDividerId
  );

  return {
    id: '',
    title,
    dividerId,
    summary,
    source,
    imageUrl,
    prepMinutes,
    cookMinutes: methods[0].cookMinutes,
    servings,
    tags,
    ingredients,
    steps,
    methods,
    notes: sourceUrl ? `Imported from: ${sourceUrl}` : '',
    favorite: false,
    deleted: false,
  };
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    let raw = String(match[1] || '').trim();
    if (!raw) continue;
    raw = raw.replace(/^<!--/, '').replace(/-->$/, '').trim();
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      try {
        const noTrailingCommas = raw.replace(/,\s*([}\]])/g, '$1');
        blocks.push(JSON.parse(noTrailingCommas));
      } catch {
        // Ignore malformed JSON-LD script blocks
      }
    }
  }
  return blocks;
}

function parseMicrodataRecipe(html, { sourceUrl = '', dividers = [], fallbackDividerId = 'weeknight' } = {}) {
  const ingredientMatches = [];
  const ingRe =
    /<([a-z0-9]+)\b[^>]*itemprop=["'][^"']*\b(?:recipeIngredient|ingredients)\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = ingRe.exec(html)) !== null) {
    const line = stripHtmlTags(m[2]).replace(/^[-*•▢☐]\s*/, '').trim();
    if (line) ingredientMatches.push(line);
  }

  const stepMatches = [];
  const stepContainerRe =
    /<([a-z0-9]+)\b[^>]*itemprop=["'][^"']*\brecipeInstructions\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  while ((m = stepContainerRe.exec(html)) !== null) {
    const innerHtml = m[2];
    const liMatches = [...innerHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
    if (liMatches.length > 0) {
      for (const li of liMatches) {
        const text = stripHtmlTags(li[1]).replace(/^(?:step\s+\d+\s*[:.)-]?\s*|\d+[.)]\s+)/i, '').trim();
        if (text) stepMatches.push(text);
      }
    } else {
      const text = stripHtmlTags(innerHtml);
      for (const line of text.split('\n')) {
        const clean = line.replace(/^(?:step\s+\d+\s*[:.)-]?\s*|\d+[.)]\s+)/i, '').trim();
        if (clean) stepMatches.push(clean);
      }
    }
  }

  if (ingredientMatches.length === 0 && stepMatches.length === 0) {
    return null;
  }

  const nameMatch =
    html.match(/<[^>]*itemprop=["']name["'][^>]*>([\s\S]*?)<\/[^>]+>/i) ||
    html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = stripHtmlTags(nameMatch?.[1] || '') || 'Imported Recipe';

  const descMatch = html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const summary = stripHtmlTags(descMatch?.[1] || '');

  const prepMatch = html.match(/itemprop=["']prepTime["'][^>]*(?:datetime|content)=["']([^"']+)["']/i);
  const cookMatch = html.match(/itemprop=["']cookTime["'][^>]*(?:datetime|content)=["']([^"']+)["']/i);
  const yieldMatch = html.match(/itemprop=["']recipeYield["'][^>]*>([\s\S]*?)<\/[^>]+>/i);

  return {
    id: '',
    title,
    dividerId: guessDividerId([title], dividers, fallbackDividerId),
    summary,
    source: buildSourceLabel('', sourceUrl),
    imageUrl: extractMetaOgImage(html, sourceUrl),
    prepMinutes: parseDurationMinutes(prepMatch?.[1] || 0),
    cookMinutes: parseDurationMinutes(cookMatch?.[1] || 0),
    servings: parseServingsNumber(stripHtmlTags(yieldMatch?.[1] || '')),
    tags: [],
    ingredients: ingredientMatches,
    steps: stepMatches,
    notes: sourceUrl ? `Imported from: ${sourceUrl}` : '',
    favorite: false,
    deleted: false,
  };
}

/**
 * Extracts a recipe draft from an HTML webpage using Schema.org JSON-LD, Microdata, or text fallback.
 */
export function parseHtmlRecipe(
  html,
  { sourceUrl = '', dividers = [], fallbackDividerId = 'weeknight' } = {}
) {
  const rawHtml = String(html || '');
  if (!rawHtml.trim()) {
    throw new Error('The webpage returned empty HTML.');
  }

  const ldBlocks = parseJsonLdBlocks(rawHtml);
  const ogImage = extractMetaOgImage(rawHtml, sourceUrl);
  for (const block of ldBlocks) {
    const recipeNode = findRecipeNode(block);
    if (recipeNode) {
      const parsed = recipeFromJsonLdNode(recipeNode, {
        sourceUrl,
        dividers,
        fallbackDividerId,
      });
      if (!parsed.imageUrl && ogImage) {
        parsed.imageUrl = ogImage;
      }
      if (parsed.ingredients.length > 0 || parsed.steps.length > 0) {
        return parsed;
      }
    }
  }

  const micro = parseMicrodataRecipe(rawHtml, {
    sourceUrl,
    dividers,
    fallbackDividerId,
  });
  if (micro && (micro.ingredients.length > 0 || micro.steps.length > 0)) {
    if (!micro.imageUrl && ogImage) {
      micro.imageUrl = ogImage;
    }
    return micro;
  }

  const bodyOnly = rawHtml
    .replace(/<(?:nav|footer|header|aside|form)\b[^>]*>[\s\S]*?<\/\w+>/gi, '\n')
    .replace(/<title\b[^>]*>([\s\S]*?)<\/title>/gi, (_, t) => `${stripHtmlTags(t)}\n`);
  const plain = stripHtmlTags(bodyOnly);
  const textParsed = parseTextRecipe(plain, {
    dividers,
    fallbackDividerId,
    skipHtmlCheck: true,
  });

  if (textParsed.ingredients.length === 0 && textParsed.steps.length === 0) {
    throw new Error(
      'Could not find a structured recipe on that page. Try copying the recipe text and using "Copy & Paste Text".'
    );
  }

  return {
    ...textParsed,
    source: textParsed.source || buildSourceLabel('', sourceUrl),
    notes: textParsed.notes || (sourceUrl ? `Imported from: ${sourceUrl}` : ''),
  };
}

const BOILERPLATE_LINE_RE =
  /^(?:jump to recipe|print recipe|pin recipe|save recipe|rate this recipe|share|tweet|email|advertisement|sponsored|skip to content|prep time|cook time|total time)$/i;

const INGREDIENT_UNIT_RE =
  /\b(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|cloves?|cans?|packages?|pkgs?|sticks?|pinch(?:es)?|dash(?:es)?|bunches?|sprigs?|slices?|large|medium|small)\b/i;

function isLikelyIngredientLine(line) {
  const clean = String(line || '').trim();
  if (!clean) return false;
  if (/^[-*•▪◦▢☐]\s+/.test(clean)) return true;
  const firstWord = clean.split(/\s+/)[0];
  if (parseQuantityToken(firstWord) !== null) return true;
  if (/^\d+(?:\/\d+)?\s*[-–]\s*\d+/.test(clean)) return true;
  if (clean.length <= 70 && INGREDIENT_UNIT_RE.test(clean) && !/[.!?]$/.test(clean)) return true;
  return false;
}

function isLikelyStepLine(line) {
  const clean = String(line || '').trim();
  if (!clean) return false;
  if (/^(?:step\s+\d+|\d+[.)])\s+/i.test(clean)) return true;
  const wordCount = clean.split(/\s+/).length;
  return wordCount >= 6 && (/[.!?]$/.test(clean) || !isLikelyIngredientLine(clean));
}

function cleanBullet(line) {
  return String(line || '')
    .trim()
    .replace(/^[-*+•▪◦▢☐✓☑]\s*(?:\[[ xX]?\]\s*)?/, '')
    .trim();
}

function cleanNumberedStep(line) {
  return String(line || '')
    .trim()
    .replace(/^(?:step\s+\d+\s*[:.)-]?\s*|\d+[.)]\s+|[-*+•]\s+)/i, '')
    .trim();
}

function titleFromFilename(filename) {
  const base = String(filename || '')
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!base) return '';
  return base.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

function parseTextMethodSubheading(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.length >= 60) return null;
  if (/^\d+[.)]\s+/.test(trimmed)) return null;

  const isMarkdownSub = /^#{3,6}\s+/.test(trimmed);
  const stripped = trimmed.replace(/^#{1,6}\s*/, '').replace(/[:*]+$/g, '').trim();
  const durMatch = stripped.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const baseName = (durMatch ? durMatch[1] : stripped)
    .replace(/\s+(?:instructions?|directions?|method|steps?|version)$/i, '')
    .trim();

  const detected = detectCookingMethodName(baseName);
  if (!detected && !isMarkdownSub) return null;

  const cleanName = detected && baseName.length <= 32 ? baseName : detected || baseName;
  const cookMinutes = durMatch && /\d/.test(durMatch[2]) ? parseDurationMinutes(durMatch[2]) : 0;
  return { name: cleanName, cookMinutes };
}

/**
 * Converts copied recipe text, Markdown, or HTML fragments into a normalized recipe draft.
 */
export function parseTextRecipe(
  rawText,
  { filename = '', dividers = [], fallbackDividerId = 'weeknight', skipHtmlCheck = false } = {}
) {
  const text = String(rawText || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (!text) {
    throw new Error('Recipe text is empty.');
  }

  if (!skipHtmlCheck && /<(?:!doctype|html|head|body|script\b[^>]*ld\+json|div\b[^>]*itemprop)/i.test(text)) {
    return parseHtmlRecipe(text, { dividers, fallbackDividerId });
  }

  if (/^---\n[\s\S]*?\n---(?:\n|$)/.test(text) || /^#{1,3}\s+(?:ingredients?|instructions?|directions?|method|steps?)\b/im.test(text)) {
    return parseMarkdownRecipe(text, { filename, dividers, fallbackDividerId });
  }

  const rawLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !BOILERPLATE_LINE_RE.test(l));

  let title = '';
  let summary = '';
  let source = '';
  let prepMinutes = 0;
  let cookMinutes = 0;
  let totalMinutes = 0;
  let servings = 4;
  let tags = [];

  const ingredients = [];
  const parsedMethods = [];
  let currentMethod = null;
  const notesLines = [];

  function ensureCurrentMethod() {
    if (!currentMethod) {
      currentMethod = {
        id: `method-${parsedMethods.length + 1}`,
        name: '',
        cookMinutes: 0,
        note: '',
        steps: [],
      };
      parsedMethods.push(currentMethod);
    }
    return currentMethod;
  }

  let section = 'header';
  let sawExplicitSection = false;
  const leftoverHeaderLines = [];

  for (const line of rawLines) {
    const cleanHeading = line.replace(/^#{1,6}\s*/, '').replace(/[:*]+$/g, '').trim().toLowerCase();
    if (/^(?:ingredients?|what you need|for the dish)\b/.test(cleanHeading) && line.length < 40) {
      section = 'ingredients';
      sawExplicitSection = true;
      continue;
    }
    if (/^(?:instructions?|directions?|method|preparation|steps?|how to make)\b/.test(cleanHeading) && line.length < 40) {
      section = 'steps';
      sawExplicitSection = true;
      continue;
    }
    if (/^(?:notes?|tips?|cook'?s(?:\s+margin)?\s+notes?|margin notes?|variations?)\b/.test(cleanHeading) && line.length < 40) {
      section = 'notes';
      sawExplicitSection = true;
      continue;
    }

    if (section === 'header') {
      const metaMatch = line.match(
        /^(title|recipe|prep(?:\s*time)?|cook(?:\s*time)?|total(?:\s*time)?|servings?|yield|serves|source|from|author|tags?|summary|description)\s*:\s*(.+)$/i
      );
      if (metaMatch) {
        const key = metaMatch[1].toLowerCase();
        const val = metaMatch[2].trim();
        if (key === 'title' || key === 'recipe') title = val;
        else if (key.startsWith('prep')) prepMinutes = parseDurationMinutes(val);
        else if (key.startsWith('cook')) cookMinutes = parseDurationMinutes(val);
        else if (key.startsWith('total')) totalMinutes = parseDurationMinutes(val);
        else if (key.startsWith('serv') || key === 'yield') servings = parseServingsNumber(val);
        else if (key === 'source' || key === 'from' || key === 'author') source = val;
        else if (key.startsWith('tag')) tags = parseTagsInput(val);
        else if (key === 'summary' || key === 'description') summary = val;
        continue;
      }

      if (!title && !isLikelyIngredientLine(line)) {
        title = line.replace(/^#+\s*/, '').trim();
        continue;
      }

      leftoverHeaderLines.push(line);
      continue;
    }

    if (section === 'ingredients') {
      const clean = cleanBullet(line);
      if (clean) ingredients.push(clean);
      continue;
    }

    if (section === 'steps') {
      const methodSub = parseTextMethodSubheading(line);
      if (methodSub) {
        currentMethod = {
          id: slugifyFilename(methodSub.name, `method-${parsedMethods.length + 1}`),
          name: methodSub.name,
          cookMinutes: methodSub.cookMinutes,
          note: '',
          steps: [],
        };
        parsedMethods.push(currentMethod);
        continue;
      }
      const clean = cleanNumberedStep(line);
      if (clean) ensureCurrentMethod().steps.push(clean);
      continue;
    }

    if (section === 'notes') {
      notesLines.push(line);
    }
  }

  // Heuristic split when user pasted a recipe without "Ingredients" / "Directions" headings
  if (!sawExplicitSection && leftoverHeaderLines.length > 0) {
    let seenSteps = false;
    for (const line of leftoverHeaderLines) {
      if (!seenSteps && isLikelyIngredientLine(line)) {
        ingredients.push(cleanBullet(line));
      } else if (isLikelyStepLine(line)) {
        seenSteps = true;
        ensureCurrentMethod().steps.push(cleanNumberedStep(line));
      } else if (!summary && !seenSteps && ingredients.length === 0) {
        summary = line;
      } else if (seenSteps) {
        ensureCurrentMethod().steps.push(cleanNumberedStep(line));
      } else {
        ingredients.push(cleanBullet(line));
      }
    }
  } else if (leftoverHeaderLines.length > 0 && !summary) {
    summary = leftoverHeaderLines[0];
  }

  if (prepMinutes === 0 && cookMinutes === 0 && totalMinutes > 0) {
    cookMinutes = totalMinutes;
  }

  const finalTitle = title || titleFromFilename(filename) || 'Imported Recipe';
  const dividerId = guessDividerId([finalTitle, summary, ...tags], dividers, fallbackDividerId);

  const methods =
    parsedMethods.length > 0
      ? parsedMethods
      : [
          {
            id: 'method-1',
            name: '',
            cookMinutes,
            note: '',
            steps: [],
          },
        ];

  if (methods.length === 1) {
    if (!methods[0].name) {
      methods[0].name = detectCookingMethodName([finalTitle, summary, ...tags, ...methods[0].steps]);
    }
    if (methods[0].cookMinutes === 0 && cookMinutes > 0) {
      methods[0].cookMinutes = cookMinutes;
    }
  }

  return {
    id: '',
    title: finalTitle,
    dividerId,
    summary,
    source,
    prepMinutes,
    cookMinutes: methods[0].cookMinutes || cookMinutes,
    servings,
    tags,
    ingredients,
    steps: methods[0].steps,
    methods,
    notes: notesLines.join('\n').trim(),
    favorite: false,
    deleted: false,
  };
}

/**
 * Unified dispatcher for dropped/selected recipe files (.md, .txt, .html, .json).
 * Returns `{ kind: 'snapshot', snapshot }` for full binder JSON backups, or `{ kind: 'recipe', recipe }`.
 */
export function parseImportedContent(
  text,
  { filename = '', dividers = [], fallbackDividerId = 'weeknight' } = {}
) {
  const lowerName = String(filename || '').toLowerCase();
  const trimmed = String(text || '').replace(/^\uFEFF/, '').trim();

  if (lowerName.endsWith('.json') || (!lowerName && (trimmed.startsWith('{') || trimmed.startsWith('[')))) {
    const parsed = JSON.parse(trimmed);
    if (parsed && Array.isArray(parsed.recipes)) {
      return { kind: 'snapshot', snapshot: parsed };
    }
    if (parsed && isRecipeNodeType(parsed['@type'])) {
      return {
        kind: 'recipe',
        recipe: recipeFromJsonLdNode(parsed, { dividers, fallbackDividerId }),
      };
    }
    if (parsed && typeof parsed === 'object' && (parsed.title || parsed.ingredients || parsed.steps)) {
      return {
        kind: 'recipe',
        recipe: {
          ...parsed,
          dividerId: parsed.dividerId || fallbackDividerId,
          deleted: false,
        },
      };
    }
    throw new Error('JSON file is neither a Recipe Binder backup nor a single recipe.');
  }

  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    return {
      kind: 'recipe',
      recipe: parseHtmlRecipe(trimmed, { dividers, fallbackDividerId }),
    };
  }

  if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
    return {
      kind: 'recipe',
      recipe: parseMarkdownRecipe(trimmed, { filename, dividers, fallbackDividerId }),
    };
  }

  return {
    kind: 'recipe',
    recipe: parseTextRecipe(trimmed, { filename, dividers, fallbackDividerId }),
  };
}
