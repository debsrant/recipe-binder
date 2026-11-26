import {
  FLAVOR_FAMILIES,
  FLAVOR_PAIRINGS,
  GRAIN_RATIOS,
  MEAT_TEMPERATURES,
  OIL_SMOKE_POINTS,
  SUBSTITUTIONS,
  TECHNIQUE_CARDS,
} from '../data/referenceGuide.js';
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
  { id: 'charts', label: 'Reference Charts' },
  { id: 'techniques', label: 'Technique Cards' },
  { id: 'flavor', label: 'Flavor Pairing Wheel' },
];

const TECHNIQUE_CATEGORIES = ['all', 'Heat & Sauces', 'Baking & Dairy', 'Knife Skills', 'Prep'];

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
  const subRows = SUBSTITUTIONS.filter((r) =>
    matchesFilter([r.missing, r.amount, r.substitute, r.notes], q)
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
            placeholder="Filter charts (e.g., chicken, rice, buttermilk, avocado oil)..."
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

    <div class="panel-card">
      <h2>Common Ingredient Substitutions</h2>
      <div class="ref-table-wrap">
        <table class="ref-table">
          <thead>
            <tr>
              <th>Missing Ingredient</th>
              <th>Amount</th>
              <th>Swap With</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${
              subRows.length > 0
                ? subRows
                    .map(
                      (r) => `<tr>
                        <td><strong>${escapeHtml(r.missing)}</strong></td>
                        <td class="mono-cell">${escapeHtml(r.amount)}</td>
                        <td>${escapeHtml(r.substitute)}</td>
                        <td>${escapeHtml(r.notes)}</td>
                      </tr>`
                    )
                    .join('')
                : '<tr><td colspan="4" class="muted">No matching substitutions.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTechniqueCardBody(tech) {
  return `
    <div class="technique-card-top">
      <div class="card-badges-group">
        <span class="badge badge-divider">${escapeHtml(tech.category)}</span>
        <span class="badge">${escapeHtml(tech.time)}</span>
      </div>
    </div>
    <h3 class="technique-card-title">${escapeHtml(tech.title)}</h3>
    <p class="technique-summary">${escapeHtml(tech.summary)}</p>
    <ol class="technique-steps">
      ${tech.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
    </ol>
    <div class="technique-cue-box">
      <strong>Visual Cue:</strong> ${escapeHtml(tech.visualCue)}
    </div>
    <div class="technique-mistake-box">
      <strong>Avoid:</strong> ${escapeHtml(tech.commonMistake)}
    </div>
  `;
}

function renderTechniquesTab(category = 'all', query = '') {
  const cleanQuery = String(query || '').trim().toLowerCase();
  const visible = TECHNIQUE_CARDS.filter((t) => {
    if (category && category !== 'all' && t.category !== category) return false;
    if (!cleanQuery) return true;
    const hay = [t.title, t.category, t.summary, t.visualCue, t.commonMistake, ...t.steps, ...t.keywords]
      .join(' ')
      .toLowerCase();
    return hay.includes(cleanQuery);
  });

  const catButtons = TECHNIQUE_CATEGORIES.map((cat) => {
    const label = cat === 'all' ? 'All Techniques' : cat;
    const active = category === cat;
    return `<button type="button" class="tag-pill ${active ? 'is-active' : ''}" data-action="select-technique-category" data-category="${escapeHtml(
      cat
    )}">${escapeHtml(label)}</button>`;
  }).join('');

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
      </div>
      <div class="tag-filter-bar" aria-label="Technique categories">
        <span class="tag-filter-label">Category:</span>
        ${catButtons}
      </div>
    </div>

    ${
      visible.length > 0
        ? `<div class="technique-grid">
            ${visible
              .map(
                (tech) => `<article class="panel-card technique-card">
                  ${renderTechniqueCardBody(tech)}
                  <div class="technique-keywords-row">
                    <span class="muted">Recipe auto-links:</span>
                    ${tech.keywords.map((kw) => `<code>${escapeHtml(kw)}</code>`).join(' ')}
                  </div>
                </article>`
              )
              .join('')}
          </div>`
        : '<div class="panel-card empty-state"><p class="muted">No matching cooking techniques found.</p></div>'
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

function renderFlavorWheelTab(selectedFlavorId = 'rosemary') {
  const activeFlavor =
    FLAVOR_PAIRINGS.find((f) => f.id === selectedFlavorId) || FLAVOR_PAIRINGS[0];
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
    const items = FLAVOR_PAIRINGS.filter((p) => p.familyId === fam.id);
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

  const pairsChipsHtml = activeFlavor.pairsWellWith
    .map((pairId) => {
      const target = FLAVOR_PAIRINGS.find((p) => p.id === pairId);
      if (!target) return '';
      return `<button type="button" class="tag-chip" data-action="select-flavor" data-flavor-id="${escapeHtml(
        target.id
      )}">${escapeHtml(target.name)}</button>`;
    })
    .join('');

  return `
    <div class="flavor-layout">
      <div class="panel-card flavor-wheel-panel">
        <h2>Interactive Flavor Pairing Wheel</h2>
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
        <div class="card-badges-group" style="margin-bottom: 8px;">
          <span class="badge" style="background: ${escapeHtml(activeFamily.color)}; color: #ffffff; border-color: transparent;">${escapeHtml(
            activeFamily.name
          )}</span>
          <span class="badge">${escapeHtml(activeFlavor.cuisineVibe)}</span>
        </div>
        <h2 class="flavor-detail-title">${escapeHtml(activeFlavor.name)}</h2>
        <p class="flavor-profile-text"><strong>Flavor Profile:</strong> ${escapeHtml(activeFlavor.profile)}</p>

        <div class="flavor-section">
          <h3>Best With</h3>
          <div class="flavor-chip-row">
            ${activeFlavor.bestWith
              .map((dish) => `<span class="badge">${escapeHtml(dish)}</span>`)
              .join('')}
          </div>
        </div>

        <div class="flavor-section">
          <h3>Pairs Well With (click to explore)</h3>
          <div class="flavor-chip-row">
            ${pairsChipsHtml}
          </div>
        </div>

        <div class="flavor-sub-box">
          <h3>Out of ${escapeHtml(activeFlavor.name)}? Try Instead</h3>
          <p>${escapeHtml(activeFlavor.substitutes)}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the Phase 4 Cooking Techniques & Reference Guide ("The Front Pocket").
 */
export function renderReferenceView({
  activeTab = 'converter',
  converterState,
  chartQuery = '',
  techniqueCategory = 'all',
  techniqueQuery = '',
  selectedFlavorId = 'rosemary',
}) {
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
  if (activeTab === 'charts') {
    bodyHtml = renderChartsTab(chartQuery);
  } else if (activeTab === 'techniques') {
    bodyHtml = renderTechniquesTab(techniqueCategory, techniqueQuery);
  } else if (activeTab === 'flavor') {
    bodyHtml = renderFlavorWheelTab(selectedFlavorId);
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
export function renderTechniqueModal(techniqueId) {
  if (!techniqueId) return '';
  const tech = getTechniqueById(techniqueId);
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
          ${tech.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
        </ol>

        <div class="technique-cue-box">
          <strong>Visual Cue:</strong> ${escapeHtml(tech.visualCue)}
        </div>
        <div class="technique-mistake-box">
          <strong>Avoid:</strong> ${escapeHtml(tech.commonMistake)}
        </div>

        <div class="btn-row" style="margin-top: 14px; justify-content: flex-end;">
          <button type="button" class="btn btn-outline" data-action="open-reference-techniques">Browse All Techniques →</button>
          <button type="button" class="btn btn-primary" data-action="close-technique-modal">Back to Recipe</button>
        </div>
      </div>
    </div>
  `;
}
