import {
  COOK_QA_QUICK_PROMPTS,
  METHOD_CONVERSION_PRESETS,
  getAiStatusLabel,
  isAiReady,
} from '../lib/ai.js';
import { getRecipeMethods } from '../lib/collection.js';
import { formatQuantity } from '../lib/scaling.js';
import { renderLinkedStepHtml } from '../lib/techniques.js';
import { convertIngredientLine } from '../lib/units.js';
import { escapeHtml, formatDateShort, formatMinutes } from './helpers.js';

const SCALE_OPTIONS = [0.5, 1, 2, 3];
const UNIT_MODES = [
  { id: 'original', label: 'Original' },
  { id: 'metric', label: 'g / ml' },
  { id: 'us-weight', label: 'oz / lb' },
];

function renderScaleButtons(scaleFactor) {
  return SCALE_OPTIONS.map((factor) => {
    const label = `${factor}x`;
    const active = Number(scaleFactor) === factor;
    return `<button type="button" class="seg-btn ${active ? 'is-active' : ''}" data-action="set-scale" data-scale="${factor}">${label}</button>`;
  }).join('');
}

function renderUnitModeButtons(unitMode) {
  return UNIT_MODES.map((m) => {
    const active = (unitMode || 'original') === m.id;
    return `<button type="button" class="seg-btn ${active ? 'is-active' : ''}" data-action="set-unit-mode" data-unit-mode="${m.id}">${escapeHtml(
      m.label
    )}</button>`;
  }).join('');
}

function formatRangeMinutes(minVal, maxVal) {
  if (minVal === maxVal) return formatMinutes(minVal);
  return `${formatMinutes(minVal)}–${formatMinutes(maxVal)}`;
}

function renderMethodTabsBar(methods, activeMethodIndex) {
  if (methods.length <= 1) return '';
  return `
    <div class="binder-tabs-bar method-tabs-bar no-print" role="tablist" aria-label="Cooking methods">
      ${methods
        .map((method, idx) => {
          const active = idx === activeMethodIndex;
          const label = method.name || `Method ${idx + 1}`;
          return `<button
            type="button"
            class="binder-tab method-tab ${active ? 'is-active' : ''}"
            role="tab"
            aria-selected="${active ? 'true' : 'false'}"
            data-action="select-method"
            data-method-index="${idx}"
          >
            <span>${escapeHtml(label)}</span>
            <span class="tab-count">${escapeHtml(formatMinutes(method.cookMinutes))}</span>
          </button>`;
        })
        .join('')}
    </div>
  `;
}

function renderClassicSheet({
  recipe,
  dividerName,
  scaleFactor,
  unitMode,
  scaledServings,
  methods,
  activeMethodIndex,
  techniques,
  showAllMethods = false,
  extraClass = '',
}) {
  const ingredients = recipe.ingredients || [];
  const twoColClass = ingredients.length >= 6 ? 'is-two-col' : '';
  const activeMethod = methods[activeMethodIndex] || methods[0];
  const prepMin = recipe.prepMinutes || 0;

  const cookValues = methods.map((m) => m.cookMinutes || 0);
  const minCook = Math.min(...cookValues);
  const maxCook = Math.max(...cookValues);
  const cookDisplay = showAllMethods
    ? formatRangeMinutes(minCook, maxCook)
    : formatMinutes(activeMethod.cookMinutes || 0);
  const totalDisplay = showAllMethods
    ? formatRangeMinutes(prepMin + minCook, prepMin + maxCook)
    : formatMinutes(prepMin + (activeMethod.cookMinutes || 0));

  const ingredientsListHtml =
    ingredients.length > 0
      ? `<ul class="classic-ingredients-list ${twoColClass}">
          ${ingredients
            .map((line) => `<li>${escapeHtml(convertIngredientLine(line, unitMode, scaleFactor))}</li>`)
            .join('')}
        </ul>`
      : '<p class="muted">No ingredients listed.</p>';

  let directionsHtml = '';
  if (showAllMethods) {
    directionsHtml = `
      <section class="classic-section">
        <h2>Directions</h2>
        ${methods
          .map((method, idx) => {
            const label = method.name || `Method ${idx + 1}`;
            const methodCook = method.cookMinutes || 0;
            const stepsHtml =
              (method.steps || []).length > 0
                ? `<ol class="classic-steps-list">
                    ${method.steps.map((step) => `<li>${renderLinkedStepHtml(step, escapeHtml, techniques)}</li>`).join('')}
                  </ol>`
                : '<p class="muted">No instructions listed.</p>';
            return `
              <div class="classic-method-block">
                <h3>
                  ${escapeHtml(label)}
                  <span class="classic-method-time">(Cook: ${escapeHtml(
                    formatMinutes(methodCook)
                  )} · Total: ${escapeHtml(formatMinutes(prepMin + methodCook))})</span>
                </h3>
                ${
                  method.note
                    ? `<p class="classic-method-note"><strong>Note:</strong> ${escapeHtml(method.note)}</p>`
                    : ''
                }
                ${stepsHtml}
              </div>
            `;
          })
          .join('')}
      </section>
    `;
  } else {
    const methodLabel = activeMethod.name || 'Standard';
    const stepsListHtml =
      (activeMethod.steps || []).length > 0
        ? `<ol class="classic-steps-list">
            ${activeMethod.steps.map((step) => `<li>${renderLinkedStepHtml(step, escapeHtml, techniques)}</li>`).join('')}
          </ol>`
        : '<p class="muted">No instructions listed.</p>';

    directionsHtml = `
      <section class="classic-section">
        <h2>Directions — ${escapeHtml(methodLabel)}</h2>
        ${
          activeMethod.note
            ? `<p class="classic-method-note"><strong>${escapeHtml(
                methodLabel
              )} Note:</strong> ${escapeHtml(activeMethod.note)}</p>`
            : ''
        }
        ${stepsListHtml}
      </section>
    `;
  }

  const tagsLine =
    (recipe.tags || []).length > 0
      ? `<footer class="classic-tags-footer no-print">
          <span>Filed under: ${recipe.tags.map((t) => `#${escapeHtml(t)}`).join(' · ')}</span>
        </footer>`
      : '';

  return `
    <article class="classic-sheet-card ${extraClass}">
      <header class="classic-sheet-header">
        <div class="classic-sheet-top">
          <span class="classic-kicker">${escapeHtml(dividerName)}</span>
        </div>
        <h1 class="classic-title">${escapeHtml(recipe.title)}</h1>
        ${
          recipe.source
            ? `<p class="classic-source">From: ${escapeHtml(recipe.source)}</p>`
            : ''
        }
        ${
          recipe.summary
            ? `<p class="classic-summary">${escapeHtml(recipe.summary)}</p>`
            : ''
        }
        <div class="classic-meta-bar">
          <span><strong>Prep:</strong> ${escapeHtml(formatMinutes(prepMin))}</span>
          <span class="classic-meta-sep" aria-hidden="true">·</span>
          <span><strong>Cook:</strong> ${escapeHtml(cookDisplay)}</span>
          <span class="classic-meta-sep" aria-hidden="true">·</span>
          <span><strong>Total:</strong> ${escapeHtml(totalDisplay)}</span>
          <span class="classic-meta-sep" aria-hidden="true">·</span>
          <span><strong>Yield:</strong> ${escapeHtml(scaledServings)} servings${
            recipe.servingSize ? ` (${escapeHtml(recipe.servingSize)} each)` : ''
          }${scaleFactor !== 1 ? ` (${scaleFactor}x)` : ''}</span>
        </div>
      </header>

      <section class="classic-section">
        <h2>Ingredients${scaleFactor !== 1 ? ` (${scaleFactor}x)` : ''}</h2>
        ${ingredientsListHtml}
      </section>

      ${directionsHtml}

      ${
        recipe.notes && String(recipe.notes).trim()
          ? `<aside class="classic-notes">
              <h3>Cook's Notes</h3>
              <p>${escapeHtml(recipe.notes)}</p>
            </aside>`
          : ''
      }

      ${tagsLine}
    </article>
  `;
}

function renderCookAiPanel({
  aiConfig,
  cookAiOpen = false,
  cookMethodTarget = 'Air Fryer',
  isGeneratingMethod = false,
  cookQaMessages = [],
  cookQaInput = '',
  isAskingCookQa = false,
  cookAiError = '',
  existingMethods = [],
}) {
  const aiReady = isAiReady(aiConfig);
  const aiLabel = getAiStatusLabel(aiConfig);
  const existingNames = new Set(
    (existingMethods || []).map((m) => String(m?.name || '').trim().toLowerCase()).filter(Boolean)
  );

  const presetButtons = METHOD_CONVERSION_PRESETS.map((name) => {
    const active = String(cookMethodTarget || '').trim().toLowerCase() === name.toLowerCase();
    const alreadyExists = existingNames.has(name.toLowerCase());
    return `<button
      type="button"
      class="tag-pill ${active ? 'is-active' : ''}"
      data-action="select-cook-method-preset"
      data-method-name="${escapeHtml(name)}"
      title="${alreadyExists ? `${name} already exists — click to generate another variant` : `Adapt for ${name}`}"
    >${escapeHtml(name)}${alreadyExists ? ' ✓' : ''}</button>`;
  }).join('');

  const quickPromptButtons = COOK_QA_QUICK_PROMPTS.map(
    (q) =>
      `<button type="button" class="tag-chip" data-action="cook-qa-quick-ask" data-question="${escapeHtml(
        q
      )}" ${isAskingCookQa ? 'disabled' : ''}>${escapeHtml(q)}</button>`
  ).join('');

  const threadHtml =
    cookQaMessages.length > 0
      ? `<div class="cook-qa-thread">
          ${cookQaMessages
            .map(
              (m) => `<div class="cook-qa-msg ${
                m.role === 'assistant' ? 'is-assistant' : 'is-user'
              }">
                <span class="cook-qa-role">${m.role === 'assistant' ? 'AI Cook Assistant' : 'You'}</span>
                <div>${escapeHtml(m.text)}</div>
              </div>`
            )
            .join('')}
        </div>`
      : '';

  return `
    <section
      id="cook-ai-panel"
      class="panel-card ref-card cook-ai-panel no-print ${cookAiOpen ? '' : 'is-collapsed'}"
    >
      <div class="ref-card-header">
        <div class="ref-card-title-group">
          <button
            type="button"
            class="ref-card-title-btn"
            data-action="toggle-cook-ai"
            aria-expanded="${cookAiOpen ? 'true' : 'false'}"
          >
            <h2>AI Cook Assistant</h2>
          </button>
          <button
            type="button"
            class="badge ai-status-pill ${aiReady ? 'is-ready' : ''}"
            data-action="open-ai-settings"
            title="Configure Local Ollama or Gemini API in Sync & Backup"
          >${escapeHtml(aiLabel)} · Settings →</button>
        </div>
        <div class="ref-card-controls">
          <button
            type="button"
            class="btn btn-sm btn-outline ref-collapse-btn"
            data-action="toggle-cook-ai"
            aria-expanded="${cookAiOpen ? 'true' : 'false'}"
          >${cookAiOpen ? 'Close ▴' : 'Open ▾'}</button>
        </div>
      </div>

      <div class="ref-card-body">
        ${
          cookAiError
            ? `<div class="callout-box callout-danger" style="margin-bottom: 10px;">${escapeHtml(
                cookAiError
              )}</div>`
            : ''
        }
        <div class="cook-ai-sections">
          <div class="cook-ai-section">
            <h3>Generate New Cooking Method Tab</h3>
            <p class="muted" style="margin: 0 0 8px;">
              Adapt this recipe for another appliance and save it as a new tab on this card.
            </p>
            <div class="flavor-chip-row" aria-label="Cooking method presets">
              ${presetButtons}
            </div>
            <form id="cook-generate-method-form" class="cook-method-form-row">
              <label for="cook-method-target-input" class="sr-only">Target cooking method</label>
              <input
                id="cook-method-target-input"
                name="targetMethod"
                type="text"
                value="${escapeHtml(cookMethodTarget)}"
                placeholder="e.g., Air Fryer, Instant Pot, Dutch Oven..."
                ${isGeneratingMethod ? 'disabled' : ''}
              />
              <button
                type="submit"
                class="btn btn-primary btn-sm"
                ${isGeneratingMethod ? 'disabled' : ''}
              >${isGeneratingMethod ? 'Generating Method…' : '+ Generate Method Tab'}</button>
            </form>
          </div>

          <div class="cook-ai-section">
            <div class="section-header-row" style="margin-bottom: 4px;">
              <h3 style="margin: 0;">Ask About This Recipe</h3>
              ${
                cookQaMessages.length > 0
                  ? '<button type="button" class="btn btn-sm btn-secondary" data-action="cook-qa-clear">Clear</button>'
                  : ''
              }
            </div>
            <p class="muted" style="margin: 0 0 8px;">
              Uses your current batch scale, converted units, active method, and margin notes.
            </p>
            <div class="flavor-chip-row">
              ${quickPromptButtons}
            </div>
            ${threadHtml}
            <form id="cook-ai-qa-form" class="cook-qa-form-row">
              <label for="cook-qa-input" class="sr-only">Ask a question about this recipe</label>
              <input
                id="cook-qa-input"
                name="question"
                type="text"
                value="${escapeHtml(cookQaInput)}"
                placeholder="Ask e.g., 'Can I use dried herbs instead?' or 'Sauce looks thin—fix?'"
                ${isAskingCookQa ? 'disabled' : ''}
              />
              <button
                type="submit"
                class="btn btn-primary btn-sm"
                ${isAskingCookQa ? 'disabled' : ''}
              >${isAskingCookQa ? 'Thinking…' : 'Ask'}</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function renderDetailView({
  recipe,
  dividers,
  scaleFactor,
  unitMode = 'original',
  checkedIngredients,
  checkedSteps,
  wakeLockActive,
  wakeLockSupported,
  detailLayout = 'binder',
  activeMethodIndex = 0,
  printMethodsMode = 'selected',
  techniques,
  linkedNotes = [],
  aiConfig = null,
  cookAiOpen = false,
  cookMethodTarget = 'Air Fryer',
  isGeneratingMethod = false,
  cookQaMessages = [],
  cookQaInput = '',
  isAskingCookQa = false,
  cookAiError = '',
}) {
  if (!recipe || recipe.deleted) {
    return `
      <div class="panel-card empty-state">
        <h2>Recipe card not found</h2>
        <p class="muted">This recipe may have been deleted on another device.</p>
        <button type="button" class="btn btn-primary" data-action="back-collection">← Back to Collection</button>
      </div>
    `;
  }

  const methods = getRecipeMethods(recipe);
  const methodIdx = Math.min(Math.max(0, Number(activeMethodIndex) || 0), methods.length - 1);
  const activeMethod = methods[methodIdx];
  const hasMultipleMethods = methods.length > 1;
  const printAllMethods = hasMultipleMethods && printMethodsMode === 'all';

  const dividerName = (dividers || []).find((d) => d.id === recipe.dividerId)?.name || 'Unfiled';
  const activeCookMin = activeMethod.cookMinutes || 0;
  const totalMin = (recipe.prepMinutes || 0) + activeCookMin;
  const scaledServings = formatQuantity((recipe.servings || 4) * scaleFactor) || String(recipe.servings || 4);
  const hasChecks = (checkedIngredients?.size || 0) > 0 || (checkedSteps?.size || 0) > 0;
  const scaleButtonsHtml = renderScaleButtons(scaleFactor);
  const unitButtonsHtml = renderUnitModeButtons(unitMode);
  const isClassic = detailLayout === 'classic';
  const methodTabsHtml = renderMethodTabsBar(methods, methodIdx);

  const printToggleHtml = hasMultipleMethods
    ? `<div class="seg-control" role="group" aria-label="Print methods option">
        <button
          type="button"
          class="seg-btn ${!printAllMethods ? 'is-active' : ''}"
          data-action="set-print-methods-mode"
          data-print-mode="selected"
          title="Print only the currently selected cooking method"
        >Print: Selected</button>
        <button
          type="button"
          class="seg-btn ${printAllMethods ? 'is-active' : ''}"
          data-action="set-print-methods-mode"
          data-print-mode="all"
          title="Print all cooking methods together"
        >Print: All</button>
      </div>`
    : '';

  const actionBarHtml = `
    <div class="detail-action-bar no-print">
      <div class="detail-action-left">
        <button type="button" class="btn btn-secondary" data-action="back-collection">← Collection</button>
        <div class="seg-control" role="group" aria-label="Recipe view format">
          <button
            type="button"
            class="seg-btn ${!isClassic ? 'is-active' : ''}"
            data-action="set-detail-layout"
            data-layout="binder"
          >Cook Mode</button>
          <button
            type="button"
            class="seg-btn ${isClassic ? 'is-active' : ''}"
            data-action="set-detail-layout"
            data-layout="classic"
          >Classic Sheet</button>
        </div>
      </div>

      <div class="detail-action-group">
        <button
          type="button"
          class="btn ${wakeLockActive ? 'btn-pine' : 'btn-outline'}"
          data-action="toggle-wake-lock"
          ${!wakeLockSupported ? 'title="Screen Wake Lock may not be supported in this browser"' : ''}
        >${wakeLockActive ? 'Screen Awake: ON' : 'Keep Awake'}</button>
        <button
          type="button"
          class="btn ${recipe.favorite ? 'btn-fav-active' : 'btn-outline'}"
          data-action="toggle-favorite"
          data-recipe-id="${escapeHtml(recipe.id)}"
        >${recipe.favorite ? 'Favorited' : 'Favorite'}</button>
        <button type="button" class="btn btn-outline" data-action="edit-recipe" data-recipe-id="${escapeHtml(
          recipe.id
        )}">Edit</button>
        <button type="button" class="btn btn-outline" data-action="duplicate-recipe" data-recipe-id="${escapeHtml(
          recipe.id
        )}">Duplicate</button>
        <button type="button" class="btn btn-outline" data-action="send-recipe-to-freezer" data-recipe-id="${escapeHtml(
          recipe.id
        )}">Send to Freezer</button>
        <button type="button" class="btn btn-outline" data-action="export-recipe-md" data-recipe-id="${escapeHtml(
          recipe.id
        )}">Export .md</button>
        <button
          type="button"
          class="btn ${cookAiOpen ? 'btn-primary' : 'btn-outline'}"
          data-action="toggle-cook-ai"
        >AI Cook Assistant</button>
        ${printToggleHtml}
        <button type="button" class="btn btn-primary" data-action="print-recipe">Print Recipe</button>
        <button type="button" class="btn btn-danger-outline" data-action="delete-recipe" data-recipe-id="${escapeHtml(
          recipe.id
        )}">Delete</button>
      </div>
    </div>
  `;

  const cookAiPanelHtml = renderCookAiPanel({
    aiConfig,
    cookAiOpen,
    cookMethodTarget,
    isGeneratingMethod,
    cookQaMessages,
    cookQaInput,
    isAskingCookQa,
    cookAiError,
    existingMethods: methods,
  });

  if (isClassic) {
    const classicBodyHtml = printAllMethods
      ? `
        ${renderClassicSheet({
          recipe,
          dividerName,
          scaleFactor,
          unitMode,
          scaledServings,
          methods,
          activeMethodIndex: methodIdx,
          techniques,
          showAllMethods: false,
          extraClass: 'no-print',
        })}
        ${renderClassicSheet({
          recipe,
          dividerName,
          scaleFactor,
          unitMode,
          scaledServings,
          methods,
          activeMethodIndex: methodIdx,
          techniques,
          showAllMethods: true,
          extraClass: 'print-only',
        })}
      `
      : renderClassicSheet({
          recipe,
          dividerName,
          scaleFactor,
          unitMode,
          scaledServings,
          methods,
          activeMethodIndex: methodIdx,
          techniques,
          showAllMethods: false,
          extraClass: '',
        });

    return `
      <section class="detail-shell">
        ${actionBarHtml}
        ${methodTabsHtml}
        <div class="classic-scale-bar no-print">
          <span class="classic-scale-label">Scale:</span>
          <div class="seg-control" role="group" aria-label="Scale recipe">
            ${scaleButtonsHtml}
          </div>
          <span class="classic-scale-label">Units:</span>
          <div class="seg-control" role="group" aria-label="Convert ingredient units">
            ${unitButtonsHtml}
          </div>
        </div>
        ${cookAiPanelHtml}
        ${classicBodyHtml}
      </section>
    `;
  }

  const ingredientsHtml =
    (recipe.ingredients || []).length > 0
      ? recipe.ingredients
          .map((line, index) => {
            const converted = convertIngredientLine(line, unitMode, scaleFactor);
            const checked = checkedIngredients?.has(index);
            return `<li class="check-item ${checked ? 'is-checked' : ''}">
              <label class="check-label">
                <input
                  type="checkbox"
                  data-action="toggle-ingredient-check"
                  data-index="${index}"
                  ${checked ? 'checked' : ''}
                />
                <span>${escapeHtml(converted)}</span>
              </label>
            </li>`;
          })
          .join('')
      : '<li class="muted">No ingredients listed.</li>';

  const stepsHtml =
    (activeMethod.steps || []).length > 0
      ? activeMethod.steps
          .map((step, index) => {
            const stepKey = `${methodIdx}:${index}`;
            const checked = checkedSteps?.has(stepKey);
            return `<li class="step-item ${checked ? 'is-checked' : ''}">
              <label class="step-label">
                <input
                  type="checkbox"
                  data-action="toggle-step-check"
                  data-step-key="${escapeHtml(stepKey)}"
                  ${checked ? 'checked' : ''}
                />
                <span class="step-num">${index + 1}.</span>
                <span class="step-text">${renderLinkedStepHtml(step, escapeHtml, techniques)}</span>
              </label>
            </li>`;
          })
          .join('')
      : '<li class="muted">No instructions listed.</li>';

  const tagsHtml = (recipe.tags || []).length
    ? `<div class="detail-tags">
        ${recipe.tags
          .map(
            (tag) =>
              `<button type="button" class="tag-chip" data-action="jump-tag" data-tag="${escapeHtml(
                tag
              )}">#${escapeHtml(tag)}</button>`
          )
          .join('')}
      </div>`
    : '';

  const activeMethodBadgeLabel = activeMethod.name || 'Standard';

  const printSheetHtml = renderClassicSheet({
    recipe,
    dividerName,
    scaleFactor,
    unitMode,
    scaledServings,
    methods,
    activeMethodIndex: methodIdx,
    techniques,
    showAllMethods: printAllMethods,
    extraClass: 'print-only',
  });

  return `
    <section class="detail-shell">
      ${actionBarHtml}

      <div class="no-print">
        <article class="panel-card detail-header-card">
          <div class="detail-header-top">
            <div class="card-badges-group">
              <span class="badge badge-divider">${escapeHtml(dividerName)}</span>
              <span class="badge badge-method">${escapeHtml(activeMethodBadgeLabel)}</span>
            </div>
            <span class="detail-updated">Updated ${escapeHtml(formatDateShort(recipe.updatedMs))}</span>
          </div>

          <h1 class="detail-title">${escapeHtml(recipe.title)}</h1>

          ${
            recipe.source
              ? `<p class="detail-source">Source: ${escapeHtml(recipe.source)}</p>`
              : ''
          }
          ${
            recipe.summary
              ? `<p class="detail-summary">${escapeHtml(recipe.summary)}</p>`
              : ''
          }

          <div class="detail-kpi-strip">
            <div class="kpi-box">
              <span class="kpi-label">Prep</span>
              <span class="kpi-value">${escapeHtml(formatMinutes(recipe.prepMinutes))}</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-label">Cook (${escapeHtml(activeMethodBadgeLabel)})</span>
              <span class="kpi-value">${escapeHtml(formatMinutes(activeCookMin))}</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-label">Total</span>
              <span class="kpi-value">${escapeHtml(formatMinutes(totalMin))}</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-label">Yield (${scaleFactor}x)</span>
              <span class="kpi-value">${escapeHtml(scaledServings)} servings${
                recipe.servingSize ? ` · ${escapeHtml(recipe.servingSize)}` : ''
              }</span>
            </div>
            <div class="kpi-box kpi-scale-box">
              <span class="kpi-label">Scale Batch</span>
              <div class="seg-control" role="group" aria-label="Scale recipe">
                ${scaleButtonsHtml}
              </div>
            </div>
          </div>

          ${tagsHtml}
        </article>

        ${methodTabsHtml}

        <div class="binder-spread">
          <div class="spread-left">
            <section class="panel-card">
              <div class="section-header-row">
                <h2>Ingredients (${scaleFactor}x)</h2>
                ${
                  hasChecks
                    ? '<button type="button" class="btn btn-sm btn-secondary" data-action="reset-checks">Reset Checks</button>'
                    : ''
                }
              </div>
              <div class="unit-toggle-row">
                <span class="classic-scale-label">Units:</span>
                <div class="seg-control" role="group" aria-label="Convert ingredient units">
                  ${unitButtonsHtml}
                </div>
              </div>
              <ul class="ingredient-list">
                ${ingredientsHtml}
              </ul>
            </section>

            <section class="panel-card margin-notes-card">
              <h2>Cook's Margin Notes</h2>
              <p class="${recipe.notes ? 'margin-notes-text' : 'muted'}">
                ${
                  recipe.notes
                    ? escapeHtml(recipe.notes)
                    : 'No margin notes yet. Edit this card after cooking to save tweaks and reminders.'
                }
              </p>
            </section>

            ${
              (linkedNotes || []).length > 0
                ? `<section class="panel-card linked-notes-card no-print">
                    <h2>Linked Notes, Videos &amp; Files</h2>
                    <ul class="linked-notes-list">
                      ${linkedNotes
                        .map((note) => {
                          const typeLabel =
                            note.type === 'video'
                              ? 'Video'
                              : note.type === 'website'
                              ? 'Website'
                              : note.type === 'file'
                              ? 'File / PDF'
                              : 'Note';
                          const safeUrl = /^https?:\/\//i.test(note.url || '') ? note.url : '';
                          return `<li class="linked-note-row">
                            <div class="linked-note-info">
                              <span class="badge badge-divider">${escapeHtml(typeLabel)}</span>
                              <strong>${escapeHtml(note.title)}</strong>
                            </div>
                            <div class="linked-note-actions">
                              ${
                                safeUrl
                                  ? `<a class="btn btn-sm btn-outline" href="${escapeHtml(
                                      safeUrl
                                    )}" target="_blank" rel="noopener noreferrer">Open ↗</a>`
                                  : ''
                              }
                              <button
                                type="button"
                                class="btn btn-sm btn-outline"
                                data-action="open-note-in-tab"
                                data-note-id="${escapeHtml(note.id)}"
                              >View in Notes</button>
                            </div>
                          </li>`;
                        })
                        .join('')}
                    </ul>
                  </section>`
                : ''
            }
          </div>

          <div class="spread-right">
            <section class="panel-card">
              <div class="section-header-row">
                <h2>Instructions</h2>
                <span class="badge badge-method">${escapeHtml(activeMethodBadgeLabel)}</span>
              </div>
              ${
                activeMethod.note
                  ? `<p class="method-note-callout"><strong>${escapeHtml(
                      activeMethodBadgeLabel
                    )} Note:</strong> ${escapeHtml(activeMethod.note)}</p>`
                  : ''
              }
              <ol class="steps-list">
                ${stepsHtml}
              </ol>
            </section>
            ${cookAiPanelHtml}
          </div>
        </div>
      </div>

      ${printSheetHtml}
    </section>
  `;
}
