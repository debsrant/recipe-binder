import {
  FLAVOR_FAMILIES,
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
  { id: 'techniques', label: 'Technique Cards' },
  { id: 'flavor', label: 'Flavor Pairing Wheel' },
];

const DEFAULT_TECHNIQUE_CATEGORIES = ['Heat & Sauces', 'Baking & Dairy', 'Knife Skills', 'Prep'];

function getModeUnitOptions(mode) {
  if (mode === 'volume') return Object.values(VOLUME_UNITS);
  if (mode === 'weight') return Object.values(WEIGHT_UNITS);
  if (mode === 'temperature') return Object.values(TEMP_UNITS);
  return [...Object.values(VOLUME_UNITS), ...Object.values(WEIGHT_UNITS)];
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

function renderConverterTab(converterState) {
  const mode = converterState?.mode || 'volume-weight';
  const unitsList = getModeUnitOptions(mode);
  const fromUnit = converterState?.fromUnit || 'cup';
  const toUnit = converterState?.toUnit || 'g';
  const ingredientId = converterState?.ingredientId || 'ap-flour';
  const showDensitySelect = mode === 'volume-weight';

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
    <div class="panel-card">
      <h2>Kitchen Unit of Measure Converter</h2>
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

  const visibleRows = substitutions.filter((item) => {
    if (subCategory && subCategory !== 'all' && (item.category || 'Other') !== subCategory) {
      return false;
    }
    if (!cleanQuery) return true;
    return [item.missing, item.category, item.amount, item.substitute, item.notes]
      .join(' ')
      .toLowerCase()
      .includes(cleanQuery);
  });

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

    <div class="panel-card">
      <h2>Ingredient &amp; Spice Substitutions (${visibleRows.length})</h2>
      <div class="ref-table-wrap">
        <table class="ref-table">
          <thead>
            <tr>
              <th>Missing Item</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Substitute With</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              visibleRows.length > 0
                ? visibleRows
                    .map(
                      (r) => `<tr>
                        <td><strong>${escapeHtml(r.missing)}</strong></td>
                        <td><span class="badge">${escapeHtml(r.category || 'Other')}</span></td>
                        <td class="mono-cell">${escapeHtml(r.amount)}</td>
                        <td>${escapeHtml(r.substitute)}</td>
                        <td>${escapeHtml(r.notes)}</td>
                        <td class="table-actions-cell">
                          <button type="button" class="btn btn-sm btn-outline" data-action="edit-substitution" data-sub-id="${escapeHtml(
                            r.id
                          )}">Edit</button>
                          <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-substitution" data-sub-id="${escapeHtml(
                            r.id
                          )}">Delete</button>
                        </td>
                      </tr>`
                    )
                    .join('')
                : '<tr><td colspan="6" class="muted">No matching substitutions. Add a custom entry or reset defaults.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function matchesFilter(rowValues, cleanQuery) {
  if (!cleanQuery) return true;
  return rowValues.join(' ').toLowerCase().includes(cleanQuery);
}

function renderChartsTab(chartQuery = '') {
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
      </div>
    </div>

    <div class="panel-card">
      <h2>Internal Meat &amp; Baking Temperatures</h2>
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
    </div>

    <div class="panel-card">
      <h2>Grain &amp; Legume-to-Water Ratios (per 1 cup dry)</h2>
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
    </div>

    <div class="panel-card">
      <h2>Cooking Oil Smoke Points</h2>
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
    </div>
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
    <h3 class="technique-card-title">${escapeHtml(tech.title)}</h3>
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
  `;
}

function renderTechniquesTab({
  techniques = [],
  category = 'all',
  query = '',
  editingTechniqueId = null,
}) {
  const cleanQuery = String(query || '').trim().toLowerCase();
  const visible = techniques.filter((t) => {
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
              .map(
                (tech) => `<article class="panel-card technique-card">
                  <div class="technique-card-top modal-header">
                    <div class="card-badges-group">
                      <span class="badge badge-divider">${escapeHtml(tech.category)}</span>
                      <span class="badge">${escapeHtml(tech.time)}</span>
                    </div>
                    <div class="table-actions-cell">
                      <button type="button" class="btn btn-sm btn-outline" data-action="edit-technique" data-technique-id="${escapeHtml(
                        tech.id
                      )}">Edit</button>
                      <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-technique" data-technique-id="${escapeHtml(
                        tech.id
                      )}">Delete</button>
                    </div>
                  </div>
                  ${renderTechniqueCardBody(tech)}
                  <div class="technique-keywords-row">
                    <span class="muted">Recipe auto-links:</span>
                    ${
                      (tech.keywords || []).length > 0
                        ? tech.keywords.map((kw) => `<code>${escapeHtml(kw)}</code>`).join(' ')
                        : '<span class="muted">(none)</span>'
                    }
                  </div>
                </article>`
              )
              .join('')}
          </div>`
        : '<div class="panel-card empty-state"><p class="muted">No matching cooking techniques found. Add one or reset defaults.</p></div>'
    }
  `;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildWedgePath(cx, cy, innerR, outerR, startDeg, endDeg) {
  const p1 = polarToCartesian(cx, cy, outerR, startDeg);
  const p2 = polarToCartesian(cx, cy, outerR, endDeg);
  const p3 = polarToCartesian(cx, cy, innerR, endDeg);
  const p4 = polarToCartesian(cx, cy, innerR, startDeg);
  return [
    `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`,
    `A ${outerR} ${outerR} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
    `L ${p3.x.toFixed(1)} ${p3.y.toFixed(1)}`,
    `A ${innerR} ${innerR} 0 0 0 ${p4.x.toFixed(1)} ${p4.y.toFixed(1)}`,
    'Z',
  ].join(' ');
}

function renderFlavorEditorForm(editingFlavor, allFlavors) {
  const isNew = !editingFlavor;
  const item = editingFlavor || {
    id: '',
    name: '',
    familyId: FLAVOR_FAMILIES[0].id,
    profile: '',
    cuisineVibe: '',
    bestWith: [],
    pairsWellWith: [],
    substitutes: '',
  };

  const familyOptions = FLAVOR_FAMILIES.map(
    (fam) =>
      `<option value="${escapeHtml(fam.id)}" ${item.familyId === fam.id ? 'selected' : ''}>${escapeHtml(
        fam.name
      )}</option>`
  ).join('');

  const selectedPairs = new Set(item.pairsWellWith || []);
  const pairCheckboxes = (allFlavors || [])
    .filter((other) => other.id !== item.id)
    .map(
      (other) => `<label class="flavor-pair-check-chip">
        <input
          type="checkbox"
          name="pairsWellWith"
          value="${escapeHtml(other.id)}"
          ${selectedPairs.has(other.id) ? 'checked' : ''}
        />
        <span>${escapeHtml(other.name)}</span>
      </label>`
    )
    .join('');

  return `
    <form id="ref-flavor-form" class="panel-card ref-editor-card" data-flavor-id="${escapeHtml(item.id)}">
      <h2>${isNew ? 'Add Herb / Spice to Flavor Wheel' : `Edit Flavor: ${escapeHtml(item.name)}`}</h2>
      <div class="form-grid">
        <div class="form-field">
          <label for="flavor-name-input">Herb / Spice Name (required)</label>
          <input
            id="flavor-name-input"
            name="name"
            type="text"
            required
            value="${escapeHtml(item.name)}"
            placeholder="e.g., Tarragon, Fennel Seed"
          />
        </div>

        <div class="form-field">
          <label for="flavor-family-select">Flavor Family</label>
          <select id="flavor-family-select" name="familyId">
            ${familyOptions}
          </select>
        </div>

        <div class="form-field">
          <label for="flavor-profile-input">Flavor Profile</label>
          <input
            id="flavor-profile-input"
            name="profile"
            type="text"
            value="${escapeHtml(item.profile)}"
            placeholder="e.g., Sweet licorice, delicate herbal"
          />
        </div>

        <div class="form-field">
          <label for="flavor-cuisine-input">Cuisine Vibe</label>
          <input
            id="flavor-cuisine-input"
            name="cuisineVibe"
            type="text"
            value="${escapeHtml(item.cuisineVibe)}"
            placeholder="e.g., French, Seafood, Roasted Chicken"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="flavor-best-input">Best With (comma-separated dishes/ingredients)</label>
          <input
            id="flavor-best-input"
            name="bestWith"
            type="text"
            value="${escapeHtml((item.bestWith || []).join(', '))}"
            placeholder="e.g., Roast Chicken, Eggs, Salmon, Béarnaise"
          />
        </div>

        ${
          pairCheckboxes
            ? `<div class="form-field form-span-2">
                <label>Pairs Well With</label>
                <div class="flavor-pair-checkboxes">
                  ${pairCheckboxes}
                </div>
              </div>`
            : ''
        }

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
        <button type="submit" class="btn btn-primary">Save Flavor Entry</button>
        <button type="button" class="btn btn-secondary" data-action="cancel-ref-edit">Cancel</button>
      </div>
    </form>
  `;
}

function renderFlavorWheelTab({
  flavors = [],
  selectedFlavorId = 'rosemary',
  editingFlavorId = null,
}) {
  const editingFlavor =
    editingFlavorId && editingFlavorId !== '__new__'
      ? flavors.find((f) => f.id === editingFlavorId) || null
      : null;

  if (flavors.length === 0) {
    return `
      ${editingFlavorId ? renderFlavorEditorForm(editingFlavor, flavors) : ''}
      <div class="panel-card empty-state">
        <h2>Flavor Pairing Wheel</h2>
        <p class="muted">No herbs or spices in your flavor wheel yet.</p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-action="new-flavor">+ Add Herb / Spice</button>
          <button type="button" class="btn btn-outline" data-action="reset-ref-section" data-section="flavors">Reset Defaults</button>
        </div>
      </div>
    `;
  }

  const activeFlavor = flavors.find((f) => f.id === selectedFlavorId) || flavors[0];
  const activeFamily =
    FLAVOR_FAMILIES.find((fam) => fam.id === activeFlavor.familyId) || FLAVOR_FAMILIES[0];

  const cx = 180;
  const cy = 180;
  const innerR = 54;
  const outerR = 162;
  const stepDeg = 360 / FLAVOR_FAMILIES.length;

  const wedgesHtml = FLAVOR_FAMILIES.map((fam, idx) => {
    const startDeg = idx * stepDeg;
    const endDeg = startDeg + stepDeg;
    const midDeg = startDeg + stepDeg / 2;
    const labelPos = polarToCartesian(cx, cy, (innerR + outerR) / 2, midDeg);
    const isActive = fam.id === activeFamily.id;
    const shortLabel = fam.name.split('&')[0].trim();

    return `
      <g
        class="flavor-wedge ${isActive ? 'is-active' : ''}"
        role="button"
        tabindex="0"
        data-action="select-flavor-family"
        data-family-id="${escapeHtml(fam.id)}"
        aria-label="${escapeHtml(fam.name)}"
      >
        <path
          d="${buildWedgePath(cx, cy, innerR, outerR, startDeg, endDeg)}"
          fill="${escapeHtml(fam.color)}"
          fill-opacity="${isActive ? '0.92' : '0.62'}"
          stroke="#f5f3ee"
          stroke-width="2"
        />
        <text
          x="${labelPos.x.toFixed(1)}"
          y="${labelPos.y.toFixed(1)}"
          text-anchor="middle"
          dominant-baseline="middle"
          class="flavor-wheel-label"
        >${escapeHtml(shortLabel)}</text>
      </g>
    `;
  }).join('');

  const familyItemsHtml = FLAVOR_FAMILIES.map((fam) => {
    const items = flavors.filter((p) => p.familyId === fam.id);
    if (items.length === 0) return '';
    return `
      <div class="flavor-family-group">
        <div class="flavor-family-heading">
          <span class="flavor-swatch" style="background: ${escapeHtml(fam.color)};"></span>
          <strong>${escapeHtml(fam.name)}</strong>
        </div>
        <div class="flavor-chip-row">
          ${items
            .map(
              (item) => `<button
                type="button"
                class="tag-pill ${item.id === activeFlavor.id ? 'is-active' : ''}"
                data-action="select-flavor"
                data-flavor-id="${escapeHtml(item.id)}"
              >${escapeHtml(item.name)}</button>`
            )
            .join('')}
        </div>
      </div>
    `;
  }).join('');

  const pairsChipsHtml = (activeFlavor.pairsWellWith || [])
    .map((pairId) => {
      const target = flavors.find((p) => p.id === pairId);
      if (!target) return '';
      return `<button type="button" class="tag-chip" data-action="select-flavor" data-flavor-id="${escapeHtml(
        target.id
      )}">${escapeHtml(target.name)}</button>`;
    })
    .join('');

  return `
    ${editingFlavorId ? renderFlavorEditorForm(editingFlavor, flavors) : ''}

    <div class="flavor-layout">
      <div class="panel-card flavor-wheel-panel">
        <div class="section-header-row">
          <h2>Interactive Flavor Pairing Wheel</h2>
          <div class="ref-toolbar-actions">
            <button type="button" class="btn btn-sm btn-primary" data-action="new-flavor">+ Add</button>
            <button type="button" class="btn btn-sm btn-outline" data-action="reset-ref-section" data-section="flavors">Reset</button>
          </div>
        </div>
        <p class="muted">Tap a flavor family wedge or pick an herb/spice below to improvise pairings and swaps.</p>
        <div class="flavor-wheel-wrap">
          <svg viewBox="0 0 360 360" class="flavor-wheel-svg" role="img" aria-label="Flavor pairing wheel">
            ${wedgesHtml}
            <circle cx="180" cy="180" r="50" class="flavor-wheel-hub" />
            <text x="180" y="174" text-anchor="middle" class="flavor-hub-title">${escapeHtml(
              activeFlavor.name
            )}</text>
            <text x="180" y="193" text-anchor="middle" class="flavor-hub-sub">${escapeHtml(
              activeFamily.name.split('&')[0].trim()
            )}</text>
          </svg>
        </div>
        <div class="flavor-families-list">
          ${familyItemsHtml}
        </div>
      </div>

      <div class="panel-card flavor-detail-panel">
        <div class="modal-header">
          <div class="card-badges-group">
            <span class="badge" style="background: ${escapeHtml(activeFamily.color)}; color: #ffffff; border-color: transparent;">${escapeHtml(
              activeFamily.name
            )}</span>
            ${
              activeFlavor.cuisineVibe
                ? `<span class="badge">${escapeHtml(activeFlavor.cuisineVibe)}</span>`
                : ''
            }
          </div>
          <div class="table-actions-cell">
            <button type="button" class="btn btn-sm btn-outline" data-action="edit-flavor" data-flavor-id="${escapeHtml(
              activeFlavor.id
            )}">Edit</button>
            <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-flavor" data-flavor-id="${escapeHtml(
              activeFlavor.id
            )}">Delete</button>
          </div>
        </div>

        <h2 class="flavor-detail-title">${escapeHtml(activeFlavor.name)}</h2>
        ${
          activeFlavor.profile
            ? `<p class="flavor-profile-text"><strong>Flavor Profile:</strong> ${escapeHtml(
                activeFlavor.profile
              )}</p>`
            : ''
        }

        <div class="flavor-section">
          <h3>Best With</h3>
          <div class="flavor-chip-row">
            ${
              (activeFlavor.bestWith || []).length > 0
                ? activeFlavor.bestWith.map((dish) => `<span class="badge">${escapeHtml(dish)}</span>`).join('')
                : '<span class="muted">None listed yet.</span>'
            }
          </div>
        </div>

        <div class="flavor-section">
          <h3>Pairs Well With (click to explore)</h3>
          <div class="flavor-chip-row">
            ${pairsChipsHtml || '<span class="muted">No pairings linked yet — click Edit to add pairings.</span>'}
          </div>
        </div>

        ${
          activeFlavor.substitutes
            ? `<div class="flavor-sub-box">
                <h3>Out of ${escapeHtml(activeFlavor.name)}? Try Instead</h3>
                <p>${escapeHtml(activeFlavor.substitutes)}</p>
              </div>`
            : ''
        }
      </div>
    </div>
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
  techniqueCategory = 'all',
  techniqueQuery = '',
  editingTechniqueId = null,
  selectedFlavorId = 'rosemary',
  editingFlavorId = null,
}) {
  const data = referenceData || getDefaultReferenceData();

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
    });
  } else if (activeTab === 'charts') {
    bodyHtml = renderChartsTab(chartQuery);
  } else if (activeTab === 'techniques') {
    bodyHtml = renderTechniquesTab({
      techniques: data.techniques || [],
      category: techniqueCategory,
      query: techniqueQuery,
      editingTechniqueId,
    });
  } else if (activeTab === 'flavor') {
    bodyHtml = renderFlavorWheelTab({
      flavors: data.flavors || [],
      selectedFlavorId,
      editingFlavorId,
    });
  } else {
    bodyHtml = renderConverterTab(converterState);
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
