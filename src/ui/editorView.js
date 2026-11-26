import { escapeHtml } from './helpers.js';

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
    notes: '',
    favorite: false,
  };

  const dividerOptionsHtml = (dividers || [])
    .map(
      (div) =>
        `<option value="${escapeHtml(div.id)}" ${
          activeRecipe.dividerId === div.id ? 'selected' : ''
        }>${escapeHtml(div.name)}</option>`
    )
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
            <label for="rec-cook">Cook Time (minutes)</label>
            <input
              id="rec-cook"
              name="cookMinutes"
              type="number"
              min="0"
              step="1"
              value="${escapeHtml(String(activeRecipe.cookMinutes ?? 0))}"
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

          <div class="form-field">
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

          <div class="form-field form-span-2">
            <label for="rec-steps">Instructions (one step per line)</label>
            <textarea
              id="rec-steps"
              name="steps"
              rows="8"
              placeholder="Preheat oven to 400 F.&#10;Whisk dry ingredients in a large bowl."
            >${escapeHtml((activeRecipe.steps || []).join('\n'))}</textarea>
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
