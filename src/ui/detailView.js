import { formatQuantity, scaleIngredientLine } from '../lib/scaling.js';
import { escapeHtml, formatDateShort, formatMinutes } from './helpers.js';

const SCALE_OPTIONS = [0.5, 1, 2, 3];

export function renderDetailView({
  recipe,
  dividers,
  scaleFactor,
  checkedIngredients,
  checkedSteps,
  wakeLockActive,
  wakeLockSupported,
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

  const scaleButtonsHtml = SCALE_OPTIONS.map((factor) => {
    const label = `${factor}x`;
    const active = Number(scaleFactor) === factor;
    return `<button type="button" class="seg-btn ${active ? 'is-active' : ''}" data-action="set-scale" data-scale="${factor}">${label}</button>`;
  }).join('');

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
      <div class="detail-action-bar no-print">
        <button type="button" class="btn btn-secondary" data-action="back-collection">← Collection</button>
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
          <button type="button" class="btn btn-outline" data-action="print-recipe">Print Card</button>
          <button type="button" class="btn btn-danger-outline" data-action="delete-recipe" data-recipe-id="${escapeHtml(
            recipe.id
          )}">Delete</button>
        </div>
      </div>

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
          <div class="kpi-box kpi-scale-box no-print">
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
                  ? '<button type="button" class="btn btn-sm btn-secondary no-print" data-action="reset-checks">Reset Checks</button>'
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
    </section>
  `;
}
