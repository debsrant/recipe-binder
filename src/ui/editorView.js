import { getAiStatusLabel, isAiReady } from '../lib/ai.js';
import {
  getRecipeMethods,
  hasCanningSpecs,
  normalizeCanningSpecs,
  normalizeSafeImageUrl,
  parseTagsInput,
} from '../lib/collection.js';
import { escapeHtml } from './helpers.js';

const COMMON_COOKING_METHODS = [
  'Skillet',
  'Stovetop',
  'Oven',
  'Toaster Oven',
  'Instant Pot',
  'Slow Cooker',
  'Air Fryer',
  'Grill',
  'Griddle',
  'Dutch Oven',
  'Water Bath Canner',
  'Pressure Canner',
  'No-Cook',
];

const QUICK_RECIPE_TAGS = [
  'toaster-oven',
  'mix',
  'canning',
  'freezer-friendly',
  'make-ahead',
  'quick',
];

const CANNING_METHOD_OPTIONS = [
  '',
  'Water Bath',
  'Steam Canner',
  'Pressure Canner (Dial Gauge)',
  'Pressure Canner (Weighted Gauge)',
  'Refrigerator / Quick Pickle',
  'Dry / Vacuum Pantry',
];

export function renderEditorView({
  recipe,
  dividers,
  isNew,
  aiConfig = null,
  editorAiBusy = '',
  editorAiUndoAvailable = false,
}) {
  const activeRecipe = recipe || {
    id: '',
    title: '',
    dividerId: dividers?.[0]?.id || 'weeknight',
    summary: '',
    source: '',
    imageUrl: '',
    prepMinutes: 10,
    cookMinutes: 15,
    servings: 4,
    servingSize: '',
    tags: [],
    ingredients: [],
    steps: [],
    methods: [{ id: 'method-1', name: '', cookMinutes: 15, note: '', steps: [] }],
    notes: '',
    storageNotes: '',
    reheatNotes: '',
    sourceTranscript: '',
    favorite: false,
  };

  const methods = getRecipeMethods(activeRecipe);
  const aiReady = isAiReady(aiConfig);
  const aiLabel = getAiStatusLabel(aiConfig);
  const anyAiBusy = Boolean(editorAiBusy);
  const safeImage = normalizeSafeImageUrl(activeRecipe.imageUrl);
  const hasTranscript = Boolean(String(activeRecipe.sourceTranscript || '').trim());
  const hasStorageOrReheat = Boolean(
    String(activeRecipe.storageNotes || '').trim() || String(activeRecipe.reheatNotes || '').trim()
  );
  const canning = normalizeCanningSpecs(activeRecipe.canning);
  const hasCanning = hasCanningSpecs(canning);
  const activeTagSet = new Set(parseTagsInput(activeRecipe.tags || []));
  const hasExtraMeta = Boolean(
    safeImage ||
      String(activeRecipe.source || '').trim() ||
      (activeRecipe.tags || []).length > 0 ||
      String(activeRecipe.notes || '').trim() ||
      activeRecipe.favorite
  );

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

        <details
          class="editor-collapsible editor-ai-box"
          ${editorAiUndoAvailable || anyAiBusy ? 'open' : ''}
        >
          <summary class="editor-collapsible-summary">
            <span>AI Recipe Helper (Auto-Fill, Cleanup &amp; Undo)</span>
            <span class="badge ai-status-pill ${aiReady ? 'is-ready' : ''}">${escapeHtml(aiLabel)}</span>
          </summary>
          <div class="editor-collapsible-body">
            <p class="muted" style="margin: 0 0 10px;">
              Populate missing details without overwriting your edits, or clean up messy ingredients &amp; steps.
            </p>
            <div class="btn-row">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                data-action="editor-ai-autofill"
                ${anyAiBusy ? 'disabled' : ''}
              >${editorAiBusy === 'autofill' ? 'Auto-Filling…' : '✨ Auto-Fill Missing Fields'}</button>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                data-action="editor-ai-cleanup"
                ${anyAiBusy ? 'disabled' : ''}
              >${editorAiBusy === 'cleanup' ? 'Cleaning Draft…' : '✨ Clean Up Draft'}</button>
              ${
                editorAiUndoAvailable
                  ? `<button type="button" class="btn btn-secondary btn-sm" data-action="editor-ai-undo">↩ Undo AI Fill</button>`
                  : ''
              }
              <button
                type="button"
                class="btn btn-outline btn-sm"
                data-action="open-ai-settings"
              >AI Settings →</button>
            </div>
          </div>
        </details>

        <details class="editor-collapsible" ${hasTranscript ? 'open' : ''}>
          <summary class="editor-collapsible-summary">
            <span>Source Video Transcript Reference</span>
            <span class="badge">${hasTranscript ? 'Attached' : 'Optional'}</span>
          </summary>
          <div class="editor-collapsible-body">
            <div class="section-header-row" style="margin-bottom: 6px;">
              <span class="muted">Reference or paste a raw video transcript here while editing steps.</span>
              <button
                type="button"
                class="btn btn-sm btn-outline"
                data-action="editor-ai-from-transcript"
                ${anyAiBusy ? 'disabled' : ''}
              >${editorAiBusy === 'transcript' ? 'Re-Extracting…' : '✨ Re-Extract from Transcript'}</button>
            </div>
            <label for="rec-source-transcript" class="sr-only">Source Video Transcript</label>
            <textarea
              id="rec-source-transcript"
              name="sourceTranscript"
              rows="5"
              class="editor-transcript-box"
              placeholder="Video transcript appears here automatically when converting from Notes, or paste one here for reference..."
            >${escapeHtml(activeRecipe.sourceTranscript || '')}</textarea>
          </div>
        </details>

        <div class="form-grid">
          <div class="form-field form-span-2">
            <div class="section-header-row" style="margin-bottom: 4px;">
              <label for="rec-title" style="margin: 0;">Recipe Title (required)</label>
              <button
                type="button"
                class="btn btn-sm btn-outline"
                data-action="editor-ai-title"
                ${anyAiBusy ? 'disabled' : ''}
              >${editorAiBusy === 'title' ? 'Suggesting…' : '✨ Suggest Title'}</button>
            </div>
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
            <div class="section-header-row" style="margin-bottom: 4px;">
              <label for="rec-serving-size" style="margin: 0;">Serving Yield Size</label>
              <button
                type="button"
                class="btn btn-sm btn-outline"
                data-action="editor-ai-yield"
                ${anyAiBusy ? 'disabled' : ''}
              >${editorAiBusy === 'yield' ? 'Estimating…' : '✨ Estimate Yield'}</button>
            </div>
            <input
              id="rec-serving-size"
              name="servingSize"
              type="text"
              value="${escapeHtml(activeRecipe.servingSize || '')}"
              placeholder="e.g., 1 cup, 2 thighs + pan sauce"
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
        </div>

        <details class="editor-collapsible" ${hasStorageOrReheat ? 'open' : ''}>
          <summary class="editor-collapsible-summary">
            <span>Storage, Freezer &amp; Reheating Instructions</span>
            <span class="badge">${hasStorageOrReheat ? 'Filled' : 'Optional'}</span>
          </summary>
          <div class="editor-collapsible-body">
            <div class="section-header-row" style="margin-bottom: 8px;">
              <span class="muted">Used on the recipe card and auto-copied when sending leftovers to Freezer Inventory.</span>
              <button
                type="button"
                class="btn btn-sm btn-outline"
                data-action="editor-ai-storage"
                ${anyAiBusy ? 'disabled' : ''}
              >${editorAiBusy === 'storage' ? 'Generating…' : '✨ Generate Storage & Reheat'}</button>
            </div>
            <div class="form-grid">
              <div class="form-field form-span-2">
                <label for="rec-storage-notes">Freezer &amp; Storage Instructions</label>
                <textarea
                  id="rec-storage-notes"
                  name="storageNotes"
                  rows="3"
                  placeholder="e.g., Refrigerate airtight 3-4 days, or freeze in portions up to 3 months. Leave off fresh herbs until serving."
                >${escapeHtml(activeRecipe.storageNotes || '')}</textarea>
              </div>
              <div class="form-field form-span-2">
                <label for="rec-reheat-notes">Microwave &amp; Reheating Instructions</label>
                <textarea
                  id="rec-reheat-notes"
                  name="reheatNotes"
                  rows="3"
                  placeholder="e.g., Microwave covered 90 sec on 70% power, stir, then 30-60 sec until steaming; or re-crisp at 375 F for 4 min."
                >${escapeHtml(activeRecipe.reheatNotes || '')}</textarea>
              </div>
            </div>
          </div>
        </details>

        <details class="editor-collapsible editor-canning-box" ${hasCanning ? 'open' : ''}>
          <summary class="editor-collapsible-summary">
            <span>Canning &amp; Preserving Specs</span>
            <span class="badge">${hasCanning ? 'Filled' : 'Optional'}</span>
          </summary>
          <div class="editor-collapsible-body">
            <p class="canning-safety-note">
              <strong>Food Safety:</strong> Always verify headspace, processing time, and pressure (PSI) against a tested source (NCHFP, USDA, or Ball). Never water-bath low-acid foods.
            </p>
            <div class="form-grid">
              <div class="form-field">
                <label for="rec-canning-method">Canning Method</label>
                <select id="rec-canning-method" name="canningMethod">
                  ${CANNING_METHOD_OPTIONS.map(
                    (opt) =>
                      `<option value="${escapeHtml(opt)}" ${
                        canning.method === opt ? 'selected' : ''
                      }>${escapeHtml(opt || '-- Select Method --')}</option>`
                  ).join('')}
                </select>
              </div>

              <div class="form-field">
                <label for="rec-canning-jar-size">Jar Size &amp; Pack</label>
                <input
                  id="rec-canning-jar-size"
                  name="canningJarSize"
                  type="text"
                  value="${escapeHtml(canning.jarSize)}"
                  placeholder="e.g., Pint / Half-pint, Hot pack"
                />
              </div>

              <div class="form-field">
                <label for="rec-canning-headspace">Headspace</label>
                <input
                  id="rec-canning-headspace"
                  name="canningHeadspace"
                  type="text"
                  value="${escapeHtml(canning.headspace)}"
                  placeholder="e.g., 1/4 inch, 1/2 inch, 1 inch"
                />
              </div>

              <div class="form-field">
                <label for="rec-canning-time">Processing Time</label>
                <input
                  id="rec-canning-time"
                  name="canningProcessingTime"
                  type="text"
                  value="${escapeHtml(canning.processingTime)}"
                  placeholder="e.g., 15 min water bath / 75 min pints"
                />
              </div>

              <div class="form-field">
                <label for="rec-canning-pressure">Pressure (if pressure canned)</label>
                <input
                  id="rec-canning-pressure"
                  name="canningPressure"
                  type="text"
                  value="${escapeHtml(canning.pressure)}"
                  placeholder="e.g., 10 lbs weighted / 11 lbs dial"
                />
              </div>

              <div class="form-field">
                <label for="rec-canning-altitude">Altitude Adjustment</label>
                <input
                  id="rec-canning-altitude"
                  name="canningAltitudeNote"
                  type="text"
                  value="${escapeHtml(canning.altitudeNote)}"
                  placeholder="e.g., 0-1,000 ft base; +5 min at 1,001-3,000 ft"
                />
              </div>

              <div class="form-field form-span-2">
                <label for="rec-canning-source">Tested Source / Reference</label>
                <input
                  id="rec-canning-source"
                  name="canningTestedSource"
                  type="text"
                  value="${escapeHtml(canning.testedSource)}"
                  placeholder="e.g., Ball Complete Book p. 214, NCHFP Tomatoes"
                />
              </div>
            </div>
          </div>
        </details>

        <details class="editor-collapsible" ${hasExtraMeta ? 'open' : ''}>
          <summary class="editor-collapsible-summary">
            <span>Photo, Source, Tags &amp; Margin Notes</span>
            <span class="badge">${safeImage ? 'Photo Attached' : 'Optional'}</span>
          </summary>
          <div class="editor-collapsible-body">
            <div class="form-grid">
              <div class="form-field form-span-2">
                <label for="rec-image-url">Recipe Photo URL or Upload (compressed offline thumbnail)</label>
                <div class="editor-image-controls">
                  <input
                    id="rec-image-url"
                    name="imageUrl"
                    type="text"
                    value="${escapeHtml(safeImage)}"
                    placeholder="https://... or upload a compressed photo"
                  />
                  <label class="btn btn-sm btn-outline file-upload-btn">
                    <span>Upload Photo</span>
                    <input type="file" id="editor-image-file-input" accept="image/*" hidden />
                  </label>
                  ${
                    safeImage
                      ? `<button type="button" class="btn btn-sm btn-danger-outline" data-action="editor-remove-image">Remove Photo</button>`
                      : ''
                  }
                </div>
                ${
                  safeImage
                    ? `<div class="editor-image-preview-wrap">
                        <img class="editor-image-preview" src="${escapeHtml(safeImage)}" alt="Recipe preview" />
                      </div>`
                    : ''
                }
              </div>

              <div class="form-field">
                <label for="rec-source">Source / Cookbook / URL</label>
                <input
                  id="rec-source"
                  name="source"
                  type="text"
                  value="${escapeHtml(activeRecipe.source)}"
                  placeholder="e.g., Grandma's Index Card, https://..."
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
                <div class="editor-quick-tags-row" aria-label="Quick-add recipe tags">
                  <span class="muted">Quick tags:</span>
                  ${QUICK_RECIPE_TAGS.map((tag) => {
                    const active = activeTagSet.has(tag);
                    return `<button type="button" class="tag-chip quick-tag-chip ${
                      active ? 'is-active' : ''
                    }" data-action="quick-toggle-recipe-tag" data-tag="${escapeHtml(
                      tag
                    )}" aria-pressed="${active ? 'true' : 'false'}">#${escapeHtml(tag)}</button>`;
                  }).join('')}
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
          </div>
        </details>

        <div class="btn-row editor-submit-row">
          <button type="submit" class="btn btn-primary">Save Recipe Card</button>
          <button type="button" class="btn btn-secondary" data-action="cancel-edit">Cancel</button>
        </div>
      </form>
    </section>
  `;
}
