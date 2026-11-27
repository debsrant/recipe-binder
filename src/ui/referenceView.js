import {
  FOOD_STORAGE_CATEGORIES,
  GRAIN_RATIOS,
  MEAT_TEMPERATURES,
  OIL_SMOKE_POINTS,
  SUBSTITUTION_CATEGORIES,
  TECHNIQUE_CARDS,
} from '../data/referenceGuide.js';
import { getDefaultReferenceData } from '../lib/reference.js';
import { getTechniqueById } from '../lib/techniques.js';
import {
  INGREDIENT_DENSITIES,
  OVEN_TEMP_PRESETS,
  TEMP_UNITS,
  VOLUME_UNITS,
  WEIGHT_UNITS,
  convertMeasurement,
  getQuickEquivalents,
} from '../lib/units.js';
import { escapeHtml } from './helpers.js';

const REF_TABS = [
  { id: 'converter', label: 'Unit Converter' },
  { id: 'substitutions', label: 'Substitutions' },
  { id: 'charts', label: 'Reference Charts' },
  { id: 'storage', label: 'Food Storage Times' },
  { id: 'techniques', label: 'Technique Cards' },
  { id: 'flavor', label: 'Herb & Spice Profiles' },
];

const DEFAULT_TECHNIQUE_CATEGORIES = ['Heat & Sauces', 'Baking & Dairy', 'Knife Skills', 'Prep'];

function getModeUnitOptions(mode) {
  if (mode === 'volume') return Object.values(VOLUME_UNITS);
  if (mode === 'weight') return Object.values(WEIGHT_UNITS);
  if (mode === 'temperature') return Object.values(TEMP_UNITS);
  return [...Object.values(VOLUME_UNITS), ...Object.values(WEIGHT_UNITS)];
}

function asIdSet(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

function sortPinnedFirst(items, getCardId, pinnedSet) {
  return [...items].sort((a, b) => {
    const aPinned = pinnedSet.has(getCardId(a));
    const bPinned = pinnedSet.has(getCardId(b));
    if (aPinned === bPinned) return 0;
    return aPinned ? -1 : 1;
  });
}

function renderRefCardControls({ cardId, isPinned, isCollapsed, extraButtonsHtml = '' }) {
  return `
    <div class="ref-card-controls">
      <button
        type="button"
        class="btn btn-sm btn-outline ref-pin-btn ${isPinned ? 'is-pinned' : ''}"
        data-action="toggle-pin-ref-card"
        data-card-id="${escapeHtml(cardId)}"
        aria-pressed="${isPinned ? 'true' : 'false'}"
        title="${isPinned ? 'Unpin card' : 'Pin card to top'}"
      >${isPinned ? 'Pinned' : 'Pin'}</button>
      ${extraButtonsHtml}
      <button
        type="button"
        class="btn btn-sm btn-outline ref-collapse-btn"
        data-action="toggle-collapse-ref-card"
        data-card-id="${escapeHtml(cardId)}"
        aria-expanded="${isCollapsed ? 'false' : 'true'}"
        title="${isCollapsed ? 'Expand card' : 'Collapse card'}"
      >${isCollapsed ? 'Expand ▾' : 'Collapse ▴'}</button>
    </div>
  `;
}

function renderBulkVisibilityButtons({ visibleCardIds, collapsedSet, pinnedOnly }) {
  const allCollapsed =
    visibleCardIds.length > 0 && visibleCardIds.every((id) => collapsedSet.has(id));
  return `
    <button
      type="button"
      class="btn btn-sm ${pinnedOnly ? 'btn-primary' : 'btn-outline'}"
      data-action="toggle-ref-pinned-only"
      aria-pressed="${pinnedOnly ? 'true' : 'false'}"
    >${pinnedOnly ? 'Pinned Only: On' : 'Pinned Only'}</button>
    ${
      visibleCardIds.length > 0
        ? `<button
            type="button"
            class="btn btn-sm btn-outline"
            data-action="toggle-collapse-all-ref"
            data-card-ids="${escapeHtml(visibleCardIds.join(','))}"
          >${allCollapsed ? 'Expand All' : 'Collapse All'}</button>`
        : ''
    }
  `;
}

/**
 * Renders only the live conversion result box + quick equivalents for `#converter-result-panel`.
 */
export function renderConverterResultHtml(converterState) {
  const value = converterState?.value ?? '1';
  const fromUnit = converterState?.fromUnit || 'cup';
  const toUnit = converterState?.toUnit || 'g';
  const ingredientId = converterState?.ingredientId || '';

  const res = convertMeasurement({ value, fromUnit, toUnit, ingredientId });
  const equivalents = getQuickEquivalents(value, fromUnit, ingredientId);

  const mainBoxHtml = res.ok
    ? `<div class="converter-result-box">
        <div class="converter-big-value">
          ${escapeHtml(String(value).trim() || '0')} ${escapeHtml(res.fromLabel)}
          <span class="converter-eq">=</span>
          <strong>${escapeHtml(res.formatted)} ${escapeHtml(res.toLabel)}</strong>
        </div>
        ${res.note ? `<p class="converter-density-note">${escapeHtml(res.note)}</p>` : ''}
      </div>`
    : `<div class="callout-box callout-warning">${escapeHtml(res.error)}</div>`;

  const equivHtml =
    equivalents.length > 0
      ? `<div class="equivalents-section">
          <span class="tag-filter-label">Quick Kitchen Equivalents:</span>
          <div class="equivalents-grid">
            ${equivalents
              .map(
                (item) => `<div class="equiv-chip">
                  <span class="equiv-val">${escapeHtml(item.value)}</span>
                </div>`
              )
              .join('')}
          </div>
        </div>`
      : '';

  const ovenPresetsHtml =
    converterState?.mode === 'temperature'
      ? `<div class="ref-table-wrap" style="margin-top: 14px;">
          <table class="ref-table">
            <thead>
              <tr>
                <th>Fahrenheit</th>
                <th>Celsius</th>
                <th>Common Oven Setting</th>
              </tr>
            </thead>
            <tbody>
              ${OVEN_TEMP_PRESETS.map(
                (row) => `<tr>
                  <td class="mono-cell">${row.f}°F</td>
                  <td class="mono-cell">${row.c}°C</td>
                  <td>${escapeHtml(row.desc)}</td>
                </tr>`
              ).join('')}
            </tbody>
          </table>
        </div>`
      : '';

  return `${mainBoxHtml}${equivHtml}${ovenPresetsHtml}`;
}

function renderConverterTab(converterState, pinnedSet, collapsedSet) {
  const mode = converterState?.mode || 'volume-weight';
  const unitsList = getModeUnitOptions(mode);
  const fromUnit = converterState?.fromUnit || 'cup';
  const toUnit = converterState?.toUnit || 'g';
  const ingredientId = converterState?.ingredientId || 'ap-flour';
  const showDensitySelect = mode === 'volume-weight';

  const cardId = 'ref-converter-card';
  const isPinned = pinnedSet.has(cardId);
  const isCollapsed = collapsedSet.has(cardId);

  const modes = [
    { id: 'volume-weight', label: 'Volume ↔ Weight' },
    { id: 'volume', label: 'Volume' },
    { id: 'weight', label: 'Weight' },
    { id: 'temperature', label: 'Oven Temp (°F / °C)' },
  ];

  const modeButtonsHtml = modes
    .map(
      (m) =>
        `<button type="button" class="seg-btn ${mode === m.id ? 'is-active' : ''}" data-action="set-converter-mode" data-mode="${m.id}">${escapeHtml(
          m.label
        )}</button>`
    )
    .join('');

  const buildUnitOptions = (selectedId) =>
    unitsList
      .map(
        (u) =>
          `<option value="${escapeHtml(u.id)}" ${u.id === selectedId ? 'selected' : ''}>${escapeHtml(
            u.name
          )} (${escapeHtml(u.label)})</option>`
      )
      .join('');

  const ingredientOptionsHtml = INGREDIENT_DENSITIES.map(
    (ing) =>
      `<option value="${escapeHtml(ing.id)}" ${
        ing.id === ingredientId ? 'selected' : ''
      }>${escapeHtml(ing.name)} (${ing.gramsPerCup} g/cup)</option>`
  ).join('');

  return `
    <div class="panel-card ref-card ${isPinned ? 'is-pinned' : ''} ${isCollapsed ? 'is-collapsed' : ''}">
      <div class="ref-card-header">
        <button
          type="button"
          class="ref-card-title-btn"
          data-action="toggle-collapse-ref-card"
          data-card-id="${cardId}"
          aria-expanded="${isCollapsed ? 'false' : 'true'}"
        >
          <h2>Kitchen Unit of Measure Converter</h2>
        </button>
        ${renderRefCardControls({ cardId, isPinned, isCollapsed })}
      </div>

      <div class="ref-card-body">
        <p class="muted">
          Convert baking volumes to weights using ingredient densities, switch between metric and US measures, or check oven temperatures. Accepts decimals and fractions like <code>1 1/2</code> or <code>3/4</code>.
        </p>

        <div class="seg-control converter-mode-bar" role="group" aria-label="Converter mode">
          ${modeButtonsHtml}
        </div>

        <div class="converter-grid">
          <div class="form-field">
            <label for="converter-value-input">Amount (number or fraction)</label>
            <input
              id="converter-value-input"
              type="text"
              inputmode="decimal"
              value="${escapeHtml(converterState?.value ?? '1')}"
              placeholder="e.g., 1 1/2 or 250"
            />
          </div>

          <div class="form-field">
            <label for="converter-from-select">From Unit</label>
            <select id="converter-from-select">
              ${buildUnitOptions(fromUnit)}
            </select>
          </div>

          <div class="converter-swap-wrap">
            <button type="button" class="btn btn-outline" data-action="swap-converter-units" title="Swap units">⇄ Swap</button>
          </div>

          <div class="form-field">
            <label for="converter-to-select">To Unit</label>
            <select id="converter-to-select">
              ${buildUnitOptions(toUnit)}
            </select>
          </div>

          ${
            showDensitySelect
              ? `<div class="form-field converter-ingredient-field">
                  <label for="converter-ingredient-select">Ingredient Density (for Volume ↔ Weight)</label>
                  <select id="converter-ingredient-select">
                    ${ingredientOptionsHtml}
                  </select>
                </div>`
              : ''
          }
        </div>

        <div id="converter-result-panel">
          ${renderConverterResultHtml(converterState)}
        </div>
      </div>
    </div>
  `;
}

function renderSubstitutionEditorForm(editingItem) {
  const isNew = !editingItem;
  const item = editingItem || {
    id: '',
    missing: '',
    category: 'Spices & Herbs',
    amount: '1 tsp',
    substitute: '',
    notes: '',
  };

  const categoryChoices = SUBSTITUTION_CATEGORIES.filter((c) => c !== 'all');
  const categoryOptions = categoryChoices
    .map(
      (cat) =>
        `<option value="${escapeHtml(cat)}" ${item.category === cat ? 'selected' : ''}>${escapeHtml(
          cat
        )}</option>`
    )
    .join('');

  return `
    <form id="ref-substitution-form" class="panel-card ref-editor-card" data-sub-id="${escapeHtml(item.id)}">
      <h2>${isNew ? 'Add Substitution' : `Edit Substitution: ${escapeHtml(item.missing)}`}</h2>
      <div class="form-grid">
        <div class="form-field">
          <label for="sub-missing-input">Missing Ingredient / Spice (required)</label>
          <input
            id="sub-missing-input"
            name="missing"
            type="text"
            required
            value="${escapeHtml(item.missing)}"
            placeholder="e.g., Smoked Paprika, Buttermilk"
          />
        </div>

        <div class="form-field">
          <label for="sub-category-select">Category</label>
          <select id="sub-category-select" name="category">
            ${categoryOptions}
          </select>
        </div>

        <div class="form-field">
          <label for="sub-amount-input">Base Amount</label>
          <input
            id="sub-amount-input"
            name="amount"
            type="text"
            value="${escapeHtml(item.amount)}"
            placeholder="e.g., 1 tsp or 1 cup"
          />
        </div>

        <div class="form-field">
          <label for="sub-swap-input">Substitute With (required)</label>
          <input
            id="sub-swap-input"
            name="substitute"
            type="text"
            required
            value="${escapeHtml(item.substitute)}"
            placeholder="e.g., 1 tsp sweet paprika + drop liquid smoke"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="sub-notes-input">Kitchen Notes (optional)</label>
          <input
            id="sub-notes-input"
            name="notes"
            type="text"
            value="${escapeHtml(item.notes)}"
            placeholder="Tips on flavor strength or when to add..."
          />
        </div>
      </div>

      <div class="btn-row" style="margin-top: 12px;">
        <button type="submit" class="btn btn-primary">Save Substitution</button>
        <button type="button" class="btn btn-secondary" data-action="cancel-ref-edit">Cancel</button>
      </div>
    </form>
  `;
}

function renderSubstitutionsTab({
  substitutions = [],
  subCategory = 'all',
  subQuery = '',
  editingSubId = null,
  pinnedSet,
  collapsedSet,
  pinnedOnly = false,
}) {
  const cleanQuery = String(subQuery || '').trim().toLowerCase();

  const countByCategory = new Map();
  for (const item of substitutions) {
    const cat = item.category || 'Other';
    countByCategory.set(cat, (countByCategory.get(cat) || 0) + 1);
  }

  const allCategories = Array.from(
    new Set([
      ...SUBSTITUTION_CATEGORIES.filter((c) => c !== 'all'),
      ...substitutions.map((s) => s.category || 'Other'),
    ])
  );

  const filteredRows = substitutions.filter((item) => {
    const cardId = `sub-${item.id}`;
    if (pinnedOnly && !pinnedSet.has(cardId)) return false;
    if (subCategory && subCategory !== 'all' && (item.category || 'Other') !== subCategory) {
      return false;
    }
    if (!cleanQuery) return true;
    return [item.missing, item.category, item.amount, item.substitute, item.notes]
      .join(' ')
      .toLowerCase()
      .includes(cleanQuery);
  });

  const visibleRows = sortPinnedFirst(filteredRows, (s) => `sub-${s.id}`, pinnedSet);
  const visibleIds = visibleRows.map((s) => `sub-${s.id}`);

  const catButtons = [
    `<button type="button" class="tag-pill ${subCategory === 'all' ? 'is-active' : ''}" data-action="select-sub-category" data-category="all">All (${substitutions.length})</button>`,
    ...allCategories
      .filter((cat) => (countByCategory.get(cat) || 0) > 0 || subCategory === cat)
      .map(
        (cat) =>
          `<button type="button" class="tag-pill ${subCategory === cat ? 'is-active' : ''}" data-action="select-sub-category" data-category="${escapeHtml(
            cat
          )}">${escapeHtml(cat)} (${countByCategory.get(cat) || 0})</button>`
      ),
  ].join('');

  const editingItem =
    editingSubId && editingSubId !== '__new__'
      ? substitutions.find((s) => s.id === editingSubId) || null
      : null;

  const cardsHtml = visibleRows
    .map((r) => {
      const cardId = `sub-${r.id}`;
      const isPinned = pinnedSet.has(cardId);
      const isCollapsed = collapsedSet.has(cardId);
      const extraButtonsHtml = `
        <button type="button" class="btn btn-sm btn-outline" data-action="edit-substitution" data-sub-id="${escapeHtml(
          r.id
        )}">Edit</button>
        <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-substitution" data-sub-id="${escapeHtml(
          r.id
        )}">Delete</button>
      `;

      return `
        <article class="panel-card ref-card sub-card ${isPinned ? 'is-pinned' : ''} ${
          isCollapsed ? 'is-collapsed' : ''
        }">
          <div class="ref-card-header">
            <div class="ref-card-title-group">
              <button
                type="button"
                class="ref-card-title-btn"
                data-action="toggle-collapse-ref-card"
                data-card-id="${escapeHtml(cardId)}"
                aria-expanded="${isCollapsed ? 'false' : 'true'}"
              >
                <h3 class="sub-card-title">${escapeHtml(r.missing)}</h3>
              </button>
              <span class="badge badge-divider">${escapeHtml(r.category || 'Other')}</span>
              <span class="badge mono-cell">${escapeHtml(r.amount)}</span>
            </div>
            ${renderRefCardControls({ cardId, isPinned, isCollapsed, extraButtonsHtml })}
          </div>

          <div class="ref-card-body">
            <div class="sub-horiz-body ${r.notes ? '' : 'is-single-col'}">
              <div class="sub-horiz-main">
                <span class="sub-field-label">Substitute With</span>
                <p class="sub-swap-text">${escapeHtml(r.substitute)}</p>
              </div>
              ${
                r.notes
                  ? `<div class="sub-notes-box">
                      <span class="sub-field-label">Notes</span>
                      <p>${escapeHtml(r.notes)}</p>
                    </div>`
                  : ''
              }
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  return `
    <div class="panel-card toolbar-card">
      <div class="collection-toolbar">
        <div class="toolbar-search">
          <label for="reference-sub-search" class="sr-only">Search substitutions</label>
          <input
            id="reference-sub-search"
            type="search"
            value="${escapeHtml(subQuery)}"
            placeholder="Search spices, herbs, baking & pantry swaps (e.g., cumin, cardamom, buttermilk)..."
          />
        </div>
        <div class="ref-toolbar-actions">
          ${renderBulkVisibilityButtons({
            visibleCardIds: visibleIds,
            collapsedSet,
            pinnedOnly,
          })}
          <button type="button" class="btn btn-primary" data-action="new-substitution">+ Add Substitution</button>
          <button type="button" class="btn btn-outline" data-action="reset-ref-section" data-section="substitutions">Reset Defaults</button>
        </div>
      </div>
      <div class="tag-filter-bar" aria-label="Substitution categories">
        <span class="tag-filter-label">Category:</span>
        ${catButtons}
      </div>
    </div>

    ${editingSubId ? renderSubstitutionEditorForm(editingItem) : ''}

    ${
      visibleRows.length > 0
        ? `<div class="substitution-grid">${cardsHtml}</div>`
        : '<div class="panel-card empty-state"><p class="muted">No matching substitutions. Adjust your search, turn off "Pinned Only", add a custom entry, or reset defaults.</p></div>'
    }
  `;
}

function matchesFilter(rowValues, cleanQuery) {
  if (!cleanQuery) return true;
  return rowValues.join(' ').toLowerCase().includes(cleanQuery);
}

function renderChartsTab(chartQuery = '', pinnedSet, collapsedSet, pinnedOnly) {
  const q = String(chartQuery || '').trim().toLowerCase();

  const meatRows = MEAT_TEMPERATURES.filter((r) =>
    matchesFilter([r.item, r.category, r.tempF, r.tempC, r.notes], q)
  );
  const grainRows = GRAIN_RATIOS.filter((r) =>
    matchesFilter([r.grain, r.ratio, r.liquid, r.cookTime, r.tip], q)
  );
  const oilRows = OIL_SMOKE_POINTS.filter((r) =>
    matchesFilter([r.oil, r.smokeF, r.smokeC, r.bestFor, r.flavor], q)
  );

  const chartCards = [
    {
      id: 'chart-meat-temps',
      title: `Internal Meat & Baking Temperatures (${meatRows.length})`,
      bodyHtml: `
        <div class="ref-table-wrap">
          <table class="ref-table">
            <thead>
              <tr>
                <th>Food / Cut</th>
                <th>Category</th>
                <th>°F</th>
                <th>°C</th>
                <th>Kitchen Notes</th>
              </tr>
            </thead>
            <tbody>
              ${
                meatRows.length > 0
                  ? meatRows
                      .map(
                        (r) => `<tr>
                          <td><strong>${escapeHtml(r.item)}</strong></td>
                          <td>${escapeHtml(r.category)}</td>
                          <td class="mono-cell">${escapeHtml(r.tempF)}</td>
                          <td class="mono-cell">${escapeHtml(r.tempC)}</td>
                          <td>${escapeHtml(r.notes)}</td>
                        </tr>`
                      )
                      .join('')
                  : '<tr><td colspan="5" class="muted">No matching temperature entries.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      `,
    },
    {
      id: 'chart-grain-ratios',
      title: `Grain & Legume-to-Water Ratios (per 1 cup dry) (${grainRows.length})`,
      bodyHtml: `
        <div class="ref-table-wrap">
          <table class="ref-table">
            <thead>
              <tr>
                <th>Grain / Legume</th>
                <th>Ratio</th>
                <th>Liquid</th>
                <th>Simmer Time</th>
                <th>Yield &amp; Tip</th>
              </tr>
            </thead>
            <tbody>
              ${
                grainRows.length > 0
                  ? grainRows
                      .map(
                        (r) => `<tr>
                          <td><strong>${escapeHtml(r.grain)}</strong></td>
                          <td class="mono-cell">${escapeHtml(r.ratio)}</td>
                          <td>${escapeHtml(r.liquid)}</td>
                          <td>${escapeHtml(r.cookTime)}</td>
                          <td>${escapeHtml(r.yield)} · ${escapeHtml(r.tip)}</td>
                        </tr>`
                      )
                      .join('')
                  : '<tr><td colspan="5" class="muted">No matching grain ratios.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      `,
    },
    {
      id: 'chart-oil-smoke',
      title: `Cooking Oil Smoke Points (${oilRows.length})`,
      bodyHtml: `
        <div class="ref-table-wrap">
          <table class="ref-table">
            <thead>
              <tr>
                <th>Oil / Fat</th>
                <th>Smoke °F</th>
                <th>Smoke °C</th>
                <th>Flavor</th>
                <th>Best For</th>
              </tr>
            </thead>
            <tbody>
              ${
                oilRows.length > 0
                  ? oilRows
                      .map(
                        (r) => `<tr>
                          <td><strong>${escapeHtml(r.oil)}</strong></td>
                          <td class="mono-cell">${escapeHtml(r.smokeF)}</td>
                          <td class="mono-cell">${escapeHtml(r.smokeC)}</td>
                          <td>${escapeHtml(r.flavor)}</td>
                          <td>${escapeHtml(r.bestFor)}</td>
                        </tr>`
                      )
                      .join('')
                  : '<tr><td colspan="5" class="muted">No matching oils.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      `,
    },
  ];

  const visibleCharts = sortPinnedFirst(
    pinnedOnly ? chartCards.filter((c) => pinnedSet.has(c.id)) : chartCards,
    (c) => c.id,
    pinnedSet
  );
  const visibleIds = visibleCharts.map((c) => c.id);

  return `
    <div class="panel-card toolbar-card">
      <div class="collection-toolbar">
        <div class="toolbar-search">
          <label for="reference-chart-search" class="sr-only">Filter reference charts</label>
          <input
            id="reference-chart-search"
            type="search"
            value="${escapeHtml(chartQuery)}"
            placeholder="Filter charts (e.g., chicken, rice, avocado oil)..."
          />
        </div>
        <div class="ref-toolbar-actions">
          ${renderBulkVisibilityButtons({
            visibleCardIds: visibleIds,
            collapsedSet,
            pinnedOnly,
          })}
        </div>
      </div>
    </div>

    ${
      visibleCharts.length > 0
        ? visibleCharts
            .map((chart) => {
              const isPinned = pinnedSet.has(chart.id);
              const isCollapsed = collapsedSet.has(chart.id);
              return `
                <div class="panel-card ref-card ${isPinned ? 'is-pinned' : ''} ${
                isCollapsed ? 'is-collapsed' : ''
              }">
                  <div class="ref-card-header">
                    <button
                      type="button"
                      class="ref-card-title-btn"
                      data-action="toggle-collapse-ref-card"
                      data-card-id="${escapeHtml(chart.id)}"
                      aria-expanded="${isCollapsed ? 'false' : 'true'}"
                    >
                      <h2>${escapeHtml(chart.title)}</h2>
                    </button>
                    ${renderRefCardControls({
                      cardId: chart.id,
                      isPinned,
                      isCollapsed,
                    })}
                  </div>
                  <div class="ref-card-body">
                    ${chart.bodyHtml}
                  </div>
                </div>
              `;
            })
            .join('')
        : '<div class="panel-card empty-state"><p class="muted">No pinned chart cards yet. Turn off "Pinned Only" or click Pin on any chart.</p></div>'
    }
  `;
}

function renderStorageEditorForm(editingItem) {
  const isNew = !editingItem;
  const item = editingItem || {
    id: '',
    categoryId: FOOD_STORAGE_CATEGORIES[0].id,
    food: '',
    fridge: '',
    freezer: '',
    pantry: '—',
    notes: '',
  };

  const categoryOptions = FOOD_STORAGE_CATEGORIES.map(
    (cat) =>
      `<option value="${escapeHtml(cat.id)}" ${item.categoryId === cat.id ? 'selected' : ''}>${escapeHtml(
        cat.label
      )}</option>`
  ).join('');

  return `
    <form id="ref-storage-form" class="panel-card ref-editor-card" data-storage-id="${escapeHtml(item.id)}">
      <h2>${isNew ? 'Add Food Storage Item' : `Edit Storage Item: ${escapeHtml(item.food)}`}</h2>
      <div class="form-grid">
        <div class="form-field">
          <label for="storage-food-input">Food / Ingredient (required)</label>
          <input
            id="storage-food-input"
            name="food"
            type="text"
            required
            value="${escapeHtml(item.food)}"
            placeholder="e.g., Cooked Quinoa, Fresh Ginger"
          />
        </div>

        <div class="form-field">
          <label for="storage-category-select">Category</label>
          <select id="storage-category-select" name="categoryId">
            ${categoryOptions}
          </select>
        </div>

        <div class="form-field">
          <label for="storage-fridge-input">Refrigerator (34–40°F)</label>
          <input
            id="storage-fridge-input"
            name="fridge"
            type="text"
            value="${escapeHtml(item.fridge)}"
            placeholder="e.g., 3–4 days or —"
          />
        </div>

        <div class="form-field">
          <label for="storage-freezer-input">Freezer (0°F)</label>
          <input
            id="storage-freezer-input"
            name="freezer"
            type="text"
            value="${escapeHtml(item.freezer)}"
            placeholder="e.g., 3–6 months or —"
          />
        </div>

        <div class="form-field">
          <label for="storage-pantry-input">Pantry / Counter</label>
          <input
            id="storage-pantry-input"
            name="pantry"
            type="text"
            value="${escapeHtml(item.pantry)}"
            placeholder="e.g., 6 months or —"
          />
        </div>

        <div class="form-field">
          <label for="storage-notes-input">Storage Tips (optional)</label>
          <input
            id="storage-notes-input"
            name="notes"
            type="text"
            value="${escapeHtml(item.notes)}"
            placeholder="Container, wrapping, or temperature tip..."
          />
        </div>
      </div>

      <div class="btn-row" style="margin-top: 12px;">
        <button type="submit" class="btn btn-primary">Save Storage Item</button>
        <button type="button" class="btn btn-secondary" data-action="cancel-ref-edit">Cancel</button>
      </div>
    </form>
  `;
}

function renderStorageTab({
  storageTimes = [],
  storageQuery = '',
  editingStorageId = null,
  pinnedSet,
  collapsedSet,
  pinnedOnly,
}) {
  const cleanQuery = String(storageQuery || '').trim().toLowerCase();

  const categoryCards = FOOD_STORAGE_CATEGORIES.map((cat) => {
    const rows = storageTimes.filter(
      (item) =>
        item.categoryId === cat.id &&
        matchesFilter([item.food, item.fridge, item.freezer, item.pantry, item.notes], cleanQuery)
    );
    return { ...cat, rows };
  }).filter((cat) => cat.rows.length > 0);

  const visibleCards = sortPinnedFirst(
    pinnedOnly ? categoryCards.filter((c) => pinnedSet.has(c.id)) : categoryCards,
    (c) => c.id,
    pinnedSet
  );
  const visibleIds = visibleCards.map((c) => c.id);

  const editingItem =
    editingStorageId && editingStorageId !== '__new__'
      ? storageTimes.find((s) => s.id === editingStorageId) || null
      : null;

  return `
    <div class="panel-card toolbar-card">
      <div class="collection-toolbar">
        <div class="toolbar-search">
          <label for="reference-storage-search" class="sr-only">Search food storage times</label>
          <input
            id="reference-storage-search"
            type="search"
            value="${escapeHtml(storageQuery)}"
            placeholder="Search storage times (e.g., chicken, rice, herbs, berries, flour)..."
          />
        </div>
        <div class="ref-toolbar-actions">
          ${renderBulkVisibilityButtons({
            visibleCardIds: visibleIds,
            collapsedSet,
            pinnedOnly,
          })}
          <button type="button" class="btn btn-primary" data-action="new-storage-item">+ Add Storage Item</button>
          <button type="button" class="btn btn-outline" data-action="reset-ref-section" data-section="storageTimes">Reset Defaults</button>
        </div>
      </div>
    </div>

    ${editingStorageId ? renderStorageEditorForm(editingItem) : ''}

    ${
      visibleCards.length > 0
        ? visibleCards
            .map((cat) => {
              const isPinned = pinnedSet.has(cat.id);
              const isCollapsed = collapsedSet.has(cat.id);
              return `
                <div class="panel-card ref-card ${isPinned ? 'is-pinned' : ''} ${
                isCollapsed ? 'is-collapsed' : ''
              }">
                  <div class="ref-card-header">
                    <div class="ref-card-title-group">
                      <button
                        type="button"
                        class="ref-card-title-btn"
                        data-action="toggle-collapse-ref-card"
                        data-card-id="${escapeHtml(cat.id)}"
                        aria-expanded="${isCollapsed ? 'false' : 'true'}"
                      >
                        <h2>${escapeHtml(cat.label)} (${cat.rows.length})</h2>
                      </button>
                    </div>
                    ${renderRefCardControls({
                      cardId: cat.id,
                      isPinned,
                      isCollapsed,
                    })}
                  </div>
                  <div class="ref-card-body">
                    <div class="ref-table-wrap">
                      <table class="ref-table">
                        <thead>
                          <tr>
                            <th>Food</th>
                            <th>Refrigerator (34–40°F)</th>
                            <th>Freezer (0°F)</th>
                            <th>Pantry / Counter</th>
                            <th>Storage Tips</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${cat.rows
                            .map(
                              (r) => `<tr>
                                <td><strong>${escapeHtml(r.food)}</strong></td>
                                <td class="storage-duration-cell">${escapeHtml(r.fridge)}</td>
                                <td class="storage-duration-cell">${escapeHtml(r.freezer)}</td>
                                <td class="storage-duration-cell">${escapeHtml(r.pantry)}</td>
                                <td>${escapeHtml(r.notes)}</td>
                                <td class="table-actions-cell">
                                  <button type="button" class="btn btn-sm btn-outline" data-action="edit-storage-item" data-storage-id="${escapeHtml(
                                    r.id
                                  )}">Edit</button>
                                  <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-storage-item" data-storage-id="${escapeHtml(
                                    r.id
                                  )}">Delete</button>
                                </td>
                              </tr>`
                            )
                            .join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              `;
            })
            .join('')
        : '<div class="panel-card empty-state"><p class="muted">No matching food storage items found. Add an item, turn off "Pinned Only", or reset defaults.</p></div>'
    }
  `;
}

function renderTechniqueEditorForm(editingTech) {
  const isNew = !editingTech;
  const tech = editingTech || {
    id: '',
    title: '',
    category: 'Heat & Sauces',
    time: '5 min',
    summary: '',
    keywords: [],
    steps: [],
    visualCue: '',
    commonMistake: '',
  };

  return `
    <form id="ref-technique-form" class="panel-card ref-editor-card" data-tech-id="${escapeHtml(tech.id)}">
      <h2>${isNew ? 'Add Technique Card' : `Edit Technique: ${escapeHtml(tech.title)}`}</h2>
      <datalist id="technique-category-suggestions">
        ${DEFAULT_TECHNIQUE_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('')}
      </datalist>

      <div class="form-grid">
        <div class="form-field form-span-2">
          <label for="tech-title-input">Technique Title (required)</label>
          <input
            id="tech-title-input"
            name="title"
            type="text"
            required
            value="${escapeHtml(tech.title)}"
            placeholder="e.g., Toasting Whole Spices"
          />
        </div>

        <div class="form-field">
          <label for="tech-category-input">Category</label>
          <input
            id="tech-category-input"
            name="category"
            type="text"
            list="technique-category-suggestions"
            value="${escapeHtml(tech.category)}"
          />
        </div>

        <div class="form-field">
          <label for="tech-time-input">Typical Time</label>
          <input
            id="tech-time-input"
            name="time"
            type="text"
            value="${escapeHtml(tech.time)}"
            placeholder="e.g., 3–5 min"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="tech-summary-input">Short Summary</label>
          <input
            id="tech-summary-input"
            name="summary"
            type="text"
            value="${escapeHtml(tech.summary)}"
            placeholder="Why this technique works and when to use it"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="tech-keywords-input">Auto-Link Keywords in Recipe Steps (comma-separated)</label>
          <input
            id="tech-keywords-input"
            name="keywords"
            type="text"
            value="${escapeHtml((tech.keywords || []).join(', '))}"
            placeholder="e.g., toast spices, blooming spices, dry-toast"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="tech-steps-input">Step-by-Step Breakdown (one step per line)</label>
          <textarea
            id="tech-steps-input"
            name="steps"
            rows="5"
            placeholder="Heat a dry skillet over medium heat.&#10;Swirl whole spices 1–2 minutes until fragrant."
          >${escapeHtml((tech.steps || []).join('\n'))}</textarea>
        </div>

        <div class="form-field">
          <label for="tech-cue-input">Visual Cue</label>
          <input
            id="tech-cue-input"
            name="visualCue"
            type="text"
            value="${escapeHtml(tech.visualCue)}"
            placeholder="What it looks/smells like when ready"
          />
        </div>

        <div class="form-field">
          <label for="tech-mistake-input">Common Mistake to Avoid</label>
          <input
            id="tech-mistake-input"
            name="commonMistake"
            type="text"
            value="${escapeHtml(tech.commonMistake)}"
            placeholder="What to watch out for"
          />
        </div>
      </div>

      <div class="btn-row" style="margin-top: 12px;">
        <button type="submit" class="btn btn-primary">Save Technique Card</button>
        <button type="button" class="btn btn-secondary" data-action="cancel-ref-edit">Cancel</button>
      </div>
    </form>
  `;
}

function renderTechniqueCardBody(tech) {
  return `
    <div class="technique-horiz-body">
      <div class="technique-horiz-main">
        <p class="technique-summary">${escapeHtml(tech.summary)}</p>
        <ol class="technique-steps">
          ${(tech.steps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>
      </div>
      <div class="technique-horiz-side">
        ${
          tech.visualCue
            ? `<div class="technique-cue-box"><strong>Visual Cue:</strong> ${escapeHtml(tech.visualCue)}</div>`
            : ''
        }
        ${
          tech.commonMistake
            ? `<div class="technique-mistake-box"><strong>Avoid:</strong> ${escapeHtml(tech.commonMistake)}</div>`
            : ''
        }
        <div class="technique-keywords-row">
          <span class="muted">Recipe auto-links:</span>
          ${
            (tech.keywords || []).length > 0
              ? tech.keywords.map((kw) => `<code>${escapeHtml(kw)}</code>`).join(' ')
              : '<span class="muted">(none)</span>'
          }
        </div>
      </div>
    </div>
  `;
}

function renderTechniquesTab({
  techniques = [],
  category = 'all',
  query = '',
  editingTechniqueId = null,
  pinnedSet,
  collapsedSet,
  pinnedOnly,
}) {
  const cleanQuery = String(query || '').trim().toLowerCase();
  const filtered = techniques.filter((t) => {
    const cardId = `tech-${t.id}`;
    if (pinnedOnly && !pinnedSet.has(cardId)) return false;
    if (category && category !== 'all' && t.category !== category) return false;
    if (!cleanQuery) return true;
    const hay = [
      t.title,
      t.category,
      t.summary,
      t.visualCue,
      t.commonMistake,
      ...(t.steps || []),
      ...(t.keywords || []),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(cleanQuery);
  });

  const visible = sortPinnedFirst(filtered, (t) => `tech-${t.id}`, pinnedSet);
  const visibleIds = visible.map((t) => `tech-${t.id}`);

  const dynamicCats = Array.from(
    new Set([
      ...DEFAULT_TECHNIQUE_CATEGORIES,
      ...techniques.map((t) => t.category).filter(Boolean),
    ])
  );
  const catButtons = ['all', ...dynamicCats]
    .map((cat) => {
      const label = cat === 'all' ? 'All Techniques' : cat;
      const active = category === cat;
      return `<button type="button" class="tag-pill ${active ? 'is-active' : ''}" data-action="select-technique-category" data-category="${escapeHtml(
        cat
      )}">${escapeHtml(label)}</button>`;
    })
    .join('');

  const editingTech =
    editingTechniqueId && editingTechniqueId !== '__new__'
      ? techniques.find((t) => t.id === editingTechniqueId) || null
      : null;

  return `
    <div class="panel-card toolbar-card">
      <div class="collection-toolbar">
        <div class="toolbar-search">
          <label for="reference-technique-search" class="sr-only">Search cooking techniques</label>
          <input
            id="reference-technique-search"
            type="search"
            value="${escapeHtml(query)}"
            placeholder="Search techniques (e.g., roux, brown butter, velvet, deglaze)..."
          />
        </div>
        <div class="ref-toolbar-actions">
          ${renderBulkVisibilityButtons({
            visibleCardIds: visibleIds,
            collapsedSet,
            pinnedOnly,
          })}
          <button type="button" class="btn btn-primary" data-action="new-technique">+ Add Technique</button>
          <button type="button" class="btn btn-outline" data-action="reset-ref-section" data-section="techniques">Reset Defaults</button>
        </div>
      </div>
      <div class="tag-filter-bar" aria-label="Technique categories">
        <span class="tag-filter-label">Category:</span>
        ${catButtons}
      </div>
    </div>

    ${editingTechniqueId ? renderTechniqueEditorForm(editingTech) : ''}

    ${
      visible.length > 0
        ? `<div class="technique-grid">
            ${visible
              .map((tech) => {
                const cardId = `tech-${tech.id}`;
                const isPinned = pinnedSet.has(cardId);
                const isCollapsed = collapsedSet.has(cardId);
                const extraButtonsHtml = `
                  <button type="button" class="btn btn-sm btn-outline" data-action="edit-technique" data-technique-id="${escapeHtml(
                    tech.id
                  )}">Edit</button>
                  <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-technique" data-technique-id="${escapeHtml(
                    tech.id
                  )}">Delete</button>
                `;
                return `
                  <article class="panel-card ref-card technique-card ${isPinned ? 'is-pinned' : ''} ${
                  isCollapsed ? 'is-collapsed' : ''
                }">
                    <div class="ref-card-header">
                      <div class="ref-card-title-group">
                        <button
                          type="button"
                          class="ref-card-title-btn"
                          data-action="toggle-collapse-ref-card"
                          data-card-id="${escapeHtml(cardId)}"
                          aria-expanded="${isCollapsed ? 'false' : 'true'}"
                        >
                          <h3 class="technique-card-title">${escapeHtml(tech.title)}</h3>
                        </button>
                        <span class="badge badge-divider">${escapeHtml(tech.category)}</span>
                        <span class="badge">${escapeHtml(tech.time)}</span>
                      </div>
                      ${renderRefCardControls({
                        cardId,
                        isPinned,
                        isCollapsed,
                        extraButtonsHtml,
                      })}
                    </div>
                    <div class="ref-card-body">
                      ${renderTechniqueCardBody(tech)}
                    </div>
                  </article>
                `;
              })
              .join('')}
          </div>`
        : '<div class="panel-card empty-state"><p class="muted">No matching cooking techniques found. Adjust filters or add a new card.</p></div>'
    }
  `;
}

function renderFlavorEditorForm(editingFlavor, allFlavors) {
  const isNew = !editingFlavor;
  const item = editingFlavor || {
    id: '',
    name: '',
    familyId: 'fresh-herbs',
    profile: '',
    cuisineVibe: '',
    foodPairings: {
      meats: '',
      vegetables: '',
      soupsSalads: '',
      appetizersBaking: '',
    },
    bestWith: [],
    pairsWellWith: [],
    substitutes: '',
  };

  const fp = item.foodPairings || {};
  const allFlavorsMap = new Map((allFlavors || []).map((f) => [f.id, f]));
  const companionNamesText = (item.pairsWellWith || [])
    .map((entry) => allFlavorsMap.get(entry)?.name || entry)
    .filter(Boolean)
    .join(', ');

  const quickAddHerbs = (allFlavors || []).filter((other) => other.id !== item.id);

  return `
    <form
      id="ref-flavor-form"
      class="panel-card ref-editor-card"
      data-flavor-id="${escapeHtml(item.id)}"
      data-family-id="${escapeHtml(item.familyId || 'fresh-herbs')}"
    >
      <h2>${isNew ? 'Add Herb / Spice Profile' : `Edit Herb Profile: ${escapeHtml(item.name)}`}</h2>
      <div class="form-grid">
        <div class="form-field">
          <label for="flavor-name-input">Herb / Spice Name (required)</label>
          <input
            id="flavor-name-input"
            name="name"
            type="text"
            required
            value="${escapeHtml(item.name)}"
            placeholder="e.g., Fennel Seed, Savory"
          />
        </div>

        <div class="form-field">
          <label for="flavor-cuisine-input">Cuisines (comma-separated)</label>
          <input
            id="flavor-cuisine-input"
            name="cuisineVibe"
            type="text"
            value="${escapeHtml(item.cuisineVibe)}"
            placeholder="e.g., Italian, French, Mexican, Indian"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="flavor-profile-input">Flavor Profile</label>
          <input
            id="flavor-profile-input"
            name="profile"
            type="text"
            value="${escapeHtml(item.profile)}"
            placeholder="e.g., Sweet licorice, delicate herbal"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="flavor-food-meats">Meats, Poultry &amp; Seafood Pairings</label>
          <input
            id="flavor-food-meats"
            name="foodMeats"
            type="text"
            value="${escapeHtml(fp.meats || '')}"
            placeholder="e.g., Roast chicken, lamb, salmon, pork chops"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="flavor-food-veg">Vegetables Pairings</label>
          <input
            id="flavor-food-veg"
            name="foodVegetables"
            type="text"
            value="${escapeHtml(fp.vegetables || '')}"
            placeholder="e.g., Carrots, potatoes, tomatoes, green beans, winter squash"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="flavor-food-soups">Soups, Salads &amp; Sauces Pairings</label>
          <input
            id="flavor-food-soups"
            name="foodSoupsSalads"
            type="text"
            value="${escapeHtml(fp.soupsSalads || '')}"
            placeholder="e.g., Minestrone, cucumber salad, pan gravies, vinaigrettes"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="flavor-food-appetizers">Appetizers, Eggs &amp; Baking Pairings</label>
          <input
            id="flavor-food-appetizers"
            name="foodAppetizersBaking"
            type="text"
            value="${escapeHtml(fp.appetizersBaking || '')}"
            placeholder="e.g., Deviled eggs, cheese spreads, pickles, spice cake"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="flavor-best-input">Top Foods Quick Highlights (comma-separated)</label>
          <input
            id="flavor-best-input"
            name="bestWith"
            type="text"
            value="${escapeHtml((item.bestWith || []).join(', '))}"
            placeholder="e.g., Roast Chicken, Eggs, Salmon, Tomatoes"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="flavor-pairs-input">Companion Herbs &amp; Spices (comma-separated tags or quick-add below)</label>
          <input
            id="flavor-pairs-input"
            name="pairsWellWith"
            type="text"
            value="${escapeHtml(companionNamesText)}"
            placeholder="e.g., Garlic, Lemon (Juice &amp; Zest), Thyme, Chives"
          />
          ${
            quickAddHerbs.length > 0
              ? `<div class="quick-add-companion-row">
                  <span class="tag-filter-label">Quick add:</span>
                  ${quickAddHerbs
                    .map(
                      (other) =>
                        `<button type="button" class="tag-chip" data-action="quick-add-companion-herb" data-herb-name="${escapeHtml(
                          other.name
                        )}">+ ${escapeHtml(other.name)}</button>`
                    )
                    .join('')}
                </div>`
              : ''
          }
        </div>

        <div class="form-field form-span-2">
          <label for="flavor-subs-input">Substitution When Out</label>
          <input
            id="flavor-subs-input"
            name="substitutes"
            type="text"
            value="${escapeHtml(item.substitutes)}"
            placeholder="e.g., Fresh dill + pinch of crushed fennel seed"
          />
        </div>
      </div>

      <div class="btn-row" style="margin-top: 12px;">
        <button type="submit" class="btn btn-primary">Save Herb Profile</button>
        <button type="button" class="btn btn-secondary" data-action="cancel-ref-edit">Cancel</button>
      </div>
    </form>
  `;
}

function renderHerbProfileCard({
  item,
  allFlavorsMap,
  isPinned,
  isCollapsed,
}) {
  const cardId = `herb-${item.id}`;
  const fp = item.foodPairings || {};

  const foodRows = [
    { label: 'Meats, Poultry & Seafood', val: fp.meats },
    { label: 'Vegetables', val: fp.vegetables },
    { label: 'Soups, Salads & Sauces', val: fp.soupsSalads },
    { label: 'Appetizers, Eggs & Baking', val: fp.appetizersBaking },
  ].filter((r) => String(r.val || '').trim());

  const pairsChipsHtml = (item.pairsWellWith || [])
    .map((pairEntry) => {
      const target = allFlavorsMap.get(pairEntry);
      const displayLabel = target ? target.name : pairEntry;
      if (!displayLabel) return '';
      return `<button type="button" class="tag-chip" data-action="select-flavor" ${
        target ? `data-flavor-id="${escapeHtml(target.id)}"` : ''
      } data-flavor-name="${escapeHtml(displayLabel)}">${escapeHtml(displayLabel)}</button>`;
    })
    .join('');

  const extraButtonsHtml = `
    <button type="button" class="btn btn-sm btn-outline" data-action="edit-flavor" data-flavor-id="${escapeHtml(
      item.id
    )}">Edit</button>
    <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-flavor" data-flavor-id="${escapeHtml(
      item.id
    )}">Delete</button>
  `;

  return `
    <article class="panel-card ref-card herb-profile-card ${isPinned ? 'is-pinned' : ''} ${
    isCollapsed ? 'is-collapsed' : ''
  }">
      <div class="ref-card-header">
        <div class="ref-card-title-group">
          <button
            type="button"
            class="ref-card-title-btn"
            data-action="toggle-collapse-ref-card"
            data-card-id="${escapeHtml(cardId)}"
            aria-expanded="${isCollapsed ? 'false' : 'true'}"
          >
            <h3 class="herb-profile-title">${escapeHtml(item.name)}</h3>
          </button>
          ${
            item.cuisineVibe
              ? `<span class="badge">${escapeHtml(item.cuisineVibe)}</span>`
              : ''
          }
        </div>
        ${renderRefCardControls({ cardId, isPinned, isCollapsed, extraButtonsHtml })}
      </div>

      <div class="ref-card-body">
        <div class="herb-horiz-body">
          <div class="herb-horiz-main">
            ${
              (item.bestWith || []).length > 0
                ? `<div class="flavor-chip-row herb-best-with-row">
                    ${item.bestWith.map((dish) => `<span class="badge badge-accent-soft">${escapeHtml(dish)}</span>`).join('')}
                  </div>`
                : ''
            }
            ${
              foodRows.length > 0
                ? `<div class="herb-food-pairings-grid">
                    ${foodRows
                      .map(
                        (row) => `
                          <div class="herb-food-row">
                            <span class="herb-food-cat">${escapeHtml(row.label)}</span>
                            <p class="herb-food-items">${escapeHtml(row.val)}</p>
                          </div>
                        `
                      )
                      .join('')}
                  </div>`
                : ''
            }
          </div>

          <div class="herb-horiz-side">
            ${
              item.profile
                ? `<p class="flavor-profile-text"><strong>Flavor Profile:</strong> ${escapeHtml(
                    item.profile
                  )}</p>`
                : ''
            }
            ${
              pairsChipsHtml
                ? `<div class="flavor-section">
                    <h4>Pairs Well With</h4>
                    <div class="flavor-chip-row">
                      ${pairsChipsHtml}
                    </div>
                  </div>`
                : ''
            }
            ${
              item.substitutes
                ? `<div class="flavor-sub-box">
                    <h4>Out of ${escapeHtml(item.name)}? Try Instead</h4>
                    <p>${escapeHtml(item.substitutes)}</p>
                  </div>`
                : ''
            }
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderHerbProfilesTab({
  flavors = [],
  herbCuisine = 'all',
  flavorQuery = '',
  editingFlavorId = null,
  pinnedSet,
  collapsedSet,
  pinnedOnly,
}) {
  const editingFlavor =
    editingFlavorId && editingFlavorId !== '__new__'
      ? flavors.find((f) => f.id === editingFlavorId) || null
      : null;

  const allFlavorsMap = new Map(flavors.map((f) => [f.id, f]));
  const cleanQuery = String(flavorQuery || '').trim().toLowerCase();

  // Extract distinct cuisine tags for filter pills
  const cuisineCounts = new Map();
  for (const item of flavors) {
    const tokens = String(item.cuisineVibe || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const tok of tokens) {
      cuisineCounts.set(tok, (cuisineCounts.get(tok) || 0) + 1);
    }
  }
  const topCuisines = Array.from(cuisineCounts.entries())
    .filter(([name, count]) => count >= 2 || name === herbCuisine)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12);

  const filtered = flavors.filter((item) => {
    const cardId = `herb-${item.id}`;
    if (pinnedOnly && !pinnedSet.has(cardId)) return false;
    if (herbCuisine && herbCuisine !== 'all') {
      const targetCuisine = herbCuisine.toLowerCase();
      const itemCuisines = String(item.cuisineVibe || '').toLowerCase();
      if (!itemCuisines.includes(targetCuisine)) return false;
    }
    if (!cleanQuery) return true;
    const fp = item.foodPairings || {};
    const companionNames = (item.pairsWellWith || [])
      .map((pid) => allFlavorsMap.get(pid)?.name || pid)
      .filter(Boolean);
    const hay = [
      item.name,
      item.profile,
      item.cuisineVibe,
      fp.meats,
      fp.vegetables,
      fp.soupsSalads,
      fp.appetizersBaking,
      ...(item.bestWith || []),
      ...companionNames,
      item.substitutes,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(cleanQuery);
  });

  const visible = sortPinnedFirst(filtered, (f) => `herb-${f.id}`, pinnedSet);
  const visibleIds = visible.map((f) => `herb-${f.id}`);

  const cuisineButtons = [
    `<button type="button" class="tag-pill ${
      herbCuisine === 'all' ? 'is-active' : ''
    }" data-action="select-herb-cuisine" data-cuisine="all">All (${flavors.length})</button>`,
    ...topCuisines.map(
      ([name, count]) => `<button type="button" class="tag-pill ${
        herbCuisine === name ? 'is-active' : ''
      }" data-action="select-herb-cuisine" data-cuisine="${escapeHtml(name)}">${escapeHtml(
        name
      )} (${count})</button>`
    ),
  ].join('');

  return `
    <div class="panel-card toolbar-card">
      <div class="collection-toolbar">
        <div class="toolbar-search">
          <label for="reference-flavor-search" class="sr-only">Search herbs by food, cuisine, or profile</label>
          <input
            id="reference-flavor-search"
            type="search"
            value="${escapeHtml(flavorQuery)}"
            placeholder="Search by food, cuisine, or herb (e.g., salmon, potatoes, Italian, basil, cinnamon)..."
          />
        </div>
        <div class="ref-toolbar-actions">
          ${renderBulkVisibilityButtons({
            visibleCardIds: visibleIds,
            collapsedSet,
            pinnedOnly,
          })}
          <button type="button" class="btn btn-primary" data-action="new-flavor">+ Add Herb / Spice</button>
          <button type="button" class="btn btn-outline" data-action="reset-ref-section" data-section="flavors">Reset Defaults</button>
        </div>
      </div>
      <div class="tag-filter-bar" aria-label="Filter herbs by cuisine">
        <span class="tag-filter-label">Cuisine:</span>
        ${cuisineButtons}
      </div>
    </div>

    ${editingFlavorId ? renderFlavorEditorForm(editingFlavor, flavors) : ''}

    ${
      visible.length > 0
        ? `<div class="herb-profile-grid">
            ${visible
              .map((item) =>
                renderHerbProfileCard({
                  item,
                  allFlavorsMap,
                  isPinned: pinnedSet.has(`herb-${item.id}`),
                  isCollapsed: collapsedSet.has(`herb-${item.id}`),
                })
              )
              .join('')}
          </div>`
        : '<div class="panel-card empty-state"><p class="muted">No matching herb or spice profiles. Adjust your search, turn off "Pinned Only", or add a custom profile.</p></div>'
    }
  `;
}

/**
 * Renders the Phase 4 Cooking Techniques & Reference Guide ("The Front Pocket").
 */
export function renderReferenceView({
  activeTab = 'converter',
  referenceData,
  converterState,
  subCategory = 'all',
  subQuery = '',
  editingSubId = null,
  chartQuery = '',
  storageQuery = '',
  editingStorageId = null,
  techniqueCategory = 'all',
  techniqueQuery = '',
  editingTechniqueId = null,
  herbCuisine = 'all',
  flavorQuery = '',
  editingFlavorId = null,
  pinnedCards,
  collapsedCards,
  pinnedOnly = false,
}) {
  const data = referenceData || getDefaultReferenceData();
  const pinnedSet = asIdSet(pinnedCards);
  const collapsedSet = asIdSet(collapsedCards);

  const tabsHtml = REF_TABS.map((tab) => {
    const active = activeTab === tab.id;
    return `<button
      type="button"
      class="binder-tab ${active ? 'is-active' : ''}"
      data-action="select-ref-tab"
      data-ref-tab="${escapeHtml(tab.id)}"
    >${escapeHtml(tab.label)}</button>`;
  }).join('');

  let bodyHtml = '';
  if (activeTab === 'substitutions') {
    bodyHtml = renderSubstitutionsTab({
      substitutions: data.substitutions || [],
      subCategory,
      subQuery,
      editingSubId,
      pinnedSet,
      collapsedSet,
      pinnedOnly,
    });
  } else if (activeTab === 'charts') {
    bodyHtml = renderChartsTab(chartQuery, pinnedSet, collapsedSet, pinnedOnly);
  } else if (activeTab === 'storage') {
    bodyHtml = renderStorageTab({
      storageTimes: data.storageTimes || [],
      storageQuery,
      editingStorageId,
      pinnedSet,
      collapsedSet,
      pinnedOnly,
    });
  } else if (activeTab === 'techniques') {
    bodyHtml = renderTechniquesTab({
      techniques: data.techniques || [],
      category: techniqueCategory,
      query: techniqueQuery,
      editingTechniqueId,
      pinnedSet,
      collapsedSet,
      pinnedOnly,
    });
  } else if (activeTab === 'flavor') {
    bodyHtml = renderHerbProfilesTab({
      flavors: data.flavors || [],
      herbCuisine,
      flavorQuery,
      editingFlavorId,
      pinnedSet,
      collapsedSet,
      pinnedOnly,
    });
  } else {
    bodyHtml = renderConverterTab(converterState, pinnedSet, collapsedSet);
  }

  return `
    <section class="reference-shell">
      <div class="detail-action-bar">
        <button type="button" class="btn btn-secondary" data-action="back-collection">← Collection</button>
        <h1 class="editor-heading">Front Pocket — Reference Guide &amp; Converter</h1>
      </div>

      <div class="binder-tabs-bar" role="tablist" aria-label="Reference Guide Sections">
        ${tabsHtml}
      </div>

      ${bodyHtml}
    </section>
  `;
}

/**
 * Renders the pop-up Technique Card modal when clicking a linked keyword inside recipe instructions.
 */
export function renderTechniqueModal(techniqueId, techniques = TECHNIQUE_CARDS) {
  if (!techniqueId) return '';
  const tech = getTechniqueById(techniqueId, techniques);
  if (!tech) return '';

  return `
    <div
      class="modal-backdrop no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="technique-modal-title"
      data-action="close-technique-modal"
    >
      <div class="modal-card panel-card">
        <div class="modal-header">
          <div class="card-badges-group">
            <span class="badge badge-divider">${escapeHtml(tech.category)}</span>
            <span class="badge">${escapeHtml(tech.time)}</span>
          </div>
          <button type="button" class="btn btn-sm btn-secondary" data-action="close-technique-modal">Close</button>
        </div>

        <h2 id="technique-modal-title" class="technique-modal-title">${escapeHtml(tech.title)}</h2>
        <p class="technique-summary">${escapeHtml(tech.summary)}</p>

        <ol class="technique-steps">
          ${(tech.steps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>

        ${
          tech.visualCue
            ? `<div class="technique-cue-box"><strong>Visual Cue:</strong> ${escapeHtml(tech.visualCue)}</div>`
            : ''
        }
        ${
          tech.commonMistake
            ? `<div class="technique-mistake-box"><strong>Avoid:</strong> ${escapeHtml(tech.commonMistake)}</div>`
            : ''
        }

        <div class="btn-row" style="margin-top: 14px; justify-content: flex-end;">
          <button type="button" class="btn btn-outline" data-action="open-reference-techniques">Browse All Techniques →</button>
          <button type="button" class="btn btn-primary" data-action="close-technique-modal">Back to Recipe</button>
        </div>
      </div>
    </div>
  `;
}
