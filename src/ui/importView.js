import { escapeHtml } from './helpers.js';

export function renderImportView({
  urlInput = '',
  isScraping = false,
  scrapeError = '',
  pasteText = '',
  saveImmediately = false,
  isDragOver = false,
}) {
  return `
    <section class="import-shell">
      <div class="detail-action-bar">
        <button type="button" class="btn btn-secondary" data-action="back-collection">← Collection</button>
        <h1 class="editor-heading">Import &amp; Convert Recipes</h1>
      </div>

      <div class="panel-card">
        <h2>1. Scrape a Cooking Website URL</h2>
        <p class="muted">
          Paste a recipe webpage URL to extract structured ingredients, steps, timings, and servings (works with Schema.org / JSON-LD recipe pages).
        </p>
        <form id="scrape-url-form" class="scrape-form">
          <div class="scrape-form-row">
            <label for="scrape-url-input" class="sr-only">Recipe webpage URL</label>
            <input
              id="scrape-url-input"
              name="url"
              type="text"
              inputmode="url"
              value="${escapeHtml(urlInput)}"
              placeholder="https://www.budgetbytes.com/example-recipe/"
              ${isScraping ? 'disabled' : ''}
            />
            <button type="submit" class="btn btn-primary" ${isScraping ? 'disabled' : ''}>
              ${isScraping ? 'Fetching…' : 'Fetch & Convert'}
            </button>
          </div>
        </form>
        ${
          scrapeError
            ? `<div class="callout-box callout-danger" style="margin-top: 10px; margin-bottom: 0;">${escapeHtml(
                scrapeError
              )}</div>`
            : ''
        }
      </div>

      <div class="panel-card">
        <h2>2. Drop or Browse Existing Files (.md, .txt, .json)</h2>
        <p class="muted">
          Drop one or multiple Markdown (<code>.md</code>), plain text (<code>.txt</code>), HTML (<code>.html</code>), or JSON backup/recipe files directly from your computer.
        </p>

        <div id="recipe-dropzone" class="dropzone ${isDragOver ? 'is-drag-over' : ''}">
          <p class="dropzone-title">Drag &amp; drop <code>.md</code>, <code>.txt</code>, or <code>.json</code> files here</p>
          <p class="muted dropzone-sub">Single files open in the editor for review unless auto-save is checked; multiple files batch-import into your binder.</p>
          <label class="btn btn-outline file-upload-btn">
            <span>Choose File(s) to Import</span>
            <input
              type="file"
              id="import-files-input"
              accept=".md,.markdown,.txt,.html,.htm,.json,text/markdown,text/plain,text/html,application/json"
              multiple
              hidden
            />
          </label>
        </div>

        <label class="inline-checkbox" style="margin-top: 12px;">
          <input
            type="checkbox"
            data-action="toggle-save-immediately"
            ${saveImmediately ? 'checked' : ''}
          />
          <span>Save single imported file immediately (skip editor review)</span>
        </label>
      </div>

      <div class="panel-card">
        <h2>3. Copy &amp; Paste Recipe Text</h2>
        <p class="muted">
          Copy a recipe from any webpage, email, PDF, or notes app and paste it below. Both titled sections (<code>Ingredients</code> / <code>Directions</code>) and plain unstructured lists are converted automatically.
        </p>
        <label for="paste-recipe-textarea" class="sr-only">Paste recipe text</label>
        <textarea
          id="paste-recipe-textarea"
          class="paste-textarea"
          rows="10"
          placeholder="Lemon Pasta&#10;Prep: 10 min | Cook: 15 min | Servings: 4&#10;&#10;Ingredients&#10;1 lb spaghetti&#10;3 tbsp butter&#10;1 lemon, zested and juiced&#10;&#10;Directions&#10;1. Boil pasta in salted water until al dente.&#10;2. Toss hot pasta with butter, lemon juice, and pasta water."
        >${escapeHtml(pasteText)}</textarea>
        <div class="btn-row" style="margin-top: 10px;">
          <button type="button" class="btn btn-primary" data-action="convert-pasted-text">Convert to Recipe</button>
          <button type="button" class="btn btn-outline" data-action="paste-clipboard">Paste from Clipboard</button>
          <button type="button" class="btn btn-secondary" data-action="clear-paste-text">Clear</button>
        </div>
      </div>
    </section>
  `;
}
