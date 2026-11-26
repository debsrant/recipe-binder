import { formatQuantity, scaleIngredientLine } from '../lib/scaling.js';
import { escapeHtml, formatDateShort, formatMinutes } from './helpers.js';

const SCALE_OPTIONS = [0.5, 1, 2, 3];

function renderScaleButtons(scaleFactor) {
  return SCALE_OPTIONS.map((factor) => {
    const label = `${factor}x`;
    const active = Number(scaleFactor) === factor;
    return `<button type="button" class="seg-btn ${active ? 'is-active' : ''}" data-action="set-scale" data-scale="${factor}">${label}</button>`;
  }).join('');
}

function renderClassicSheet({
  recipe,
  dividerName,
  scaleFactor,
  scaledServings,
  totalMin,
  extraClass = '',
}) {
  const ingredients = recipe.ingredients || [];
  const steps = recipe.steps || [];
  const twoColClass = ingredients.length >= 6 ? 'is-two-col' : '';

  const ingredientsListHtml =
    ingredients.length > 0
      ? `<ul class="classic-ingredients-list ${twoColClass}">
          ${ingredients
            .map((line) => `<li>${escapeHtml(scaleIngredientLine(line, scaleFactor))}</li>`)
            .join('')}
        </ul>`
      : '<p class="muted">No ingredients listed.</p>';

  const stepsListHtml =
    steps.length > 0
      ? `<ol class="classic-steps-list">
          ${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
        </ol>`
      : '<p class="muted">No instructions listed.</p>';

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
          <span><strong>Prep:</strong> ${escapeHtml(formatMinutes(recipe.prepMinutes))}</span>
          <span class="classic-meta-sep" aria-hidden="true">·</span>
          <span><strong>Cook:</strong> ${escapeHtml(formatMinutes(recipe.cookMinutes))}</span>
          <span class="classic-meta-sep" aria-hidden="true">·</span>
          <span><strong>Total:</strong> ${escapeHtml(formatMinutes(totalMin))}</span>
          <span class="classic-meta-sep" aria-hidden="true">·</span>
          <span><strong>Yield:</strong> ${escapeHtml(scaledServings)} servings${
            scaleFactor !== 1 ? ` (${scaleFactor}x)` : ''
          }</span>
        </div>
      </header>

      <section class="classic-section">
        <h2>Ingredients${scaleFactor !== 1 ? ` (${scaleFactor}x)` : ''}</h2>
        ${ingredientsListHtml}
      </section>

      <section class="classic-section">
        <h2>Directions</h2>
        ${stepsListHtml}
      </section>

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

export function renderDetailView({
  recipe,
  dividers,
  scaleFactor,
  checkedIngredients,
  checkedSteps,
  wakeLockActive,
  wakeLockSupported,
  detailLayout = 'binder',
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

  const dividerName = (dividers || []).find((d) => d.id === recipe.dividerId)?.name || 'Unfiled';
  const totalMin = (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0);
  const scaledServings = formatQuantity((recipe.servings || 4) * scaleFactor) || String(recipe.servings || 4);
  const hasChecks = (checkedIngredients?.size || 0) > 0 || (checkedSteps?.size || 0) > 0;
  const scaleButtonsHtml = renderScaleButtons(scaleFactor);
  const isClassic = detailLayout === 'classic';

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
        <button type="button" class="btn btn-outline" data-action="export-recipe-md" data-recipe-id="${escapeHtml(
          recipe.id
        )}">Export .md</button>
        <button type="button" class="btn btn-primary" data-action="print-recipe">Print Recipe</button>
        <button type="button" class="btn btn-danger-outline" data-action="delete-recipe" data-recipe-id="${escapeHtml(
          recipe.id
        )}">Delete</button>
      </div>
    </div>
  `;

  const classicSheetHtml = renderClassicSheet({
    recipe,
    dividerName,
    scaleFactor,
    scaledServings,
    totalMin,
    extraClass: isClassic ? '' : 'print-only',
  });

  if (isClassic) {
    return `
      <section class="detail-shell">
        ${actionBarHtml}
        <div class="classic-scale-bar no-print">
          <span class="classic-scale-label">Scale Batch:</span>
          <div class="seg-control" role="group" aria-label="Scale recipe">
            ${scaleButtonsHtml}
          </div>
          <span class="muted classic-scale-hint">Formatted for traditional cookbook reading &amp; printing</span>
        </div>
        ${classicSheetHtml}
      </section>
    `;
  }

  const ingredientsHtml =
    (recipe.ingredients || []).length > 0
      ? recipe.ingredients
          .map((line, index) => {
            const scaled = scaleIngredientLine(line, scaleFactor);
            const checked = checkedIngredients?.has(index);
            return `<li class="check-item ${checked ? 'is-checked' : ''}">
              <label class="check-label">
                <input
                  type="checkbox"
                  data-action="toggle-ingredient-check"
                  data-index="${index}"
                  ${checked ? 'checked' : ''}
                />
                <span>${escapeHtml(scaled)}</span>
              </label>
            </li>`;
          })
          .join('')
      : '<li class="muted">No ingredients listed.</li>';

  const stepsHtml =
    (recipe.steps || []).length > 0
      ? recipe.steps
          .map((step, index) => {
            const checked = checkedSteps?.has(index);
            return `<li class="step-item ${checked ? 'is-checked' : ''}">
              <label class="step-label">
                <input
                  type="checkbox"
                  data-action="toggle-step-check"
                  data-index="${index}"
                  ${checked ? 'checked' : ''}
                />
                <span class="step-num">${index + 1}.</span>
                <span class="step-text">${escapeHtml(step)}</span>
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

  return `
    <section class="detail-shell">
      ${actionBarHtml}

      <div class="no-print">
        <article class="panel-card detail-header-card">
          <div class="detail-header-top">
            <span class="badge badge-divider">${escapeHtml(dividerName)}</span>
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
              <span class="kpi-label">Cook</span>
              <span class="kpi-value">${escapeHtml(formatMinutes(recipe.cookMinutes))}</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-label">Total</span>
              <span class="kpi-value">${escapeHtml(formatMinutes(totalMin))}</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-label">Yield (${scaleFactor}x)</span>
              <span class="kpi-value">${escapeHtml(scaledServings)} servings</span>
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
          </div>

          <div class="spread-right">
            <section class="panel-card">
              <h2>Instructions</h2>
              <ol class="steps-list">
                ${stepsHtml}
              </ol>
            </section>
          </div>
        </div>
      </div>

      ${classicSheetHtml}
    </section>
  `;
}
