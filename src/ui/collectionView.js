import {
  collectMethods,
  collectTags,
  filterAndSortRecipes,
  getRecipeMethods,
  normalizeSafeImageUrl,
} from '../lib/collection.js';
import { escapeHtml, formatMinutes } from './helpers.js';

function asIdSet(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

function formatRangeMinutes(minVal, maxVal) {
  if (minVal === maxVal) return formatMinutes(minVal);
  return `${formatMinutes(minVal)}–${formatMinutes(maxVal)}`;
}

export function renderCollectionView({
  recipes,
  dividers,
  activeDividerId,
  favoritesOnly,
  activeMethod = '',
  activeTag,
  searchQuery,
  sortBy = 'title',
  isDragOver = false,
  pinnedCards,
  collapsedCards,
  pinnedOnly = false,
}) {
  const activeRecipes = (recipes || []).filter((r) => r && !r.deleted);
  const dividerMap = new Map((dividers || []).map((d) => [d.id, d.name]));
  const pinnedSet = asIdSet(pinnedCards);
  const collapsedSet = asIdSet(collapsedCards);

  const countByDivider = new Map();
  let favCount = 0;
  for (const r of activeRecipes) {
    if (r.favorite) favCount += 1;
    countByDivider.set(r.dividerId, (countByDivider.get(r.dividerId) || 0) + 1);
  }

  const visibleRecipes = filterAndSortRecipes(activeRecipes, {
    dividerId: activeDividerId,
    favoritesOnly,
    method: activeMethod,
    tag: activeTag,
    query: searchQuery,
    sortBy,
    pinnedSet,
    pinnedOnly,
  });

  const visibleIds = visibleRecipes.map((r) => r.id);
  const allCollapsed =
    visibleIds.length > 0 && visibleIds.every((id) => collapsedSet.has(id));

  const allMethods = collectMethods(activeRecipes);
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

  const activeMethodLower = String(activeMethod || '').trim().toLowerCase();
  const methodStripHtml =
    allMethods.length > 0
      ? `<div class="tag-filter-bar method-filter-bar" aria-label="Filter by cooking method">
          <span class="tag-filter-label">Methods:</span>
          <button type="button" class="tag-pill method-pill ${!activeMethodLower ? 'is-active' : ''}" data-action="select-method-filter" data-method="">
            All
          </button>
          ${allMethods
            .map(
              ({ method, count }) =>
                `<button type="button" class="tag-pill method-pill ${
                  activeMethodLower === method.toLowerCase() ? 'is-active' : ''
                }" data-action="select-method-filter" data-method="${escapeHtml(method)}">${escapeHtml(
                  method
                )} (${count})</button>`
            )
            .join('')}
        </div>`
      : '';

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
              const isPinned = pinnedSet.has(recipe.id);
              const isCollapsed = collapsedSet.has(recipe.id);
              const safeImage = normalizeSafeImageUrl(recipe.imageUrl);
              const prepMin = recipe.prepMinutes || 0;
              const methods = getRecipeMethods(recipe);
              const cookValues = methods.map((m) => m.cookMinutes || 0);
              const minCook = Math.min(...cookValues);
              const maxCook = Math.max(...cookValues);
              const cookLabel = formatRangeMinutes(minCook, maxCook);
              const totalLabel = formatRangeMinutes(prepMin + minCook, prepMin + maxCook);
              const methodNames = methods.map((m) => m.name).filter(Boolean);
              const methodBadgeHtml =
                methodNames.length > 0
                  ? `<span class="badge badge-method">${escapeHtml(methodNames.join(' · '))}</span>`
                  : '';

              const dividerName = dividerMap.get(recipe.dividerId) || 'Unfiled';
              const hasStorageOrReheat = Boolean(
                String(recipe.storageNotes || '').trim() || String(recipe.reheatNotes || '').trim()
              );
              const tagsHtml = (recipe.tags || [])
                .slice(0, 5)
                .map(
                  (tag) =>
                    `<button type="button" class="tag-chip" data-action="select-tag" data-tag="${escapeHtml(
                      tag
                    )}">#${escapeHtml(tag)}</button>`
                )
                .join('');

              return `
                <article class="panel-card ref-card recipe-card ${isPinned ? 'is-pinned' : ''} ${
                isCollapsed ? 'is-collapsed' : ''
              }">
                  <div class="ref-card-header">
                    <div class="ref-card-title-group">
                      <button
                        type="button"
                        class="ref-card-title-btn recipe-card-open-title"
                        data-action="open-recipe"
                        data-recipe-id="${escapeHtml(recipe.id)}"
                      >
                        <h3 class="recipe-card-title-text">${escapeHtml(recipe.title)}</h3>
                      </button>
                    </div>

                    <div class="ref-card-controls">
                      <button
                        type="button"
                        class="btn btn-sm btn-outline ref-pin-btn ${isPinned ? 'is-pinned' : ''}"
                        data-action="toggle-pin-recipe-card"
                        data-recipe-id="${escapeHtml(recipe.id)}"
                        aria-pressed="${isPinned ? 'true' : 'false'}"
                        title="${isPinned ? 'Unpin from top' : 'Pin to top'}"
                      >${isPinned ? 'Pinned' : 'Pin'}</button>
                      <button
                        type="button"
                        class="btn btn-sm ${recipe.favorite ? 'btn-fav-active' : 'btn-outline'}"
                        data-action="toggle-favorite"
                        data-recipe-id="${escapeHtml(recipe.id)}"
                        aria-pressed="${recipe.favorite ? 'true' : 'false'}"
                      >${recipe.favorite ? 'Favorited' : 'Favorite'}</button>
                      <button
                        type="button"
                        class="btn btn-sm btn-outline ref-collapse-btn"
                        data-action="toggle-collapse-recipe-card"
                        data-recipe-id="${escapeHtml(recipe.id)}"
                        aria-expanded="${isCollapsed ? 'false' : 'true'}"
                      >${isCollapsed ? 'Expand ▾' : 'Collapse ▴'}</button>
                    </div>
                  </div>

                  <div class="ref-card-body">
                    <div class="recipe-horiz-body ${safeImage ? 'has-thumb' : ''}">
                      ${
                        safeImage
                          ? `<button
                              type="button"
                              class="recipe-thumb-btn"
                              data-action="open-recipe"
                              data-recipe-id="${escapeHtml(recipe.id)}"
                              title="Open ${escapeHtml(recipe.title)}"
                            >
                              <img
                                class="recipe-card-thumb"
                                src="${escapeHtml(safeImage)}"
                                alt="${escapeHtml(recipe.title)}"
                                loading="lazy"
                              />
                            </button>`
                          : ''
                      }
                      <div class="recipe-horiz-main">
                        <div class="card-badges-group">
                          <span class="badge badge-divider">${escapeHtml(dividerName)}</span>
                          ${methodBadgeHtml}
                          ${
                            hasStorageOrReheat
                              ? '<span class="badge">Storage / Reheat</span>'
                              : ''
                          }
                        </div>
                        ${
                          recipe.summary
                            ? `<p class="recipe-card-summary">${escapeHtml(recipe.summary)}</p>`
                            : '<p class="recipe-card-summary muted">No summary added yet.</p>'
                        }
                        ${
                          recipe.source
                            ? `<p class="recipe-card-source">Source: ${escapeHtml(recipe.source)}</p>`
                            : ''
                        }
                        ${tagsHtml ? `<div class="recipe-card-tags">${tagsHtml}</div>` : ''}
                      </div>

                      <div class="recipe-horiz-side">
                        <dl class="recipe-meta-row recipe-horiz-meta">
                          <div>
                            <dt>Prep</dt>
                            <dd>${escapeHtml(formatMinutes(prepMin))}</dd>
                          </div>
                          <div>
                            <dt>Cook</dt>
                            <dd>${escapeHtml(cookLabel)}</dd>
                          </div>
                          <div>
                            <dt>Total</dt>
                            <dd>${escapeHtml(totalLabel)}</dd>
                          </div>
                          <div>
                            <dt>Serves</dt>
                            <dd>${escapeHtml(String(recipe.servings || 4))}${
                              recipe.servingSize
                                ? ` <span class="meta-serving-size">(${escapeHtml(recipe.servingSize)})</span>`
                                : ''
                            }</dd>
                          </div>
                        </dl>
                        <button type="button" class="btn btn-primary btn-sm" data-action="open-recipe" data-recipe-id="${escapeHtml(
                          recipe.id
                        )}">Open Recipe →</button>
                      </div>
                    </div>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>`
      : `<div class="panel-card empty-state">
          <h2>No matching recipe cards</h2>
          <p class="muted">
            ${
              searchQuery || activeTag || activeMethod || favoritesOnly || pinnedOnly || activeDividerId !== 'all'
                ? 'Clear your active search, method, tag, pinned, or divider filter, or add a new recipe card to this section.'
                : 'Your binder is empty. Create your first recipe card to begin.'
            }
          </p>
          <div class="btn-row">
            ${
              searchQuery || activeTag || activeMethod || favoritesOnly || pinnedOnly || activeDividerId !== 'all'
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
              placeholder="Filter by title, ingredient, storage, or note..."
              data-action="search-input"
            />
          </div>
          <div class="toolbar-controls">
            <button
              type="button"
              class="btn btn-sm ${pinnedOnly ? 'btn-primary' : 'btn-outline'}"
              data-action="toggle-recipe-pinned-only"
              aria-pressed="${pinnedOnly ? 'true' : 'false'}"
            >${pinnedOnly ? 'Pinned Only: On' : 'Pinned Only'}</button>
            ${
              visibleIds.length > 0
                ? `<button
                    type="button"
                    class="btn btn-sm btn-outline"
                    data-action="toggle-collapse-all-recipes"
                    data-card-ids="${escapeHtml(visibleIds.join(','))}"
                  >${allCollapsed ? 'Expand All' : 'Collapse All'}</button>`
                : ''
            }
            <label for="recipe-sort-select" class="toolbar-label">Sort:</label>
            <select id="recipe-sort-select" data-action="sort-change">
              <option value="title" ${sortBy === 'title' ? 'selected' : ''}>Title (A–Z)</option>
              <option value="updated" ${sortBy === 'updated' ? 'selected' : ''}>Recently Updated</option>
              <option value="time" ${sortBy === 'time' ? 'selected' : ''}>Total Time</option>
              <option value="favorite" ${sortBy === 'favorite' ? 'selected' : ''}>Favorites First</option>
            </select>
            <button type="button" class="btn btn-outline" data-action="nav-view" data-view="import">+ Import</button>
            <button type="button" class="btn btn-primary" data-action="new-recipe">+ New Recipe</button>
          </div>
        </div>
        ${methodStripHtml}
        ${tagStripHtml}
      </div>

      ${cardsHtml}
    </section>
  `;
}
