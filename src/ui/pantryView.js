import { getRecipeMethods } from '../lib/collection.js';
import {
  PANTRY_CATEGORIES,
  PANTRY_ITEM_TYPES,
  PANTRY_LOCATIONS,
  PANTRY_STATUSES,
  collectBinderIngredients,
  getInventoryFreshness,
  matchRecipesByIngredients,
  normalizeIngredientKey,
  normalizePantryData,
} from '../lib/pantry.js';
import { escapeHtml, formatMinutes } from './helpers.js';

const PANTRY_SUB_TABS = [
  { id: 'inventory', label: 'Kitchen Inventory' },
  { id: 'matcher', label: 'What Can I Make?' },
];

const PANTRY_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'use-soon', label: 'Use Soon / Expired' },
  { id: 'restock', label: 'Low / Restock' },
  { id: 'in-stock', label: 'In Stock' },
  { id: 'staples', label: 'Always Stocked' },
];

const PANTRY_TYPE_FILTERS = [
  { id: 'all', label: 'All Types' },
  { id: 'ingredient', label: 'Ingredients & Bulk' },
  { id: 'cooked-meal', label: 'Cooked Meals' },
  { id: 'mix-canned', label: 'Mixes & Canned' },
];

const MATCHER_FILTERS = [
  { id: 'all', label: 'All Matches' },
  { id: 'ready', label: 'Can Make Now (100%)' },
  { id: 'almost', label: 'Missing <= 2' },
];

function getLabel(list, id, fallback = '') {
  return list.find((entry) => entry.id === id)?.label || fallback;
}

function renderSubTabs(activeTab) {
  return `
    <div class="subtab-bar no-print" role="tablist" aria-label="Pantry sections">
      ${PANTRY_SUB_TABS.map(
        (tab) => `
          <button
            type="button"
            class="subtab-btn ${activeTab === tab.id ? 'is-active' : ''}"
            data-action="set-pantry-tab"
            data-tab="${tab.id}"
          >${escapeHtml(tab.label)}</button>
        `
      ).join('')}
    </div>
  `;
}

function renderInventoryTab({
  items,
  recipes,
  pantryCategory,
  pantryStatusFilter,
  pantryTypeFilter = 'all',
  pantryLocationFilter = 'all',
  pantryQuery,
  editingPantryId,
}) {
  const activeItems = [...(items || [])]
    .filter((i) => !i.deleted)
    .sort((a, b) => (b.updatedMs || 0) - (a.updatedMs || 0) || a.name.localeCompare(b.name));

  const withFreshness = activeItems.map((item) => ({
    item,
    freshness: getInventoryFreshness(item),
  }));

  const urgentCount = withFreshness.filter(
    ({ freshness }) => freshness.status === 'use-soon' || freshness.status === 'expired'
  ).length;
  const restockCount = activeItems.filter((i) => i.status === 'low' || i.status === 'out').length;
  const cookedCount = activeItems.filter((i) => i.itemType === 'cooked-meal').length;

  const cleanQuery = String(pantryQuery || '').trim().toLowerCase();
  const filteredEntries = withFreshness.filter(({ item, freshness }) => {
    if (pantryCategory && pantryCategory !== 'all' && item.category !== pantryCategory) {
      return false;
    }
    if (pantryTypeFilter && pantryTypeFilter !== 'all' && item.itemType !== pantryTypeFilter) {
      return false;
    }
    if (
      pantryLocationFilter &&
      pantryLocationFilter !== 'all' &&
      item.location !== pantryLocationFilter
    ) {
      return false;
    }
    if (pantryStatusFilter === 'staples' && !item.alwaysStocked) return false;
    if (
      pantryStatusFilter === 'use-soon' &&
      freshness.status !== 'use-soon' &&
      freshness.status !== 'expired'
    ) {
      return false;
    }
    if (pantryStatusFilter === 'restock' && item.status !== 'low' && item.status !== 'out') {
      return false;
    }
    if (pantryStatusFilter === 'in-stock' && item.status !== 'in-stock') {
      return false;
    }
    if (cleanQuery) {
      const hay = `${item.name} ${item.quantity} ${item.reheatNotes} ${item.notes} ${getLabel(
        PANTRY_CATEGORIES,
        item.category
      )} ${getLabel(PANTRY_LOCATIONS, item.location)} ${getLabel(
        PANTRY_ITEM_TYPES,
        item.itemType
      )}`.toLowerCase();
      if (!hay.includes(cleanQuery)) return false;
    }
    return true;
  });

  if (pantryStatusFilter === 'use-soon') {
    filteredEntries.sort(
      (a, b) => (a.freshness.daysRemaining ?? 9999) - (b.freshness.daysRemaining ?? 9999)
    );
  }

  const editingItem = editingPantryId
    ? activeItems.find((i) => i.id === editingPantryId) || null
    : null;

  const trackedKeys = new Set(activeItems.map((i) => normalizeIngredientKey(i.name)).filter(Boolean));
  const quickAddSuggestions = collectBinderIngredients(recipes)
    .filter((entry) => entry.key && !trackedKeys.has(entry.key))
    .slice(0, 24);

  const cardsHtml =
    filteredEntries.length > 0
      ? filteredEntries
          .map(({ item, freshness }) => {
            const statusLabel = getLabel(PANTRY_STATUSES, item.status, 'In Stock');
            const categoryLabel = getLabel(PANTRY_CATEGORIES, item.category, 'Other');
            const locationLabel = getLabel(PANTRY_LOCATIONS, item.location, 'Pantry');
            const typeLabel =
              item.itemType === 'cooked-meal'
                ? 'Cooked Meal'
                : item.itemType === 'mix-canned'
                ? 'Mix / Canned'
                : 'Ingredient';
            const freshClass =
              freshness.status === 'expired' || freshness.status === 'use-soon'
                ? ` is-${freshness.status}`
                : '';
            return `
              <article class="pantry-card is-${escapeHtml(item.status)}${freshClass}${
                editingPantryId === item.id ? ' is-editing' : ''
              }">
                <div class="pantry-card-top">
                  <div>
                    <div class="pantry-badges-row">
                      <span class="item-type-badge is-${escapeHtml(item.itemType)}">${escapeHtml(
                        typeLabel
                      )}</span>
                      <span class="storage-badge is-${escapeHtml(item.location)}">${escapeHtml(
                        locationLabel
                      )}</span>
                      ${
                        freshness.status !== 'none'
                          ? `<span class="freshness-badge is-${escapeHtml(freshness.status)}">${escapeHtml(
                              freshness.label
                            )}</span>`
                          : ''
                      }
                      ${
                        item.itemType !== 'cooked-meal'
                          ? `<span class="pantry-cat-badge">${escapeHtml(categoryLabel)}</span>`
                          : ''
                      }
                      ${
                        item.quantity
                          ? `<span class="pantry-qty-badge">${escapeHtml(item.quantity)}</span>`
                          : ''
                      }
                    </div>
                    <h3>${escapeHtml(item.name)}</h3>
                  </div>
                  <div class="pantry-quick-controls no-print">
                    <div class="portion-stepper" aria-label="Adjust stored count or portions">
                      <button
                        type="button"
                        class="btn btn-sm btn-outline"
                        data-action="adjust-pantry-portions"
                        data-item-id="${escapeHtml(item.id)}"
                        data-delta="-1"
                        ${item.portions === 0 || item.status === 'out' ? 'disabled' : ''}
                        title="Use 1 portion or pack (auto-flags Low / Out)"
                      >-1</button>
                      <span class="portion-count" title="Portions / packs left">${escapeHtml(
                        item.portions !== null && item.portions !== undefined ? String(item.portions) : '—'
                      )}</span>
                      <button
                        type="button"
                        class="btn btn-sm btn-outline"
                        data-action="adjust-pantry-portions"
                        data-item-id="${escapeHtml(item.id)}"
                        data-delta="1"
                        title="Add 1 portion or pack"
                      >+1</button>
                    </div>
                    <button
                      type="button"
                      class="pantry-status-btn is-${escapeHtml(item.status)}"
                      data-action="cycle-pantry-status"
                      data-item-id="${escapeHtml(item.id)}"
                      title="Click to cycle status (In Stock -> Running Low -> Out)"
                    >${escapeHtml(statusLabel)}</button>
                    <button
                      type="button"
                      class="btn btn-sm ${item.alwaysStocked ? 'btn-secondary' : 'btn-outline'}"
                      data-action="toggle-pantry-staple"
                      data-item-id="${escapeHtml(item.id)}"
                      aria-pressed="${item.alwaysStocked ? 'true' : 'false'}"
                    >${item.alwaysStocked ? '★ Staple' : '☆ Staple'}</button>
                  </div>
                </div>

                ${
                  item.storedDate || item.bestByDate
                    ? `<p class="pantry-dates-line">${
                        item.storedDate ? `Stored: ${escapeHtml(item.storedDate)}` : ''
                      }${item.storedDate && item.bestByDate ? ' · ' : ''}${
                        item.bestByDate ? `Best By: <strong>${escapeHtml(item.bestByDate)}</strong>` : ''
                      }</p>`
                    : ''
                }

                ${
                  item.reheatNotes
                    ? `<p class="freezer-reheat-note"><strong>Reheat:</strong> ${escapeHtml(
                        item.reheatNotes
                      )}</p>`
                    : ''
                }

                ${
                  item.notes
                    ? `<p class="pantry-item-notes">${escapeHtml(item.notes)}</p>`
                    : ''
                }

                <div class="card-footer-actions no-print">
                  ${
                    item.recipeId
                      ? `<button type="button" class="btn btn-sm btn-secondary" data-action="open-recipe" data-recipe-id="${escapeHtml(
                          item.recipeId
                        )}">Open Recipe</button>`
                      : ''
                  }
                  <button
                    type="button"
                    class="btn btn-sm btn-outline"
                    data-action="edit-pantry-item"
                    data-item-id="${escapeHtml(item.id)}"
                  >Edit</button>
                  <button
                    type="button"
                    class="btn btn-sm btn-danger-outline"
                    data-action="delete-pantry-item"
                    data-item-id="${escapeHtml(item.id)}"
                  >Remove</button>
                </div>
              </article>
            `;
          })
          .join('')
      : `<div class="empty-state-compact">
           <p>No inventory items match the current filter. Add an ingredient, bulk pack, or cooked batch on the right, or click <strong>Store Batch</strong> from any recipe card.</p>
         </div>`;

  const categoryFilterOptions = [
    '<option value="all">All Categories</option>',
    ...PANTRY_CATEGORIES.map(
      (c) =>
        `<option value="${escapeHtml(c.id)}" ${pantryCategory === c.id ? 'selected' : ''}>${escapeHtml(
          c.label
        )}</option>`
    ),
  ].join('');

  const locationFilterOptions = [
    '<option value="all">All Locations</option>',
    ...PANTRY_LOCATIONS.map(
      (l) =>
        `<option value="${escapeHtml(l.id)}" ${
          pantryLocationFilter === l.id ? 'selected' : ''
        }>${escapeHtml(l.label)}</option>`
    ),
  ].join('');

  const activeRecipes = (recipes || [])
    .filter((r) => !r.deleted)
    .sort((a, b) => a.title.localeCompare(b.title));

  const recipeSelectOptions = [
    '<option value="">-- Custom / Not linked to a recipe --</option>',
    ...activeRecipes.map(
      (r) =>
        `<option value="${escapeHtml(r.id)}" ${
          editingItem?.recipeId === r.id ? 'selected' : ''
        }>${escapeHtml(r.title)}${r.servingSize ? ` (${escapeHtml(r.servingSize)})` : ''}</option>`
    ),
  ].join('');

  return `
    <div class="pantry-kpi-strip">
      <div class="kpi-box">
        <span class="kpi-label">Tracked Items</span>
        <span class="kpi-value">${escapeHtml(String(activeItems.length))}</span>
      </div>
      <div class="kpi-box">
        <span class="kpi-label">Use Soon / Expired</span>
        <span class="kpi-value">${escapeHtml(String(urgentCount))}</span>
      </div>
      <div class="kpi-box">
        <span class="kpi-label">Low / Restock</span>
        <span class="kpi-value">${escapeHtml(String(restockCount))}</span>
      </div>
      <div class="kpi-box">
        <span class="kpi-label">Cooked Batches</span>
        <span class="kpi-value">${escapeHtml(String(cookedCount))}</span>
      </div>
    </div>

    <div class="pantry-split-grid">
      <section class="pantry-list-col">
        <div class="pantry-toolbar no-print">
          <div class="tag-filter-row pantry-type-filter-row">
            ${PANTRY_TYPE_FILTERS.map(
              (f) => `
                <button
                  type="button"
                  class="tag-chip ${pantryTypeFilter === f.id ? 'is-active' : ''}"
                  data-action="set-pantry-type-filter"
                  data-type="${f.id}"
                >${escapeHtml(f.label)}</button>
              `
            ).join('')}
          </div>
          <div class="tag-filter-row">
            ${PANTRY_STATUS_FILTERS.map(
              (f) => `
                <button
                  type="button"
                  class="tag-chip ${pantryStatusFilter === f.id ? 'is-active' : ''}"
                  data-action="set-pantry-status-filter"
                  data-filter="${f.id}"
                >${escapeHtml(f.label)}</button>
              `
            ).join('')}
          </div>
          <div class="pantry-search-controls">
            <select id="pantry-location-filter-select" class="inline-mini-select" aria-label="Filter by storage location">
              ${locationFilterOptions}
            </select>
            <select id="pantry-category-select" class="inline-mini-select" aria-label="Filter by inventory category">
              ${categoryFilterOptions}
            </select>
            <input
              id="pantry-search-input"
              type="search"
              class="search-input"
              value="${escapeHtml(pantryQuery || '')}"
              placeholder="Search items, portions, or reheat notes..."
            />
          </div>
        </div>

        <div class="pantry-grid">
          ${cardsHtml}
        </div>
      </section>

      <aside class="pantry-side-col no-print">
        <div class="panel-card">
          <h3>${editingItem ? 'Edit Inventory Item' : 'Add to Kitchen Inventory'}</h3>
          <form
            id="pantry-item-form"
            class="stacked-form"
            data-pantry-id="${escapeHtml(editingItem?.id || '')}"
          >
            <div class="form-field">
              <label for="pantry-item-type">Item Type</label>
              <select id="pantry-item-type" name="itemType">
                ${PANTRY_ITEM_TYPES.map(
                  (t) =>
                    `<option value="${escapeHtml(t.id)}" ${
                      (editingItem?.itemType || 'ingredient') === t.id ? 'selected' : ''
                    }>${escapeHtml(t.label)}</option>`
                ).join('')}
              </select>
            </div>

            <div class="form-field">
              <label for="pantry-recipe-select">Link Binder Recipe (optional — auto-fills details)</label>
              <select id="pantry-recipe-select" name="recipeId">
                ${recipeSelectOptions}
              </select>
            </div>

            <div class="form-field">
              <label for="pantry-name">Item / Dish Name</label>
              <input
                id="pantry-name"
                name="name"
                type="text"
                required
                value="${escapeHtml(editingItem?.name || '')}"
                placeholder="e.g., Chicken Thighs (Bulk), Lemon Garlic Chicken, Dill Pickles"
              />
            </div>

            <div class="form-two-col">
              <div class="form-field">
                <label for="pantry-location">Storage Location</label>
                <select id="pantry-location" name="location">
                  ${PANTRY_LOCATIONS.map(
                    (l) =>
                      `<option value="${escapeHtml(l.id)}" ${
                        (editingItem?.location || 'pantry') === l.id ? 'selected' : ''
                      }>${escapeHtml(l.label)}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="form-field">
                <label for="pantry-category">Category</label>
                <select id="pantry-category" name="category">
                  ${PANTRY_CATEGORIES.map(
                    (c) =>
                      `<option value="${escapeHtml(c.id)}" ${
                        (editingItem?.category || 'other') === c.id ? 'selected' : ''
                      }>${escapeHtml(c.label)}</option>`
                  ).join('')}
                </select>
              </div>
            </div>

            <div class="form-two-col">
              <div class="form-field">
                <label for="pantry-portions">Count / Portions (for -1/+1)</label>
                <input
                  id="pantry-portions"
                  name="portions"
                  type="number"
                  min="0"
                  step="any"
                  value="${escapeHtml(
                    editingItem?.portions !== null && editingItem?.portions !== undefined
                      ? String(editingItem.portions)
                      : ''
                  )}"
                  placeholder="e.g., 4"
                />
              </div>
              <div class="form-field">
                <label for="pantry-quantity">Unit / Pack Size</label>
                <input
                  id="pantry-quantity"
                  name="quantity"
                  type="text"
                  value="${escapeHtml(editingItem?.quantity || '')}"
                  placeholder="e.g., 1 lb pack, 2 thighs + sauce"
                />
              </div>
            </div>

            <div class="form-two-col">
              <div class="form-field">
                <label for="pantry-stored-date">Stored Date</label>
                <input
                  id="pantry-stored-date"
                  name="storedDate"
                  type="date"
                  value="${escapeHtml(editingItem?.storedDate || '')}"
                />
              </div>
              <div class="form-field">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                  <label for="pantry-bestby-date" style="margin: 0;">Best-By Date</label>
                  <button type="button" class="btn-link-inline" data-action="auto-pantry-bestby">Auto-Fill</button>
                </div>
                <input
                  id="pantry-bestby-date"
                  name="bestByDate"
                  type="date"
                  value="${escapeHtml(editingItem?.bestByDate || '')}"
                />
              </div>
            </div>

            <div class="form-field">
              <label for="pantry-status">Stock Status</label>
              <select id="pantry-status" name="status">
                ${PANTRY_STATUSES.map(
                  (s) =>
                    `<option value="${escapeHtml(s.id)}" ${
                      (editingItem?.status || 'in-stock') === s.id ? 'selected' : ''
                    }>${escapeHtml(s.label)}</option>`
                ).join('')}
              </select>
            </div>

            <label class="checkbox-inline">
              <input
                type="checkbox"
                name="alwaysStocked"
                ${editingItem?.alwaysStocked ? 'checked' : ''}
              />
              <span>Mark as "Always Stocked" staple (auto-included in recipe matcher)</span>
            </label>

            <div class="form-field">
              <label for="pantry-reheat-notes">Reheating &amp; Thawing Notes (optional)</label>
              <textarea
                id="pantry-reheat-notes"
                name="reheatNotes"
                rows="2"
                placeholder="e.g., Thaw overnight in fridge; microwave 90 sec covered or air fry 4 min..."
              >${escapeHtml(editingItem?.reheatNotes || '')}</textarea>
            </div>

            <div class="form-field">
              <label for="pantry-notes">Notes</label>
              <textarea
                id="pantry-notes"
                name="notes"
                rows="2"
                placeholder="Brand, bulk cost notes, or preferred store..."
              >${escapeHtml(editingItem?.notes || '')}</textarea>
            </div>

            <div class="form-actions-row">
              ${
                editingItem
                  ? '<button type="button" class="btn btn-outline" data-action="cancel-pantry-edit">Cancel</button>'
                  : ''
              }
              <button type="submit" class="btn btn-primary">${
                editingItem ? 'Save Changes' : 'Add to Inventory'
              }</button>
            </div>
          </form>
        </div>

        <div class="panel-card">
          <h3>Quick-Add from Your Recipes</h3>
          <p class="helper-copy">Tap any untracked binder ingredient below to add it to your inventory immediately.</p>
          <div class="quick-add-chip-list">
            ${
              quickAddSuggestions.length > 0
                ? quickAddSuggestions
                    .map(
                      (entry) => `
                        <button
                          type="button"
                          class="tag-chip"
                          data-action="quick-add-pantry-ingredient"
                          data-ingredient-name="${escapeHtml(entry.label)}"
                        >+ ${escapeHtml(entry.label)}</button>
                      `
                    )
                    .join('')
                : '<p class="helper-copy">All ingredients from your current recipes are already tracked in your inventory.</p>'
            }
          </div>
        </div>
      </aside>
    </div>
  `;
}

function renderMatcherTab({
  items,
  recipes,
  dividers,
  matcherSelectedNames,
  matcherIncludeStaples,
  matcherFilter,
  matcherSearch,
}) {
  const activeItems = (items || []).filter((i) => !i.deleted && i.status !== 'out');
  const selectedSet = matcherSelectedNames instanceof Set ? matcherSelectedNames : new Set();
  const selectedArray = Array.from(selectedSet);
  const selectedKeys = new Set(selectedArray.map((n) => normalizeIngredientKey(n)).filter(Boolean));

  const cleanQuery = String(matcherSearch || '').trim().toLowerCase();
  const pantryPickItems = activeItems.filter((item) => {
    if (cleanQuery && !item.name.toLowerCase().includes(cleanQuery)) return false;
    return true;
  });

  const pantryKeySet = new Set(activeItems.map((i) => normalizeIngredientKey(i.name)).filter(Boolean));
  const binderPickItems = collectBinderIngredients(recipes).filter((entry) => {
    if (pantryKeySet.has(entry.key)) return false;
    if (cleanQuery && !entry.label.toLowerCase().includes(cleanQuery)) return false;
    return true;
  });

  const customSelected = selectedArray.filter((name) => {
    const k = normalizeIngredientKey(name);
    if (!k) return false;
    const inPantry = activeItems.some((i) => normalizeIngredientKey(i.name) === k);
    const inBinder = collectBinderIngredients(recipes).some((b) => b.key === k);
    return !inPantry && !inBinder;
  });

  const matches = matchRecipesByIngredients(recipes, selectedArray, {
    includeAlwaysStocked: matcherIncludeStaples,
    pantryItems: items,
    mode: matcherFilter,
  });

  const dividerMap = new Map((dividers || []).map((d) => [d.id, d.name]));

  const resultsHtml =
    matches.length > 0
      ? matches
          .map((res) => {
            const { recipe } = res;
            const methods = getRecipeMethods(recipe);
            const totalMin = (Number(recipe.prepMinutes) || 0) + (Number(methods[0]?.cookMinutes ?? recipe.cookMinutes) || 0);
            const badgeClass = res.canMakeNow
              ? 'is-ready'
              : res.matchPercent >= 60
                ? 'is-close'
                : 'is-partial';
            const badgeLabel = res.canMakeNow
              ? '100% Can Make Now'
              : `${res.matchPercent}% Match (${res.matchedCount}/${res.totalIngredients})`;

            return `
              <article class="panel-card match-card">
                <div class="match-card-header">
                  <div>
                    <div class="match-badges-row">
                      <span class="match-score-badge ${badgeClass}">${escapeHtml(badgeLabel)}</span>
                      <span class="storage-badge">${escapeHtml(
                        dividerMap.get(recipe.dividerId) || 'Binder'
                      )}</span>
                    </div>
                    <h3>${escapeHtml(recipe.title)}</h3>
                    <p class="helper-copy">
                      ${escapeHtml(formatMinutes(totalMin))} total · Serves ${escapeHtml(
                        String(recipe.servings || 4)
                      )}${recipe.servingSize ? ` (${escapeHtml(recipe.servingSize)})` : ''}
                    </p>
                  </div>
                  <div class="match-actions no-print">
                    <button
                      type="button"
                      class="btn btn-sm btn-primary"
                      data-action="open-recipe"
                      data-recipe-id="${escapeHtml(recipe.id)}"
                    >Open Recipe</button>
                  </div>
                </div>

                <div class="match-ing-sections">
                  <div class="match-ing-block">
                    <span class="match-ing-heading">Have (${res.matchedCount})</span>
                    <div class="match-ing-pills">
                      ${res.matchedIngredients
                        .map((line) => `<span class="match-ing-pill is-have">✓ ${escapeHtml(line)}</span>`)
                        .join('')}
                    </div>
                  </div>
                  ${
                    res.missingCount > 0
                      ? `<div class="match-ing-block">
                           <span class="match-ing-heading">Missing (${res.missingCount})</span>
                           <div class="match-ing-pills">
                             ${res.missingIngredients
                               .map(
                                 (line) =>
                                   `<span class="match-ing-pill is-missing">${escapeHtml(line)}</span>`
                               )
                               .join('')}
                           </div>
                         </div>`
                      : ''
                  }
                </div>

                ${
                  res.missingCount > 0
                    ? `<div class="card-footer-actions no-print">
                         <button
                           type="button"
                           class="btn btn-sm btn-outline"
                           data-action="add-missing-to-pantry"
                           data-recipe-id="${escapeHtml(recipe.id)}"
                         >+ Add Missing to Restock List</button>
                       </div>`
                    : ''
                }
              </article>
            `;
          })
          .join('')
      : `<div class="panel-card empty-state-compact">
           <h3>No Matching Recipes Yet</h3>
           <p>Select ingredients on the left (or enable <strong>Always Stocked staples</strong> and pick an ingredient like chicken, flour, or cucumbers) to see what you can cook right now.</p>
         </div>`;

  return `
    <div class="matcher-layout">
      <aside class="panel-card matcher-picker-col no-print">
        <div class="section-header-row">
          <h3>Ingredients On Hand (${selectedKeys.size})</h3>
          <div class="matcher-preset-btns">
            <button type="button" class="btn btn-sm btn-secondary" data-action="matcher-use-pantry">Select In-Stock</button>
            <button type="button" class="btn btn-sm btn-outline" data-action="matcher-clear">Clear</button>
          </div>
        </div>

        <label class="checkbox-inline matcher-staple-toggle">
          <input
            type="checkbox"
            data-action="toggle-matcher-staples"
            ${matcherIncludeStaples ? 'checked' : ''}
          />
          <span>Auto-include "Always Stocked" pantry staples</span>
        </label>

        <input
          id="matcher-ingredient-search"
          type="search"
          class="search-input"
          value="${escapeHtml(matcherSearch || '')}"
          placeholder="Filter ingredient chips..."
        />

        <form id="matcher-custom-form" class="inline-add-form">
          <input
            name="customIngredient"
            type="text"
            placeholder="Add any ingredient on hand (e.g. cheddar)..."
          />
          <button type="submit" class="btn btn-sm btn-outline">+ Add</button>
        </form>

        ${
          customSelected.length > 0
            ? `<div class="matcher-group">
                 <h4>Custom Added</h4>
                 <div class="matcher-chip-grid">
                   ${customSelected
                     .map(
                       (name) => `
                         <button
                           type="button"
                           class="matcher-chip is-selected"
                           data-action="toggle-matcher-ingredient"
                           data-ingredient-name="${escapeHtml(name)}"
                         >✓ ${escapeHtml(name)}</button>
                       `
                     )
                     .join('')}
                 </div>
               </div>`
            : ''
        }

        <div class="matcher-group">
          <h4>From Your Pantry (${pantryPickItems.length})</h4>
          <div class="matcher-chip-grid">
            ${
              pantryPickItems.length > 0
                ? pantryPickItems
                    .map((item) => {
                      const isSel = selectedKeys.has(normalizeIngredientKey(item.name));
                      return `
                        <button
                          type="button"
                          class="matcher-chip ${isSel ? 'is-selected' : ''}"
                          data-action="toggle-matcher-ingredient"
                          data-ingredient-name="${escapeHtml(item.name)}"
                        >${isSel ? '✓ ' : ''}${escapeHtml(item.name)}${
                          item.alwaysStocked ? ' ★' : ''
                        }</button>
                      `;
                    })
                    .join('')
                : '<p class="helper-copy">No matching in-stock pantry items.</p>'
            }
          </div>
        </div>

        <div class="matcher-group">
          <h4>From Your Binder Recipes (${binderPickItems.length})</h4>
          <div class="matcher-chip-grid">
            ${
              binderPickItems.length > 0
                ? binderPickItems
                    .map((entry) => {
                      const isSel = selectedKeys.has(entry.key);
                      return `
                        <button
                          type="button"
                          class="matcher-chip ${isSel ? 'is-selected' : ''}"
                          data-action="toggle-matcher-ingredient"
                          data-ingredient-name="${escapeHtml(entry.label)}"
                        >${isSel ? '✓ ' : ''}${escapeHtml(entry.label)} <small>(${
                          entry.recipeCount
                        })</small></button>
                      `;
                    })
                    .join('')
                : '<p class="helper-copy">No extra binder ingredients match filter.</p>'
            }
          </div>
        </div>
      </aside>

      <section class="matcher-results-col">
        <div class="panel-card matcher-results-header">
          <div class="tag-filter-row">
            ${MATCHER_FILTERS.map(
              (f) => `
                <button
                  type="button"
                  class="tag-chip ${matcherFilter === f.id ? 'is-active' : ''}"
                  data-action="set-matcher-filter"
                  data-filter="${f.id}"
                >${escapeHtml(f.label)}</button>
              `
            ).join('')}
          </div>
          <span class="helper-copy">${matches.length} recipe match${
            matches.length === 1 ? '' : 'es'
          }</span>
        </div>

        <div class="matcher-results-list">
          ${resultsHtml}
        </div>
      </section>
    </div>
  `;
}

/**
 * Renders the Phase 6 Virtual Pantry & "What Can I Make?" Recipe Matcher view.
 */
export function renderPantryView({
  activeTab = 'inventory',
  pantryData,
  recipes = [],
  dividers = [],
  pantryCategory = 'all',
  pantryStatusFilter = 'all',
  pantryTypeFilter = 'all',
  pantryLocationFilter = 'all',
  pantryQuery = '',
  editingPantryId = null,
  matcherSelectedNames = new Set(),
  matcherIncludeStaples = true,
  matcherFilter = 'all',
  matcherSearch = '',
}) {
  const normalized = normalizePantryData(pantryData);
  const currentTab = PANTRY_SUB_TABS.some((t) => t.id === activeTab) ? activeTab : 'inventory';

  const bodyHtml =
    currentTab === 'matcher'
      ? renderMatcherTab({
          items: normalized.items,
          recipes,
          dividers,
          matcherSelectedNames,
          matcherIncludeStaples,
          matcherFilter,
          matcherSearch,
        })
      : renderInventoryTab({
          items: normalized.items,
          recipes,
          pantryCategory,
          pantryStatusFilter,
          pantryTypeFilter,
          pantryLocationFilter,
          pantryQuery,
          editingPantryId,
        });

  return `
    <section class="pantry-view">
      <div class="panel-card view-intro-card no-print">
        <div class="section-header-row">
          <div>
            <h2>Kitchen Inventory &amp; Recipe Matcher</h2>
            <p class="helper-copy">Track bulk packs, pantry staples, cooked freezer/fridge batches, and canned jars in one place with Best-By alerts and one-tap restock tracking.</p>
          </div>
          ${
            currentTab === 'inventory'
              ? '<button type="button" class="btn btn-primary" data-action="open-pantry-matcher">What Can I Make? &rarr;</button>'
              : ''
          }
        </div>
        ${renderSubTabs(currentTab)}
      </div>

      ${bodyHtml}
    </section>
  `;
}
