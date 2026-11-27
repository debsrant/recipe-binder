import { getRecipeMethods, normalizeTag, parseTagsInput } from './collection.js';
import { formatQuantity, scaleIngredientLine } from './scaling.js';

function yamlQuote(value) {
  const clean = String(value ?? '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .trim();
  return `"${clean}"`;
}

function unquoteYaml(value) {
  const trimmed = String(value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const inner = trimmed.slice(1, -1);
    if (trimmed.startsWith('"')) {
      return inner
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\\\/g, '\\');
    }
    return inner.replace(/''/g, "'");
  }
  return trimmed;
}

function formatDurationCompact(minutes) {
  const num = Number(minutes || 0);
  if (!Number.isFinite(num) || num <= 0) return '0m';
  if (num < 60) return `${Math.round(num)}m`;
  const hrs = Math.floor(num / 60);
  const rem = Math.round(num % 60);
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function parseMinutesValue(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return 0;
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    return Math.max(0, Math.round(Number(text)));
  }

  let total = 0;
  let matched = false;
  const hrMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  if (hrMatch) {
    total += Number(hrMatch[1]) * 60;
    matched = true;
  }
  const minMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);
  if (minMatch) {
    total += Number(minMatch[1]);
    matched = true;
  }
  if (matched) return Math.max(0, Math.round(total));

  const fallback = text.match(/(\d+)/);
  return fallback ? Math.max(0, Number(fallback[1])) : 0;
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

/**
 * Generates a clean lowercase kebab-case slug suitable for filenames.
 */
export function slugifyFilename(title, fallback = 'recipe') {
  const slug = String(title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug || String(fallback || 'recipe').toLowerCase().replace(/[^a-z0-9-_]+/g, '-') || 'recipe';
}

/**
 * Returns a deterministic .md filename for a recipe card.
 */
export function recipeToFilename(recipe) {
  return `${slugifyFilename(recipe?.title, recipe?.id || 'recipe')}.md`;
}

/**
 * Serializes a recipe record into a clean Markdown document with YAML frontmatter.
 */
export function recipeToMarkdown(recipe, { dividerName = '', scaleFactor = 1 } = {}) {
  const factor = Number(scaleFactor) > 0 && Number.isFinite(Number(scaleFactor)) ? Number(scaleFactor) : 1;
  const prep = Number(recipe?.prepMinutes || 0);
  const methods = getRecipeMethods(recipe);
  const primaryCook = methods[0]?.cookMinutes ?? Number(recipe?.cookMinutes || 0);
  const total = prep + primaryCook;
  const baseServings = Number(recipe?.servings) > 0 ? Number(recipe.servings) : 4;
  const scaledServingsNum = baseServings * factor;
  const scaledServingsLabel = formatQuantity(scaledServingsNum) || String(baseServings);
  const tags = parseTagsInput(recipe?.tags || []);

  const fmLines = ['---'];
  if (recipe?.id) fmLines.push(`id: ${yamlQuote(recipe.id)}`);
  fmLines.push(`title: ${yamlQuote(recipe?.title || 'Untitled Recipe')}`);
  if (dividerName) fmLines.push(`divider: ${yamlQuote(dividerName)}`);
  if (recipe?.dividerId) fmLines.push(`dividerId: ${yamlQuote(recipe.dividerId)}`);
  if (recipe?.source) fmLines.push(`source: ${yamlQuote(recipe.source)}`);
  if (recipe?.imageUrl && /^https?:\/\//i.test(recipe.imageUrl)) {
    fmLines.push(`imageUrl: ${yamlQuote(recipe.imageUrl)}`);
  }
  if (recipe?.summary) fmLines.push(`summary: ${yamlQuote(recipe.summary)}`);
  fmLines.push(`prepMinutes: ${Math.max(0, Math.round(prep))}`);
  fmLines.push(`cookMinutes: ${Math.max(0, Math.round(primaryCook))}`);
  if (methods.length === 1 && methods[0].name) {
    fmLines.push(`method: ${yamlQuote(methods[0].name)}`);
  } else if (methods.length > 1) {
    fmLines.push(`methods: [${methods.map((m) => yamlQuote(m.name || 'Method')).join(', ')}]`);
  }
  fmLines.push(`servings: ${Number.isInteger(scaledServingsNum) ? scaledServingsNum : Number(scaledServingsNum.toFixed(2))}`);
  if (recipe?.servingSize) {
    fmLines.push(`servingSize: ${yamlQuote(recipe.servingSize)}`);
  }
  fmLines.push(`tags: [${tags.map((t) => yamlQuote(t)).join(', ')}]`);
  fmLines.push(`favorite: ${Boolean(recipe?.favorite)}`);
  if (recipe?.createdAt) fmLines.push(`createdAt: ${yamlQuote(recipe.createdAt)}`);
  if (recipe?.updatedMs) fmLines.push(`updatedMs: ${Number(recipe.updatedMs)}`);
  fmLines.push('---');

  const body = [];
  body.push(`# ${String(recipe?.title || 'Untitled Recipe').trim()}`);

  if (recipe?.summary) {
    body.push('', `*${String(recipe.summary).trim()}*`);
  }

  const servingSizeSuffix = recipe?.servingSize ? ` (${String(recipe.servingSize).trim()} each)` : '';
  const metaParts = [
    `**Prep:** ${formatDurationCompact(prep)}`,
    `**Cook:** ${formatDurationCompact(primaryCook)}`,
    `**Total:** ${formatDurationCompact(total)}`,
    `**Servings:** ${scaledServingsLabel}${servingSizeSuffix}${factor !== 1 ? ` [${factor}x]` : ''}`,
  ];
  body.push('', metaParts.join(' | '));
  if (recipe?.source) {
    body.push(`**Source:** ${String(recipe.source).trim()}`);
  }

  body.push('', '## Ingredients', '');
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  if (ingredients.length > 0) {
    for (const item of ingredients) {
      const line = factor === 1 ? String(item).trim() : scaleIngredientLine(String(item).trim(), factor);
      if (line) body.push(`- ${line}`);
    }
  } else {
    body.push('- (none listed)');
  }

  body.push('', '## Instructions');
  methods.forEach((method) => {
    body.push('');
    if (method.name) {
      const cookLabel = method.cookMinutes > 0 ? ` (${formatDurationCompact(method.cookMinutes)})` : '';
      body.push(`### ${method.name}${cookLabel}`, '');
    }
    if (method.note) {
      body.push(`> Note: ${method.note}`, '');
    }
    const methodSteps = Array.isArray(method.steps) ? method.steps : [];
    if (methodSteps.length > 0) {
      methodSteps.forEach((step, idx) => {
        const clean = String(step || '').trim();
        if (clean) body.push(`${idx + 1}. ${clean}`);
      });
    } else {
      body.push('1. (none listed)');
    }
  });

  if (recipe?.notes && String(recipe.notes).trim()) {
    body.push('', '## Notes', '', String(recipe.notes).trim());
  }

  if (recipe?.storageNotes && String(recipe.storageNotes).trim()) {
    body.push('', '## Storage & Freezer', '', String(recipe.storageNotes).trim());
  }

  if (recipe?.reheatNotes && String(recipe.reheatNotes).trim()) {
    body.push('', '## Reheating', '', String(recipe.reheatNotes).trim());
  }

  return `${fmLines.join('\n')}\n\n${body.join('\n')}\n`;
}

function parseFrontmatterBlock(yamlText) {
  const data = {};
  const lines = yamlText.split('\n');
  let activeListKey = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && activeListKey) {
      if (!Array.isArray(data[activeListKey])) data[activeListKey] = [];
      data[activeListKey].push(unquoteYaml(listMatch[1]));
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kvMatch) {
      activeListKey = null;
      continue;
    }

    const key = kvMatch[1].trim();
    const rawVal = kvMatch[2].trim();

    if (!rawVal) {
      activeListKey = key;
      data[key] = [];
      continue;
    }

    activeListKey = null;
    if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      const inner = rawVal.slice(1, -1).trim();
      data[key] = inner
        ? inner
            .split(',')
            .map((item) => unquoteYaml(item))
            .filter(Boolean)
        : [];
    } else if (/^(true|false)$/i.test(rawVal)) {
      data[key] = rawVal.toLowerCase() === 'true';
    } else if (/^-?\d+(?:\.\d+)?$/.test(rawVal)) {
      data[key] = Number(rawVal);
    } else {
      data[key] = unquoteYaml(rawVal);
    }
  }

  return data;
}

function cleanIngredientBullet(line) {
  return String(line || '')
    .trim()
    .replace(/^[-*+•▪◦▢☐✓☑]\s*(?:\[[ xX]?\]\s*)?/, '')
    .trim();
}

function cleanStepLine(line) {
  return String(line || '')
    .trim()
    .replace(/^(?:step\s+\d+\s*[:.)-]?\s*|\d+[.)]\s+|[-*+•]\s+)/i, '')
    .trim();
}

function resolveDividerId(frontmatter, dividers, fallbackDividerId) {
  const list = Array.isArray(dividers) ? dividers : [];
  const fmId = String(frontmatter.dividerId || frontmatter.divider_id || '').trim();
  if (fmId && list.some((d) => d.id === fmId)) {
    return fmId;
  }

  const fmName = String(
    frontmatter.divider || frontmatter.category || frontmatter.section || ''
  )
    .trim()
    .toLowerCase();
  if (fmName) {
    const byName = list.find(
      (d) => d.name.toLowerCase() === fmName || d.id.toLowerCase() === fmName
    );
    if (byName) return byName.id;
  }

  return fallbackDividerId || list[0]?.id || 'weeknight';
}

function parseMethodSubheading(rawHeading) {
  const cleaned = String(rawHeading || '').replace(/[:*]+$/g, '').trim();
  const durMatch = cleaned.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (durMatch) {
    const candidateDur = durMatch[2].trim();
    if (/\d/.test(candidateDur)) {
      return {
        name: durMatch[1].trim(),
        cookMinutes: parseMinutesValue(candidateDur),
      };
    }
  }
  return { name: cleaned, cookMinutes: 0 };
}

/**
 * Parses a Markdown recipe file (with or without YAML frontmatter) into a recipe draft object.
 */
export function parseMarkdownRecipe(
  rawText,
  { filename = '', dividers = [], fallbackDividerId = 'weeknight' } = {}
) {
  const normalized = String(rawText || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');

  let frontmatter = {};
  let body = normalized;

  const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (fmMatch) {
    frontmatter = parseFrontmatterBlock(fmMatch[1]);
    body = normalized.slice(fmMatch[0].length);
  }

  let bodyTitle = '';
  let bodySummary = '';
  let bodySource = '';
  let bodyPrep = 0;
  let bodyCook = 0;
  let bodyTotal = 0;
  let bodyServings = 0;
  let bodyServingSize = '';
  let bodyTags = [];

  const ingredients = [];
  const parsedMethods = [];
  let currentMethod = null;
  const notesLines = [];
  const storageLines = [];
  const reheatLines = [];

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
  for (const rawLine of body.split('\n')) {
    const trimmed = rawLine.trim();

    const h1Match = trimmed.match(/^#\s+(.+)$/);
    if (h1Match && !bodyTitle && section === 'header') {
      bodyTitle = h1Match[1].trim();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{2,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawHeading = headingMatch[2].trim();
      const headingText = rawHeading.replace(/[:*]+$/g, '').trim().toLowerCase();

      if (level === 2 || section === 'header') {
        if (/^(ingredients?|what you need|shopping list)\b/.test(headingText)) {
          section = 'ingredients';
          continue;
        }
        if (/^(instructions?|directions?|method|preparation|steps?|how to make)\b/.test(headingText)) {
          section = 'steps';
          continue;
        }
        if (/^(storage|freezer|storage\s*&\s*freezer|make ahead)\b/.test(headingText)) {
          section = 'storage';
          continue;
        }
        if (/^(reheating?|microwave|reheating?\s*&\s*microwave)\b/.test(headingText)) {
          section = 'reheat';
          continue;
        }
        if (/^(notes?|tips?|cook'?s(?:\s+margin)?\s+notes?|margin notes?|variations?)\b/.test(headingText)) {
          section = 'notes';
          continue;
        }
      }

      if (section === 'ingredients') {
        ingredients.push(`${rawHeading}:`);
        continue;
      }
      if (section === 'steps') {
        const parsedSub = parseMethodSubheading(rawHeading);
        currentMethod = {
          id: slugifyFilename(parsedSub.name, `method-${parsedMethods.length + 1}`),
          name: parsedSub.name,
          cookMinutes: parsedSub.cookMinutes,
          note: '',
          steps: [],
        };
        parsedMethods.push(currentMethod);
        continue;
      }
      if (section === 'notes' && trimmed) {
        notesLines.push(rawHeading);
      } else if (section === 'storage' && trimmed) {
        storageLines.push(rawHeading);
      } else if (section === 'reheat' && trimmed) {
        reheatLines.push(rawHeading);
      }
      continue;
    }

    if (!trimmed) {
      if (section === 'notes' && notesLines.length > 0 && notesLines[notesLines.length - 1] !== '') {
        notesLines.push('');
      } else if (section === 'storage' && storageLines.length > 0 && storageLines[storageLines.length - 1] !== '') {
        storageLines.push('');
      } else if (section === 'reheat' && reheatLines.length > 0 && reheatLines[reheatLines.length - 1] !== '') {
        reheatLines.push('');
      }
      continue;
    }

    if (section === 'header') {
      const plainMeta = trimmed.replace(/\*\*/g, '');
      const hasInlinePipeMeta = /\b(prep|cook|total|servings?|yield)\s*:/i.test(plainMeta);
      if (hasInlinePipeMeta) {
        for (const chunk of plainMeta.split('|')) {
          const m = chunk.trim().match(/^([A-Za-z ]+?)\s*:\s*(.+)$/);
          if (!m) continue;
          const k = m[1].trim().toLowerCase();
          const v = m[2].trim();
          if (k.startsWith('prep')) bodyPrep = parseMinutesValue(v);
          else if (k.startsWith('cook')) bodyCook = parseMinutesValue(v);
          else if (k.startsWith('total')) bodyTotal = parseMinutesValue(v);
          else if (k.startsWith('serv') || k.startsWith('yield')) {
            const num = parseFloat(v.match(/^\d+(?:\.\d+)?/)?.[0] || '');
            if (Number.isFinite(num) && num > 0) bodyServings = num;
            const parenMatch = v.match(/\(([^)]+)\)/);
            if (parenMatch && !/^\d+(?:\.\d+)?x$/i.test(parenMatch[1].trim())) {
              bodyServingSize = parenMatch[1].replace(/\s+each$/i, '').trim();
            }
          } else if (k === 'source' || k === 'from') {
            bodySource = v;
          } else if (k === 'tags') {
            bodyTags = parseTagsInput(v);
          }
        }
        continue;
      }

      const sourceMatch = plainMeta.match(/^(?:source|from|author)\s*:\s*(.+)$/i);
      if (sourceMatch) {
        bodySource = sourceMatch[1].trim();
        continue;
      }

      const tagsMatch = plainMeta.match(/^tags?\s*:\s*(.+)$/i);
      if (tagsMatch) {
        bodyTags = parseTagsInput(tagsMatch[1]);
        continue;
      }

      if (!bodySummary && !/^[-*_]{3,}$/.test(trimmed)) {
        bodySummary = trimmed.replace(/^\*(.+)\*$/, '$1').replace(/^_(.+)_$/, '$1').trim();
      }
      continue;
    }

    if (section === 'ingredients') {
      const clean = cleanIngredientBullet(trimmed);
      if (clean && clean !== '(none listed)') ingredients.push(clean);
      continue;
    }

    if (section === 'steps') {
      const quoteMatch = trimmed.match(/^>\s*(.+)$/);
      if (quoteMatch) {
        const noteText = quoteMatch[1].replace(/^(?:note|method\s*note)\s*:\s*/i, '').trim();
        if (noteText) {
          const targetMethod = ensureCurrentMethod();
          targetMethod.note = targetMethod.note ? `${targetMethod.note} ${noteText}` : noteText;
        }
        continue;
      }
      const clean = cleanStepLine(trimmed);
      if (clean && clean !== '(none listed)') {
        ensureCurrentMethod().steps.push(clean);
      }
      continue;
    }

    if (section === 'notes') {
      notesLines.push(trimmed);
    } else if (section === 'storage') {
      storageLines.push(trimmed);
    } else if (section === 'reheat') {
      reheatLines.push(trimmed);
    }
  }

  const prepMinutes =
    frontmatter.prepMinutes !== undefined ||
    frontmatter.prep_minutes !== undefined ||
    frontmatter.prepTime !== undefined ||
    frontmatter.prep !== undefined
      ? parseMinutesValue(
          frontmatter.prepMinutes ?? frontmatter.prep_minutes ?? frontmatter.prepTime ?? frontmatter.prep
        )
      : bodyPrep;

  let cookMinutes =
    frontmatter.cookMinutes !== undefined ||
    frontmatter.cook_minutes !== undefined ||
    frontmatter.cookTime !== undefined ||
    frontmatter.cook !== undefined
      ? parseMinutesValue(
          frontmatter.cookMinutes ?? frontmatter.cook_minutes ?? frontmatter.cookTime ?? frontmatter.cook
        )
      : bodyCook;

  if (prepMinutes === 0 && cookMinutes === 0 && bodyTotal > 0) {
    cookMinutes = bodyTotal;
  }

  const methods =
    parsedMethods.length > 0
      ? parsedMethods
      : [
          {
            id: 'method-1',
            name: String(frontmatter.method || '').trim(),
            cookMinutes,
            note: '',
            steps: [],
          },
        ];

  if (methods.length === 1) {
    if (!methods[0].name && frontmatter.method) {
      methods[0].name = String(frontmatter.method).trim();
    }
    if (methods[0].cookMinutes === 0 && cookMinutes > 0) {
      methods[0].cookMinutes = cookMinutes;
    }
  }

  const rawServings = frontmatter.servings ?? frontmatter.yield ?? bodyServings;
  const parsedServings =
    typeof rawServings === 'number'
      ? rawServings
      : parseFloat(String(rawServings || '').match(/\d+(?:\.\d+)?/)?.[0] || '');
  const servings = Number.isFinite(parsedServings) && parsedServings > 0 ? parsedServings : 4;

  const rawServingSize =
    frontmatter.servingSize ??
    frontmatter.serving_size ??
    frontmatter.portionSize ??
    bodyServingSize;
  const servingSize = String(rawServingSize || '').trim();

  const fmTags = frontmatter.tags ? parseTagsInput(frontmatter.tags) : bodyTags;
  const normalizedTags = fmTags.map((t) => normalizeTag(t)).filter(Boolean);
  const notes = String(frontmatter.notes || notesLines.join('\n')).trim();
  const storageNotes = String(frontmatter.storageNotes || storageLines.join('\n')).trim();
  const reheatNotes = String(frontmatter.reheatNotes || reheatLines.join('\n')).trim();
  const title =
    String(frontmatter.title || bodyTitle || titleFromFilename(filename) || 'Imported Recipe').trim();

  return {
    id: String(frontmatter.id || '').trim(),
    title,
    dividerId: resolveDividerId(frontmatter, dividers, fallbackDividerId),
    summary: String(frontmatter.summary || frontmatter.description || bodySummary || '').trim(),
    source: String(frontmatter.source || frontmatter.url || frontmatter.author || bodySource || '').trim(),
    imageUrl: String(frontmatter.imageUrl || frontmatter.image || '').trim(),
    prepMinutes,
    cookMinutes: methods[0].cookMinutes || cookMinutes,
    servings,
    servingSize,
    tags: normalizedTags,
    ingredients,
    steps: methods[0].steps,
    methods,
    notes,
    storageNotes,
    reheatNotes,
    favorite: Boolean(frontmatter.favorite),
    createdAt: String(frontmatter.createdAt || ''),
    updatedMs: Number(frontmatter.updatedMs || 0) || undefined,
    deleted: false,
  };
}
