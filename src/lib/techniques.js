import { TECHNIQUE_CARDS } from '../data/referenceGuide.js';

/**
 * Looks up a single technique card by ID.
 */
export function getTechniqueById(id, techniques = TECHNIQUE_CARDS) {
  return (techniques || TECHNIQUE_CARDS).find((t) => t.id === id) || null;
}

function buildKeywordMatchers(techniques) {
  const matchers = [];
  for (const tech of techniques || []) {
    for (const kw of tech.keywords || []) {
      const clean = String(kw || '').trim();
      if (!clean) continue;
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      matchers.push({
        keyword: clean,
        techniqueId: tech.id,
        title: tech.title,
        re: new RegExp(`\\b${escaped}\\b`, 'gi'),
      });
    }
  }
  matchers.sort((a, b) => b.keyword.length - a.keyword.length);
  return matchers;
}

/**
 * Finds non-overlapping culinary technique keyword matches in a step string (at most once per technique).
 */
export function findMatchingTechniques(text, techniques = TECHNIQUE_CARDS) {
  const source = String(text ?? '');
  if (!source.trim()) return [];

  const matchers = buildKeywordMatchers(techniques);
  const chosenSpans = [];
  const seenTechniqueIds = new Set();

  for (const matcher of matchers) {
    if (seenTechniqueIds.has(matcher.techniqueId)) continue;
    matcher.re.lastIndex = 0;
    let m;
    while ((m = matcher.re.exec(source)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = chosenSpans.some((span) => start < span.end && end > span.start);
      if (!overlaps) {
        chosenSpans.push({
          start,
          end,
          matchText: m[0],
          techniqueId: matcher.techniqueId,
          title: matcher.title,
        });
        seenTechniqueIds.add(matcher.techniqueId);
        break;
      }
    }
  }

  chosenSpans.sort((a, b) => a.start - b.start);
  return chosenSpans;
}

/**
 * Renders a step string with escaped HTML and clickable technique guide links on matched keywords.
 */
export function renderLinkedStepHtml(stepText, escapeHtmlFn, techniques = TECHNIQUE_CARDS) {
  const source = String(stepText ?? '');
  const matches = findMatchingTechniques(source, techniques);
  if (matches.length === 0) {
    return escapeHtmlFn(source);
  }

  let html = '';
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      html += escapeHtmlFn(source.slice(cursor, match.start));
    }
    html += `<button type="button" class="technique-link" data-action="open-technique-modal" data-technique-id="${escapeHtmlFn(
      match.techniqueId
    )}" title="Technique guide: ${escapeHtmlFn(match.title)}">${escapeHtmlFn(
      match.matchText
    )}</button>`;
    cursor = match.end;
  }
  if (cursor < source.length) {
    html += escapeHtmlFn(source.slice(cursor));
  }
  return html;
}
