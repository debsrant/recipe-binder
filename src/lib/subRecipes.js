/**
 * Determines whether a recipe represents a reusable mix or sub-recipe
 * (tagged `mix` or `sub-recipe`, or filed under a divider whose name/id mentions mix/sub-recipe).
 */
export function isMixRecipe(recipe, dividers = []) {
  if (!recipe || recipe.deleted) return false;
  const tags = Array.isArray(recipe.tags) ? recipe.tags : [];
  if (tags.some((t) => t === 'mix' || t === 'sub-recipe')) return true;

  const divId = String(recipe.dividerId || '').trim();
  if (divId && (/\bmix(?:es)?\b/i.test(divId) || /sub[-_]?recipe/i.test(divId))) {
    return true;
  }

  const divider = (dividers || []).find((d) => d && d.id === divId);
  if (
    divider?.name &&
    (/\bmix(?:es)?\b/i.test(divider.name) || /sub[-_\s]?recipe/i.test(divider.name))
  ) {
    return true;
  }
  return false;
}

/**
 * Returns active mix/sub-recipes eligible for ingredient cross-linking inside other recipes.
 */
export function getMixRecipes(recipes, excludeRecipeId = '', dividers = []) {
  const seen = new Set();
  return (recipes || []).filter((recipe) => {
    if (!isMixRecipe(recipe, dividers)) return false;
    if (excludeRecipeId && recipe.id === excludeRecipeId) return false;
    const cleanTitle = String(recipe.title || '').trim();
    if (cleanTitle.length < 3) return false;
    const key = cleanTitle.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildMixMatchers(mixRecipes) {
  const matchers = [];
  for (const recipe of mixRecipes || []) {
    const cleanTitle = String(recipe?.title || '').trim();
    if (cleanTitle.length < 3) continue;
    const escaped = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    matchers.push({
      recipeId: recipe.id,
      title: cleanTitle,
      re: new RegExp(`\\b${escaped}\\b`, 'gi'),
    });
  }
  matchers.sort((a, b) => b.title.length - a.title.length);
  return matchers;
}

/**
 * Finds non-overlapping mix/sub-recipe title matches inside an ingredient line (at most once per mix).
 */
export function findMatchingMixes(text, mixRecipes = []) {
  const source = String(text ?? '');
  if (!source.trim() || !Array.isArray(mixRecipes) || mixRecipes.length === 0) return [];

  const matchers = buildMixMatchers(mixRecipes);
  const chosenSpans = [];
  const seenRecipeIds = new Set();

  for (const matcher of matchers) {
    if (seenRecipeIds.has(matcher.recipeId)) continue;
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
          recipeId: matcher.recipeId,
          title: matcher.title,
        });
        seenRecipeIds.add(matcher.recipeId);
        break;
      }
    }
  }

  chosenSpans.sort((a, b) => a.start - b.start);
  return chosenSpans;
}

/**
 * Renders an ingredient line with escaped HTML and clickable mix/sub-recipe pop-up links.
 */
export function renderLinkedIngredientHtml(ingredientLine, escapeHtmlFn, mixRecipes = []) {
  const source = String(ingredientLine ?? '');
  const matches = findMatchingMixes(source, mixRecipes);
  if (matches.length === 0) {
    return escapeHtmlFn(source);
  }

  let html = '';
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      html += escapeHtmlFn(source.slice(cursor, match.start));
    }
    html += `<button type="button" class="subrecipe-link" data-action="open-mix-modal" data-recipe-id="${escapeHtmlFn(
      match.recipeId
    )}" title="Open mix / sub-recipe: ${escapeHtmlFn(match.title)}">${escapeHtmlFn(
      match.matchText
    )}</button>`;
    cursor = match.end;
  }
  if (cursor < source.length) {
    html += escapeHtmlFn(source.slice(cursor));
  }
  return html;
}
