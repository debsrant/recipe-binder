import { collectTags, filterAndSortRecipes } from '../lib/collection.js';
import { escapeHtml, formatMinutes } from './helpers.js';

export function renderCollectionView({
  recipes,
  dividers,
  activeDividerId,
  favoritesOnly,
  activeTag,
  searchQuery,
  sortBy,
  isDragOver = false,
}) {
  const activeRecipes = (recipes || []).filter((r) => r && !r.deleted);
  const dividerMap = new Map((dividers || []).map((d) => [d.id, d.name]));

  const countByDivider = new Map();
  let favCount = 0;
  for (const r of activeRecipes) {
    if (r.favorite) favCount += 1;
    countByDivider.set(r.dividerId, (countByDivider.get(r.dividerId) || 0) + 1);
  }

  const visibleRecipes = filterAndSortRecipes(activeRecipes, {
    dividerId: activeDividerId,
    favoritesOnly,
    tag: activeTag,
    query: searchQuery,
    sortBy,
  });

  const allTags = collectTags(activeRecipes);

  const dividerTabsHtml = [
    `<button type="button" class="binder-tab ${
      activeDividerId === 'all' && !favoritesOnly ? 'is-active' : ''
    }" data-action="select-divider" data-divider-id="all">
      <span>All Recipes</span>
      <span class="tab-count">${activeRecipes.length}</span>
    </button>`,
    `<button type="button" class="binder-tab ${favoritesOnly ? 'is-active' : ''}" data-action="toggle-favorites-filter">
      <span>Favorites</span>
      <span class="tab-count">${favCount}</span>
    </button>`,
    ...(dividers || []).map((div) => {
      const isSelected = !favoritesOnly && activeDividerId === div.id;
      const count = countByDivider.get(div.id) || 0;
      return `<button type="button" class="binder-tab ${
        isSelected ? 'is-active' : ''
      }" data-action="select-divider" data-divider-id="${escapeHtml(div.id)}">
        <span>${escapeHtml(div.name)}</span>
        <span class="tab-count">${count}</span>
      </button>`;
    }),
  ].join('');

  const tagStripHtml =
    allTags.length > 0
      ? `<div class="tag-filter-bar" aria-label="Filter by tag">
          <span class="tag-filter-label">Tags:</span>
          <button type="button" class="tag-pill ${!activeTag ? 'is-active' : ''}" data-action="select-tag" data-tag="">
            All
          </button>
          ${allTags
            .map(
              ({ tag, count }) =>
                `<button type="button" class="tag-pill ${
                  activeTag === tag ? 'is-active' : ''
                }" data-action="select-tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)} (${count})</button>`
            )
            .join('')}
        </div>`
      : '';

  const cardsHtml =
    visibleRecipes.length > 0
      ? `<div class="recipe-grid">
          ${visibleRecipes
            .map((recipe) => {
              const totalMin = (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0);
              const dividerName = dividerMap.get(recipe.dividerId) || 'Unfiled';
              const tagsHtml = (recipe.tags || [])
                .slice(0, 4)
                .map(
                  (tag) =>
                    `<button type="button" class="tag-chip" data-action="select-tag" data-tag="${escapeHtml(
                      tag
                    )}">#${escapeHtml(tag)}</button>`
                )
                .join('');

              return `<article class="recipe-card">
                <div class="recipe-card-top">
                  <span class="badge badge-divider">${escapeHtml(dividerName)}</span>
                  <button
                    type="button"
                    class="btn btn-sm ${recipe.favorite ? 'btn-fav-active' : 'btn-outline'}"
                    data-action="toggle-favorite"
                    data-recipe-id="${escapeHtml(recipe.id)}"
                    aria-pressed="${recipe.favorite ? 'true' : 'false'}"
                  >${recipe.favorite ? 'Favorited' : 'Favorite'}</button>
                </div>

                <h2 class="recipe-card-title">
                  <button type="button" class="card-title-btn" data-action="open-recipe" data-recipe-id="${escapeHtml(
                    recipe.id
                  )}">${escapeHtml(recipe.title)}</button>
                </h2>

                ${
                  recipe.summary
                    ? `<p class="recipe-card-summary">${escapeHtml(recipe.summary)}</p>`
                    : '<p class="recipe-card-summary muted">No summary added yet.</p>'
                }

                <dl class="recipe-meta-row">
                  <div>
                    <dt>Prep</dt>
                    <dd>${escapeHtml(formatMinutes(recipe.prepMinutes))}</dd>
                  </div>
                  <div>
                    <dt>Cook</dt>
                    <dd>${escapeHtml(formatMinutes(recipe.cookMinutes))}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>${escapeHtml(formatMinutes(totalMin))}</dd>
                  </div>
                  <div>
                    <dt>Serves</dt>
                    <dd>${escapeHtml(String(recipe.servings || 4))}</dd>
                  </div>
                </dl>

                <div class="recipe-card-footer">
                  <div class="recipe-card-tags">${tagsHtml}</div>
                  <button type="button" class="btn btn-primary btn-sm" data-action="open-recipe" data-recipe-id="${escapeHtml(
                    recipe.id
                  )}">Open Card →</button>
                </div>
              </article>`;
            })
            .join('')}
        </div>`
      : `<div class="panel-card empty-state">
          <h2>No matching recipe cards</h2>
          <p class="muted">
            ${
              searchQuery || activeTag || favoritesOnly || activeDividerId !== 'all'
                ? 'Clear your active search or divider filter, or add a new recipe card to this section.'
                : 'Your binder is empty. Create your first recipe card to begin.'
            }
          </p>
          <div class="btn-row">
            ${
              searchQuery || activeTag || favoritesOnly || activeDividerId !== 'all'
                ? '<button type="button" class="btn btn-secondary" data-action="clear-filters">Clear Filters</button>'
                : ''
            }
            <button type="button" class="btn btn-outline" data-action="nav-view" data-view="import">+ Import</button>
            <button type="button" class="btn btn-primary" data-action="new-recipe">+ New Recipe</button>
          </div>
        </div>`;

  const dropBannerHtml = isDragOver
    ? `<div class="collection-drop-banner" role="status">
        Drop <code>.md</code>, <code>.txt</code>, or <code>.json</code> recipe files to import into your binder
      </div>`
    : '';

  return `
    <section class="collection-shell">
      ${dropBannerHtml}
      <div class="binder-tabs-bar" role="tablist" aria-label="Binder Dividers">
        ${dividerTabsHtml}
      </div>

      <div class="panel-card toolbar-card">
        <div class="collection-toolbar">
          <div class="toolbar-search">
            <label for="recipe-search-input" class="sr-only">Search recipes</label>
            <input
              id="recipe-search-input"
              type="search"
              value="${escapeHtml(searchQuery)}"
              placeholder="Filter by title, ingredient, source, or note..."
              data-action="search-input"
            />
          </div>
          <div class="toolbar-controls">
            <label for="recipe-sort-select" class="toolbar-label">Sort:</label>
            <select id="recipe-sort-select" data-action="sort-change">
              <option value="updated" ${sortBy === 'updated' ? 'selected' : ''}>Recently Updated</option>
              <option value="title" ${sortBy === 'title' ? 'selected' : ''}>Title (A–Z)</option>
              <option value="time" ${sortBy === 'time' ? 'selected' : ''}>Total Time</option>
              <option value="favorite" ${sortBy === 'favorite' ? 'selected' : ''}>Favorites First</option>
            </select>
            <button type="button" class="btn btn-outline" data-action="nav-view" data-view="import">+ Import</button>
            <button type="button" class="btn btn-primary" data-action="new-recipe">+ New Recipe</button>
          </div>
        </div>
        ${tagStripHtml}
      </div>

      ${cardsHtml}
    </section>
  `;
}
