import { normalizeTag, parseTagsInput } from './collection.js';
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
  const cook = Number(recipe?.cookMinutes || 0);
  const total = prep + cook;
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
  if (recipe?.summary) fmLines.push(`summary: ${yamlQuote(recipe.summary)}`);
  fmLines.push(`prepMinutes: ${Math.max(0, Math.round(prep))}`);
  fmLines.push(`cookMinutes: ${Math.max(0, Math.round(cook))}`);
  fmLines.push(`servings: ${Number.isInteger(scaledServingsNum) ? scaledServingsNum : Number(scaledServingsNum.toFixed(2))}`);
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

  const metaParts = [
    `**Prep:** ${formatDurationCompact(prep)}`,
    `**Cook:** ${formatDurationCompact(cook)}`,
    `**Total:** ${formatDurationCompact(total)}`,
    `**Servings:** ${scaledServingsLabel}${factor !== 1 ? ` (${factor}x)` : ''}`,
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

  body.push('', '## Instructions', '');
  const steps = Array.isArray(recipe?.steps) ? recipe.steps : [];
  if (steps.length > 0) {
    steps.forEach((step, idx) => {
      const clean = String(step || '').trim();
      if (clean) body.push(`${idx + 1}. ${clean}`);
    });
  } else {
    body.push('1. (none listed)');
  }

  if (recipe?.notes && String(recipe.notes).trim()) {
    body.push('', '## Notes', '', String(recipe.notes).trim());
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
  let bodyTags = [];

  const ingredients = [];
  const steps = [];
  const notesLines = [];

  let section = 'header';
  for (const rawLine of body.split('\n')) {
    const trimmed = rawLine.trim();

    const h1Match = trimmed.match(/^#\s+(.+)$/);
    if (h1Match && !bodyTitle && section === 'header') {
      bodyTitle = h1Match[1].trim();
      continue;
    }

    const headingMatch = trimmed.match(/^#{2,6}\s+(.+)$/);
    if (headingMatch) {
      const headingText = headingMatch[1].replace(/[:*]+$/g, '').trim().toLowerCase();
      if (/^(ingredients?|what you need|shopping list)\b/.test(headingText)) {
        section = 'ingredients';
        continue;
      }
      if (/^(instructions?|directions?|method|preparation|steps?|how to make)\b/.test(headingText)) {
        section = 'steps';
        continue;
      }
      if (/^(notes?|tips?|cook'?s(?:\s+margin)?\s+notes?|margin notes?|variations?)\b/.test(headingText)) {
        section = 'notes';
        continue;
      }
      if (section === 'ingredients' || section === 'steps') {
        const subheading = headingMatch[1].trim();
        if (section === 'ingredients') ingredients.push(`${subheading}:`);
        if (section === 'steps') steps.push(`${subheading}:`);
        continue;
      }
      if (section === 'notes' && trimmed) {
        notesLines.push(headingMatch[1].trim());
      }
      continue;
    }

    if (!trimmed) {
      if (section === 'notes' && notesLines.length > 0 && notesLines[notesLines.length - 1] !== '') {
        notesLines.push('');
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
            const num = parseFloat(v.replace(/[^\d.]/g, ''));
            if (Number.isFinite(num) && num > 0) bodyServings = num;
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
      const clean = cleanStepLine(trimmed);
      if (clean && clean !== '(none listed)') steps.push(clean);
      continue;
    }

    if (section === 'notes') {
      notesLines.push(trimmed);
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

  const rawServings = frontmatter.servings ?? frontmatter.yield ?? bodyServings;
  const parsedServings =
    typeof rawServings === 'number'
      ? rawServings
      : parseFloat(String(rawServings || '').match(/\d+(?:\.\d+)?/)?.[0] || '');
  const servings = Number.isFinite(parsedServings) && parsedServings > 0 ? parsedServings : 4;

  const fmTags = frontmatter.tags
    ? parseTagsInput(frontmatter.tags)
    : bodyTags;
  const normalizedTags = fmTags.map((t) => normalizeTag(t)).filter(Boolean);

  const notes = String(frontmatter.notes || notesLines.join('\n')).trim();

  const title =
    String(frontmatter.title || bodyTitle || titleFromFilename(filename) || 'Imported Recipe').trim();

  return {
    id: String(frontmatter.id || '').trim(),
    title,
    dividerId: resolveDividerId(frontmatter, dividers, fallbackDividerId),
    summary: String(frontmatter.summary || frontmatter.description || bodySummary || '').trim(),
    source: String(frontmatter.source || frontmatter.url || frontmatter.author || bodySource || '').trim(),
    prepMinutes,
    cookMinutes,
    servings,
    tags: normalizedTags,
    ingredients,
    steps,
    notes,
    favorite: Boolean(frontmatter.favorite),
    createdAt: String(frontmatter.createdAt || ''),
    updatedMs: Number(frontmatter.updatedMs || 0) || undefined,
    deleted: false,
  };
}
