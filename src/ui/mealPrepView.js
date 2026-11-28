import { getRecipeMethods } from '../lib/collection.js';
import {
  buildMergedPrepTimeline,
  normalizeMealPrepData,
} from '../lib/mealPrep.js';
import { escapeHtml } from './helpers.js';

const SUB_TABS = [
  { id: 'timeline', label: 'Merged Prep Timeline' },
  { id: 'templates', label: 'Cook Once, Eat Thrice' },
];

function renderSubTabs(activeTab) {
  return `
    <div class="subtab-bar no-print" role="tablist" aria-label="Meal prep sections">
      ${SUB_TABS.map(
        (tab) => `
          <button
            type="button"
            class="subtab-btn ${activeTab === tab.id ? 'is-active' : ''}"
            data-action="set-mealprep-tab"
            data-tab="${tab.id}"
          >${escapeHtml(tab.label)}</button>
        `
      ).join('')}
    </div>
  `;
}

function renderTimelineTab({
  recipes,
  timelineSelections,
  checkedTimelineSteps,
}) {
  const activeRecipes = (recipes || [])
    .filter((r) => !r.deleted)
    .sort((a, b) => a.title.localeCompare(b.title));

  const selectedEntries = [];
  for (const r of activeRecipes) {
    const sel = timelineSelections?.[r.id];
    if (sel?.selected) {
      selectedEntries.push({
        recipe: r,
        scale: sel.scale || 1,
        methodId: sel.methodId || '',
      });
    }
  }

  const timeline = buildMergedPrepTimeline(selectedEntries);

  const selectorRows = activeRecipes
    .map((r) => {
      const sel = timelineSelections?.[r.id] || { selected: false, scale: 1, methodId: '' };
      const methods = getRecipeMethods(r);
      const scaleOptions = [0.5, 1, 1.5, 2, 3]
        .map(
          (val) =>
            `<option value="${val}" ${Number(sel.scale || 1) === val ? 'selected' : ''}>${val}x</option>`
        )
        .join('');
      const methodSelect =
        methods.length > 1
          ? `<select
               class="inline-mini-select"
               data-action="set-timeline-method"
               data-recipe-id="${escapeHtml(r.id)}"
               ${!sel.selected ? 'disabled' : ''}
             >
               ${methods
                 .map(
                   (m) =>
                     `<option value="${escapeHtml(m.id)}" ${
                       (sel.methodId || methods[0]?.id) === m.id ? 'selected' : ''
                     }>${escapeHtml(m.name || 'Method')}</option>`
                 )
                 .join('')}
             </select>`
          : '';

      return `
        <div class="timeline-picker-row ${sel.selected ? 'is-selected' : ''}">
          <label class="timeline-picker-check">
            <input
              type="checkbox"
              data-action="toggle-timeline-recipe"
              data-recipe-id="${escapeHtml(r.id)}"
              ${sel.selected ? 'checked' : ''}
            />
            <span>
              <strong>${escapeHtml(r.title)}</strong>
              <small>${escapeHtml(String(r.servings || 4))} srv${
                r.servingSize ? ` · ${escapeHtml(r.servingSize)}` : ''
              }</small>
            </span>
          </label>
          <div class="timeline-picker-controls">
            ${methodSelect}
            <select
              class="inline-mini-select"
              data-action="set-timeline-scale"
              data-recipe-id="${escapeHtml(r.id)}"
              ${!sel.selected ? 'disabled' : ''}
              aria-label="Scale for ${escapeHtml(r.title)}"
            >
              ${scaleOptions}
            </select>
          </div>
        </div>
      `;
    })
    .join('');

  const ovenBanner =
    timeline.ovenTemps.length > 0
      ? `<div class="timeline-temp-banner">
           <strong>Oven / Heat Targets Detected:</strong>
           ${timeline.ovenTemps
             .map((t) => `<span class="temp-pill">${escapeHtml(t)}</span>`)
             .join('')}
         </div>`
      : '';

  const ingredientsHtml = timeline.ingredientsByRecipe
    .map(
      (grp) => `
        <div class="timeline-ing-group">
          <div class="timeline-ing-header">
            <div>
              <strong>${escapeHtml(grp.title)}</strong>
              <span class="muted-inline">${escapeHtml(grp.methodName)} · ${escapeHtml(
                String(grp.scaledServings)
              )} servings${grp.servingSize ? ` (${escapeHtml(grp.servingSize)} each)` : ''}${
                grp.scale !== 1 ? ` [${grp.scale}x]` : ''
              }</span>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-outline no-print"
              data-action="send-recipe-to-freezer"
              data-recipe-id="${escapeHtml(grp.recipeId)}"
              data-scale="${escapeHtml(String(grp.scale))}"
            >Send Batch to Freezer</button>
          </div>
          <ul class="timeline-ing-list">
            ${grp.ingredients.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
          </ul>
        </div>
      `
    )
    .join('');

  const phasesHtml = timeline.phases
    .map((phase) => {
      if (phase.steps.length === 0) return '';
      return `
        <section class="timeline-phase-card">
          <h4>${escapeHtml(phase.title)}</h4>
          <ol class="timeline-step-list">
            ${phase.steps
              .map((step) => {
                const checked = checkedTimelineSteps?.has(step.id);
                return `
                  <li
                    class="timeline-step-item ${checked ? 'is-checked' : ''}"
                    data-action="toggle-timeline-step"
                    data-step-id="${escapeHtml(step.id)}"
                    tabindex="0"
                    role="checkbox"
                    aria-checked="${checked ? 'true' : 'false'}"
                  >
                    <span class="check-indicator" aria-hidden="true">${checked ? '✓' : ''}</span>
                    <div class="timeline-step-body">
                      <div class="timeline-step-meta">
                        <span class="timeline-recipe-tag">${escapeHtml(step.recipeTitle)}</span>
                        ${
                          step.methodName
                            ? `<span class="method-pill">${escapeHtml(step.methodName)}</span>`
                            : ''
                        }
                        ${
                          step.cookMinutes > 0
                            ? `<span class="muted-inline">${step.cookMinutes}m cook</span>`
                            : ''
                        }
                      </div>
                      <p>${escapeHtml(step.text)}</p>
                    </div>
                  </li>
                `;
              })
              .join('')}
          </ol>
        </section>
      `;
    })
    .join('');

  return `
    <div class="timeline-layout">
      <aside class="panel-card timeline-picker-col no-print">
        <div class="section-header-row">
          <h3>Select Recipes (${selectedEntries.length})</h3>
          ${
            selectedEntries.length > 0
              ? '<button type="button" class="btn btn-sm btn-outline" data-action="clear-timeline-selection">Clear</button>'
              : ''
          }
        </div>
        <p class="helper-copy">Pick 2+ recipes, set batch scale factors (1x–3x), and combine them into one chronological kitchen run-sheet.</p>
        <div class="timeline-picker-list">
          ${selectorRows || '<p class="helper-copy">No recipes in binder yet.</p>'}
        </div>
      </aside>

      <section class="timeline-output-col">
        ${
          selectedEntries.length === 0
            ? `<div class="panel-card empty-state-compact">
                 <h3>Merged Prep Timeline</h3>
                 <p>Select two or more recipes on the left (or click <strong>Load into Prep Timeline</strong> on a "Cook Once, Eat Thrice" template) to generate a consolidated ingredient list and chronological prep checklist.</p>
               </div>`
            : `
               <div class="panel-card timeline-sheet-header">
                 <div class="section-header-row">
                   <div>
                     <h3>Combined Prep Run-Sheet</h3>
                     <p class="helper-copy">Combining ${selectedEntries.length} recipe${
                       selectedEntries.length === 1 ? '' : 's'
                     }, ordered longest cook first.</p>
                   </div>
                   <button type="button" class="btn btn-primary no-print" data-action="print-mealprep-plan">Print Prep Plan</button>
                 </div>
                 ${ovenBanner}
               </div>

               <div class="panel-card">
                 <h3>Scaled Batch Ingredients</h3>
                 <div class="timeline-ing-grid">
                   ${ingredientsHtml}
                 </div>
               </div>

               <div class="timeline-phases-stack">
                 ${phasesHtml}
               </div>
              `
        }
      </section>
    </div>
  `;
}

function parseDerivativesForDisplay(derivatives) {
  return [...(derivatives || [])].sort((a, b) => (a.dayOffset || 0) - (b.dayOffset || 0));
}

function serializeDerivativesForTextarea(derivatives) {
  return parseDerivativesForDisplay(derivatives)
    .map((d) =>
      [d.dayOffset ?? 1, d.title || '', d.notes || '', d.recipeId || '']
        .join(' | ')
        .replace(/\s+\|\s+\|\s*$/, '')
    )
    .join('\n');
}

function renderTemplatesTab({
  templates,
  recipes,
  editingTemplateId,
}) {
  const activeTemplates = (templates || []).filter((t) => !t.deleted);
  const activeRecipes = (recipes || [])
    .filter((r) => !r.deleted)
    .sort((a, b) => a.title.localeCompare(b.title));
  const recipeMap = new Map(activeRecipes.map((r) => [r.id, r]));

  const editingTemplate = editingTemplateId
    ? activeTemplates.find((t) => t.id === editingTemplateId) || null
    : null;

  const baseRecipeOptions = [
    '<option value="">-- Optional: Link base recipe --</option>',
    ...activeRecipes.map(
      (r) =>
        `<option value="${escapeHtml(r.id)}" ${
          editingTemplate?.baseRecipeId === r.id ? 'selected' : ''
        }>${escapeHtml(r.title)}${r.servingSize ? ` (${escapeHtml(r.servingSize)})` : ''}</option>`
    ),
  ].join('');

  const cardsHtml =
    activeTemplates.length > 0
      ? activeTemplates
          .map((tpl) => {
            const baseRecipe = tpl.baseRecipeId ? recipeMap.get(tpl.baseRecipeId) : null;
            const derivs = parseDerivativesForDisplay(tpl.derivatives);
            return `
              <article class="panel-card batch-template-card">
                <div class="batch-template-header">
                  <div>
                    <span class="batch-badge">${escapeHtml(String(derivs.length))} Meals from 1 Cook</span>
                    <h3>${escapeHtml(tpl.title)}</h3>
                  </div>
                  <div class="batch-template-actions no-print">
                    <button
                      type="button"
                      class="btn btn-sm btn-primary"
                      data-action="load-template-timeline"
                      data-template-id="${escapeHtml(tpl.id)}"
                    >Load into Timeline</button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline"
                      data-action="edit-batch-template"
                      data-template-id="${escapeHtml(tpl.id)}"
                    >Edit</button>
                    <button
                      type="button"
                      class="btn btn-sm btn-danger-outline"
                      data-action="delete-batch-template"
                      data-template-id="${escapeHtml(tpl.id)}"
                    >Delete</button>
                  </div>
                </div>

                <div class="batch-base-box">
                  <div>
                    <strong>Base Cook:</strong> ${escapeHtml(
                      tpl.baseLabel || baseRecipe?.title || 'Batch Base'
                    )}
                    ${
                      tpl.batchYield
                        ? `<span class="batch-yield-pill">${escapeHtml(tpl.batchYield)}</span>`
                        : ''
                    }
                  </div>
                  ${
                    baseRecipe
                      ? `<div class="batch-base-links no-print">
                           <button type="button" class="btn btn-sm btn-secondary" data-action="open-recipe" data-recipe-id="${escapeHtml(
                             baseRecipe.id
                           )}">Open Base Recipe</button>
                           <button type="button" class="btn btn-sm btn-outline" data-action="send-recipe-to-freezer" data-recipe-id="${escapeHtml(
                             baseRecipe.id
                           )}">Send Base to Freezer</button>
                         </div>`
                      : ''
                  }
                </div>

                ${
                  tpl.prepTips
                    ? `<p class="batch-prep-tips"><strong>Prep Tip:</strong> ${escapeHtml(
                        tpl.prepTips
                      )}</p>`
                    : ''
                }

                <div class="derivative-grid">
                  ${derivs
                    .map((d) => {
                      const linked = d.recipeId ? recipeMap.get(d.recipeId) : null;
                      return `
                        <div class="derivative-card">
                          <div class="derivative-day-row">
                            <span class="day-badge">Day ${escapeHtml(String(d.dayOffset ?? 0))}</span>
                            <strong>${escapeHtml(d.title)}</strong>
                          </div>
                          ${d.notes ? `<p>${escapeHtml(d.notes)}</p>` : ''}
                          ${
                            linked
                              ? `<button
                                   type="button"
                                   class="btn btn-sm btn-outline no-print"
                                   data-action="open-recipe"
                                   data-recipe-id="${escapeHtml(linked.id)}"
                                 >Open: ${escapeHtml(linked.title)}</button>`
                              : ''
                          }
                        </div>
                      `;
                    })
                    .join('')}
                </div>
              </article>
            `;
          })
          .join('')
      : `<div class="empty-state-compact">
           <p>No batch templates saved yet. Create a "Cook Once, Eat Thrice" plan on the right.</p>
         </div>`;

  return `
    <div class="mealprep-split-grid">
      <section class="mealprep-list-col">
        ${cardsHtml}
      </section>

      <aside class="panel-card mealprep-form-col no-print">
        <h3>${editingTemplate ? 'Edit Batch Plan' : 'New "Cook Once, Eat Thrice" Plan'}</h3>
        <form id="mealprep-template-form" class="stacked-form" data-template-id="${escapeHtml(editingTemplate?.id || '')}">

          <div class="form-field">
            <label for="template-title">Plan Name</label>
            <input
              id="template-title"
              name="title"
              type="text"
              required
              value="${escapeHtml(editingTemplate?.title || '')}"
              placeholder="e.g., Sunday Pulled Pork Three-Ways"
            />
          </div>

          <div class="form-field">
            <label for="template-base-recipe">Base Recipe (optional)</label>
            <select id="template-base-recipe" name="baseRecipeId">
              ${baseRecipeOptions}
            </select>
          </div>

          <div class="form-field">
            <label for="template-base-label">Base Cook Description</label>
            <input
              id="template-base-label"
              name="baseLabel"
              type="text"
              value="${escapeHtml(editingTemplate?.baseLabel || '')}"
              placeholder="e.g., Braise double batch of 4 lb pork shoulder"
            />
          </div>

          <div class="form-field">
            <label for="template-yield">Batch Yield &amp; Split</label>
            <input
              id="template-yield"
              name="batchYield"
              type="text"
              value="${escapeHtml(editingTemplate?.batchYield || '')}"
              placeholder="e.g., 12 cups pulled pork (4 portions Day 1 + 8 freezer portions)"
            />
          </div>

          <div class="form-field">
            <label for="template-tips">Storage &amp; Reuse Tips</label>
            <textarea
              id="template-tips"
              name="prepTips"
              rows="2"
              placeholder="Keep sauce separate before freezing so Day 2 tacos and Day 3 bowls taste distinct."
            >${escapeHtml(editingTemplate?.prepTips || '')}</textarea>
          </div>

          <div class="form-field">
            <label for="template-derivatives">
              Derivative Meals (one per line: <code>DayOffset | Meal Title | Notes | RecipeID (optional)</code>)
            </label>
            <textarea
              id="template-derivatives"
              name="derivativesText"
              rows="5"
              placeholder="0 | Night 1: Fresh Roast Plate | Serve hot with slaw&#10;2 | Night 2: Crispy Carnitas Tacos | Crisp in dry skillet with lime&#10;5 | Night 3: Smokey Black Bean Rice Bowls | Reheat with broth"
            >${escapeHtml(
              editingTemplate ? serializeDerivativesForTextarea(editingTemplate.derivatives) : ''
            )}</textarea>
          </div>

          <div class="form-actions-row">
            ${
              editingTemplate
                ? '<button type="button" class="btn btn-outline" data-action="cancel-template-edit">Cancel</button>'
                : ''
            }
            <button type="submit" class="btn btn-primary">${
              editingTemplate ? 'Save Plan' : 'Add Batch Plan'
            }</button>
          </div>
        </form>
      </aside>
    </div>
  `;
}

/**
 * Renders the Phase 5 Batch Cooking & Meal Prep Engine view.
 */
export function renderMealPrepView({
  activeTab = 'timeline',
  mealPrepData,
  recipes = [],
  editingTemplateId = null,
  timelineSelections = {},
  checkedTimelineSteps = new Set(),
}) {
  const normalized = normalizeMealPrepData(mealPrepData);
  const currentTab = SUB_TABS.some((t) => t.id === activeTab) ? activeTab : 'timeline';

  const bodyHtml =
    currentTab === 'templates'
      ? renderTemplatesTab({
          templates: normalized.templates,
          recipes,
          editingTemplateId,
        })
      : renderTimelineTab({
          recipes,
          timelineSelections,
          checkedTimelineSteps,
        });

  return `
    <section class="mealprep-view">
      <div class="panel-card view-intro-card no-print">
        <div class="section-header-row">
          <div>
            <h2>Batch Cooking &amp; Meal Prep Planner</h2>
            <p class="helper-copy">Merge multiple recipes into one chronological prep timeline and turn one base cook into multiple weeknight dinners. Stored freezer, fridge &amp; canning batches live in Kitchen Inventory.</p>
          </div>
          <button type="button" class="btn btn-outline" data-action="nav-view" data-view="pantry">Kitchen Inventory &rarr;</button>
        </div>
        ${renderSubTabs(currentTab)}
      </div>

      ${bodyHtml}
    </section>
  `;
}
