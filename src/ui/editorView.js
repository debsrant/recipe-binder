import { getRecipeMethods } from '../lib/collection.js';
import { escapeHtml } from './helpers.js';

const COMMON_COOKING_METHODS = [
  'Skillet',
  'Stovetop',
  'Oven',
  'Instant Pot',
  'Slow Cooker',
  'Air Fryer',
  'Grill',
  'Griddle',
  'Dutch Oven',
  'No-Cook',
];

export function renderEditorView({ recipe, dividers, isNew }) {
  const activeRecipe = recipe || {
    id: '',
    title: '',
    dividerId: dividers?.[0]?.id || 'weeknight',
    summary: '',
    source: '',
    prepMinutes: 10,
    cookMinutes: 15,
    servings: 4,
    tags: [],
    ingredients: [],
    steps: [],
    methods: [{ id: 'method-1', name: '', cookMinutes: 15, note: '', steps: [] }],
    notes: '',
    favorite: false,
  };

  const methods = getRecipeMethods(activeRecipe);

  const dividerOptionsHtml = (dividers || [])
    .map(
      (div) =>
        `<option value="${escapeHtml(div.id)}" ${
          activeRecipe.dividerId === div.id ? 'selected' : ''
        }>${escapeHtml(div.name)}</option>`
    )
    .join('');

  const methodBlocksHtml = methods
    .map((method, idx) => {
      const canReorderOrRemove = methods.length > 1;
      const controlsHtml = canReorderOrRemove
        ? `<div class="method-editor-actions">
            <button
              type="button"
              class="btn btn-sm btn-secondary"
              data-action="move-editor-method-up"
              data-method-index="${idx}"
              ${idx === 0 ? 'disabled' : ''}
            >↑</button>
            <button
              type="button"
              class="btn btn-sm btn-secondary"
              data-action="move-editor-method-down"
              data-method-index="${idx}"
              ${idx === methods.length - 1 ? 'disabled' : ''}
            >↓</button>
            <button
              type="button"
              class="btn btn-sm btn-danger-outline"
              data-action="remove-editor-method"
              data-method-index="${idx}"
            >Remove</button>
          </div>`
        : '';

      return `
        <div
          class="method-editor-card"
          data-method-block="${idx}"
          data-method-id="${escapeHtml(method.id || `method-${idx + 1}`)}"
        >
          <div class="method-editor-header">
            <span class="method-editor-title">Cooking Method ${idx + 1}</span>
            ${controlsHtml}
          </div>

          <div class="form-grid">
            <div class="form-field">
              <label for="rec-method-name-${idx}">Method Name (e.g., Skillet, Oven, Instant Pot, Slow Cooker)</label>
              <input
                id="rec-method-name-${idx}"
                type="text"
                list="common-cooking-methods"
                data-method-field="name"
                value="${escapeHtml(method.name || '')}"
                placeholder="e.g., Instant Pot, Slow Cooker, Oven, Skillet"
              />
            </div>

            <div class="form-field">
              <label for="rec-method-cook-${idx}">Cook Time (minutes)</label>
              <input
                id="rec-method-cook-${idx}"
                type="number"
                min="0"
                step="1"
                data-method-field="cookMinutes"
                value="${escapeHtml(String(method.cookMinutes ?? 0))}"
              />
            </div>

            <div class="form-field form-span-2">
              <label for="rec-method-note-${idx}">Method Note / Liquid or Prep Tweak (optional)</label>
              <input
                id="rec-method-note-${idx}"
                type="text"
                data-method-field="note"
                value="${escapeHtml(method.note || '')}"
                placeholder="e.g., Add 1/2 cup extra broth for pressure cooking"
              />
            </div>

            <div class="form-field form-span-2">
              <label for="rec-method-steps-${idx}">Instructions (one step per line)</label>
              <textarea
                id="rec-method-steps-${idx}"
                rows="7"
                data-method-field="steps"
                placeholder="Preheat oven to 400 F.&#10;Whisk dry ingredients in a large bowl."
              >${escapeHtml((method.steps || []).join('\n'))}</textarea>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <section class="editor-shell">
      <div class="detail-action-bar">
        <button type="button" class="btn btn-secondary" data-action="cancel-edit">← Cancel</button>
        <h1 class="editor-heading">${isNew ? 'New Recipe Card' : 'Edit Recipe Card'}</h1>
      </div>

      <form id="recipe-editor-form" class="panel-card editor-form" data-recipe-id="${escapeHtml(
        activeRecipe.id || ''
      )}">
        <datalist id="common-cooking-methods">
          ${COMMON_COOKING_METHODS.map((name) => `<option value="${escapeHtml(name)}"></option>`).join('')}
        </datalist>

        <div class="form-grid">
          <div class="form-field form-span-2">
            <label for="rec-title">Recipe Title (required)</label>
            <input
              id="rec-title"
              name="title"
              type="text"
              required
              value="${escapeHtml(activeRecipe.title)}"
              placeholder="e.g., Roasted Tomato & Garlic Pasta"
            />
          </div>

          <div class="form-field">
            <label for="rec-divider">Binder Divider Tab</label>
            <select id="rec-divider" name="dividerId">
              ${dividerOptionsHtml}
            </select>
          </div>

          <div class="form-field">
            <label for="rec-source">Source / Cookbook / Attribution</label>
            <input
              id="rec-source"
              name="source"
              type="text"
              value="${escapeHtml(activeRecipe.source)}"
              placeholder="e.g., Grandma's Index Card, Family Binder"
            />
          </div>

          <div class="form-field form-span-2">
            <label for="rec-summary">Short Summary</label>
            <input
              id="rec-summary"
              name="summary"
              type="text"
              value="${escapeHtml(activeRecipe.summary)}"
              placeholder="1-line description shown on collection cards"
            />
          </div>

          <div class="form-field">
            <label for="rec-prep">Prep Time (minutes)</label>
            <input
              id="rec-prep"
              name="prepMinutes"
              type="number"
              min="0"
              step="1"
              value="${escapeHtml(String(activeRecipe.prepMinutes ?? 0))}"
            />
          </div>

          <div class="form-field">
            <label for="rec-servings">Base Servings</label>
            <input
              id="rec-servings"
              name="servings"
              type="number"
              min="0.5"
              step="0.5"
              value="${escapeHtml(String(activeRecipe.servings ?? 4))}"
            />
          </div>

          <div class="form-field form-span-2">
            <label for="rec-tags">Tags (comma-separated)</label>
            <input
              id="rec-tags"
              name="tags"
              type="text"
              value="${escapeHtml((activeRecipe.tags || []).join(', '))}"
              placeholder="30-mins, dairy-free, kid-friendly"
            />
          </div>

          <div class="form-field form-span-2">
            <label for="rec-ingredients">Ingredients (one per line; start with amounts like "1 1/2 cups flour" for scaling)</label>
            <textarea
              id="rec-ingredients"
              name="ingredients"
              rows="8"
              placeholder="1 1/2 cups all-purpose flour&#10;1/2 tsp kosher salt&#10;2 tbsp olive oil"
            >${escapeHtml((activeRecipe.ingredients || []).join('\n'))}</textarea>
          </div>

          <div class="form-field form-span-2 method-editor-section">
            <div class="section-header-row">
              <label style="margin: 0;">Cooking Methods &amp; Instructions</label>
              <button type="button" class="btn btn-sm btn-outline" data-action="add-editor-method">+ Add Cooking Method</button>
            </div>
            <div class="method-editor-list">
              ${methodBlocksHtml}
            </div>
          </div>

          <div class="form-field form-span-2">
            <label for="rec-notes">Cook's Margin Notes</label>
            <textarea
              id="rec-notes"
              name="notes"
              rows="3"
              placeholder="Substitutions, oven quirks, or post-cook tweaks..."
            >${escapeHtml(activeRecipe.notes || '')}</textarea>
          </div>

          <div class="form-field form-span-2">
            <label class="inline-checkbox">
              <input type="checkbox" name="favorite" ${activeRecipe.favorite ? 'checked' : ''} />
              <span>Mark as Favorite recipe</span>
            </label>
          </div>
        </div>

        <div class="btn-row editor-submit-row">
          <button type="submit" class="btn btn-primary">Save Recipe Card</button>
          <button type="button" class="btn btn-secondary" data-action="cancel-edit">Cancel</button>
        </div>
      </form>
    </section>
  `;
}
