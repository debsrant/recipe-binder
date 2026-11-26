import { escapeHtml } from './helpers.js';

export function renderDividersView({ dividers, recipes }) {
  const activeRecipes = (recipes || []).filter((r) => r && !r.deleted);
  const countMap = new Map();
  for (const r of activeRecipes) {
    countMap.set(r.dividerId, (countMap.get(r.dividerId) || 0) + 1);
  }

  const rowsHtml = (dividers || [])
    .map((div, idx) => {
      const count = countMap.get(div.id) || 0;
      const isOnlyDivider = dividers.length <= 1;
      return `<div class="divider-manage-row" data-divider-id="${escapeHtml(div.id)}">
        <div class="divider-order-btns">
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            data-action="move-divider-up"
            data-divider-id="${escapeHtml(div.id)}"
            ${idx === 0 ? 'disabled' : ''}
          >Up</button>
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            data-action="move-divider-down"
            data-divider-id="${escapeHtml(div.id)}"
            ${idx === dividers.length - 1 ? 'disabled' : ''}
          >Down</button>
        </div>

        <div class="divider-name-field">
          <input
            type="text"
            value="${escapeHtml(div.name)}"
            data-divider-name-input="${escapeHtml(div.id)}"
            aria-label="Divider name for ${escapeHtml(div.name)}"
          />
        </div>

        <span class="badge">${count} ${count === 1 ? 'recipe' : 'recipes'}</span>

        <div class="divider-row-actions">
          <button
            type="button"
            class="btn btn-sm btn-outline"
            data-action="rename-divider"
            data-divider-id="${escapeHtml(div.id)}"
          >Save Name</button>
          <button
            type="button"
            class="btn btn-sm btn-danger-outline"
            data-action="delete-divider"
            data-divider-id="${escapeHtml(div.id)}"
            ${isOnlyDivider ? 'disabled title="At least one divider tab is required"' : ''}
          >Delete</button>
        </div>
      </div>`;
    })
    .join('');

  return `
    <section class="manage-shell">
      <div class="panel-card">
        <h2>Binder Dividers</h2>
        <p class="muted">
          Organize your kitchen binder into custom tab sections. Deleting a divider automatically moves its recipes to the first remaining tab.
        </p>

        <form id="add-divider-form" class="add-divider-form">
          <label for="new-divider-name" class="sr-only">New divider name</label>
          <input
            id="new-divider-name"
            name="name"
            type="text"
            required
            placeholder="Add a binder tab (e.g., Grilling, Soups & Stews, Sauces)..."
          />
          <button type="submit" class="btn btn-primary">+ Add Divider</button>
        </form>

        <div class="divider-manage-list">
          ${rowsHtml}
        </div>
      </div>
    </section>
  `;
}
