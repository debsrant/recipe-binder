import { isAiReady } from '../lib/ai.js';
import {
  NOTE_TYPES,
  collectNoteTags,
  extractVideoTimestamps,
  extractYouTubeId,
  filterAndSortNotes,
  getGoogleDrivePreviewUrl,
  getUrlHostname,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  getYouTubeWatchUrl,
  normalizeNotesData,
  normalizeSafeUrl,
} from '../lib/notes.js';
import { escapeHtml } from './helpers.js';

function asIdSet(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

function getTypeLabel(typeId) {
  return NOTE_TYPES.find((t) => t.id === typeId)?.label || 'Note';
}

function renderDriveStorageBar(notesData, editingDriveFolder) {
  const driveUrl = normalizeSafeUrl(notesData.googleDriveFolderUrl);

  if (editingDriveFolder) {
    return `
      <form id="notes-drive-folder-form" class="panel-card ref-editor-card">
        <div class="section-header-row">
          <h2>Google Drive File Storage Folder</h2>
          <a
            class="btn btn-sm btn-outline"
            href="https://drive.google.com"
            target="_blank"
            rel="noopener noreferrer"
          >Open Google Drive ↗</a>
        </div>
        <p class="muted" style="margin: 0 0 10px;">
          Paste the link to your Google Drive folder where you store cookbook PDFs, scanned recipe cards, and kitchen files.
        </p>
        <div class="notes-drive-form-row">
          <label for="notes-drive-url-input" class="sr-only">Google Drive Folder URL</label>
          <input
            id="notes-drive-url-input"
            name="googleDriveFolderUrl"
            type="url"
            value="${escapeHtml(driveUrl)}"
            placeholder="https://drive.google.com/drive/folders/..."
          />
          <button type="submit" class="btn btn-primary">Save Folder Link</button>
          <button type="button" class="btn btn-secondary" data-action="cancel-notes-drive-folder">Cancel</button>
        </div>
      </form>
    `;
  }

  return `
    <div class="panel-card notes-drive-bar">
      <div class="notes-drive-info">
        <strong>Google Drive File Storage:</strong>
        ${
          driveUrl
            ? `<span class="muted">Store PDFs, scans &amp; handouts in your Drive folder and link individual files below.</span>`
            : `<span class="muted">Connect a Google Drive folder for cookbook PDFs &amp; scanned kitchen files (synced with your account).</span>`
        }
      </div>
      <div class="notes-drive-actions">
        ${
          driveUrl
            ? `<a class="btn btn-primary btn-sm" href="${escapeHtml(
                driveUrl
              )}" target="_blank" rel="noopener noreferrer">Open Drive Folder ↗</a>
               <button type="button" class="btn btn-outline btn-sm" data-action="edit-notes-drive-folder">Change Folder</button>`
            : `<button type="button" class="btn btn-primary btn-sm" data-action="edit-notes-drive-folder">Set Drive Folder Link</button>
               <a class="btn btn-outline btn-sm" href="https://drive.google.com" target="_blank" rel="noopener noreferrer">Open Google Drive ↗</a>`
        }
      </div>
    </div>
  `;
}

function renderNoteEditorForm({
  editingNoteId,
  draftNote,
  existingNote,
  recipes = [],
  driveFolderUrl = '',
  isFetchingTranscript = false,
  transcriptError = '',
  isAiSummarizing = false,
}) {
  const isNew = editingNoteId === '__new__';
  const item = draftNote ||
    existingNote || {
      id: '',
      type: 'note',
      title: '',
      url: '',
      body: '',
      transcript: '',
      tags: [],
      recipeIds: [],
    };

  const currentType = item.type || 'note';
  const activeRecipes = (recipes || [])
    .filter((r) => !r.deleted)
    .sort((a, b) => a.title.localeCompare(b.title));
  const recipeMap = new Map(activeRecipes.map((r) => [r.id, r]));
  const linkedIds = Array.isArray(item.recipeIds) ? item.recipeIds : [];
  const availableRecipes = activeRecipes.filter((r) => !linkedIds.includes(r.id));

  const urlLabel =
    currentType === 'video'
      ? 'Video URL (YouTube, Vimeo, etc.)'
      : currentType === 'file'
      ? 'Google Drive File / PDF Link'
      : currentType === 'website'
      ? 'Website URL'
      : 'Reference Link (optional)';

  const urlPlaceholder =
    currentType === 'video'
      ? 'https://www.youtube.com/watch?v=...'
      : currentType === 'file'
      ? 'https://drive.google.com/file/d/.../view'
      : currentType === 'website'
      ? 'https://example.com/article'
      : 'Optional link URL...';

  const typeOptions = NOTE_TYPES.map(
    (t) =>
      `<option value="${escapeHtml(t.id)}" ${currentType === t.id ? 'selected' : ''}>${escapeHtml(
        t.label
      )}</option>`
  ).join('');

  const linkedChipsHtml =
    linkedIds.length > 0
      ? linkedIds
          .map((rid) => {
            const rec = recipeMap.get(rid);
            const label = rec ? rec.title : rid;
            return `<span class="badge note-linked-chip">
              ${escapeHtml(label)}
              <button
                type="button"
                class="note-chip-remove"
                data-action="note-unlink-recipe"
                data-recipe-id="${escapeHtml(rid)}"
                aria-label="Unlink ${escapeHtml(label)}"
              >×</button>
            </span>`;
          })
          .join('')
      : '<span class="muted">No recipes linked yet.</span>';

  const recipeSelectHtml =
    availableRecipes.length > 0
      ? `
        <div class="note-linker-row">
          <select id="note-recipe-linker-select" aria-label="Choose recipe to link">
            <option value="">Choose a recipe to link...</option>
            ${availableRecipes
              .map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.title)}</option>`)
              .join('')}
          </select>
          <button type="button" class="btn btn-sm btn-outline" data-action="note-link-recipe">+ Link Recipe</button>
        </div>
      `
      : '';

  const safeDriveFolder = normalizeSafeUrl(driveFolderUrl);

  return `
    <form
      id="notes-item-form"
      class="panel-card ref-editor-card"
      data-note-id="${escapeHtml(item.id || '')}"
    >
      <h2>${isNew ? `Add ${escapeHtml(getTypeLabel(currentType))}` : `Edit: ${escapeHtml(item.title)}`}</h2>

      <div class="form-grid">
        <div class="form-field">
          <label for="note-type-select">Type</label>
          <select id="note-type-select" name="type">
            ${typeOptions}
          </select>
        </div>

        <div class="form-field">
          <label for="note-title-input">Title (required)</label>
          <input
            id="note-title-input"
            name="title"
            type="text"
            required
            value="${escapeHtml(item.title)}"
            placeholder="e.g., Kenji Pan Pizza Dough Notes, Knife Skills Video, Roast Chart PDF"
          />
        </div>

        <div class="form-field form-span-2">
          <div class="section-header-row" style="margin-bottom: 4px;">
            <label for="note-url-input" style="margin-bottom: 0;">${escapeHtml(urlLabel)}</label>
            ${
              currentType === 'file'
                ? `<a
                    class="btn btn-sm btn-outline"
                    href="${escapeHtml(safeDriveFolder || 'https://drive.google.com')}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >${safeDriveFolder ? 'Open My Drive Folder ↗' : 'Open Google Drive ↗'}</a>`
                : ''
            }
          </div>
          <input
            id="note-url-input"
            name="url"
            type="text"
            value="${escapeHtml(item.url)}"
            placeholder="${escapeHtml(urlPlaceholder)}"
          />
        </div>

        <div class="form-field form-span-2">
          <label for="note-tags-input">Tags (comma-separated)</label>
          <input
            id="note-tags-input"
            name="tags"
            type="text"
            value="${escapeHtml((item.tags || []).join(', '))}"
            placeholder="e.g., sourdough, knife-skills, thanksgiving, sauce"
          />
        </div>

        <div class="form-field form-span-2">
          <label>Linked Recipes (optional)</label>
          <input
            type="hidden"
            id="note-recipe-ids-input"
            name="recipeIds"
            value="${escapeHtml(linkedIds.join(','))}"
          />
          <div class="flavor-chip-row" style="margin-bottom: 6px;">
            ${linkedChipsHtml}
          </div>
          ${recipeSelectHtml}
        </div>

        <div class="form-field form-span-2">
          <label for="note-body-input">Notes &amp; Key Takeaways</label>
          <textarea
            id="note-body-input"
            name="body"
            rows="5"
            placeholder="${
              currentType === 'video'
                ? 'Take notes or add timestamps like:\n01:45 - scoring the dough\n04:20 - Dutch oven steam trick'
                : 'Write kitchen notes, measurements, or key takeaways from this source...'
            }"
          >${escapeHtml(item.body)}</textarea>
        </div>

        ${
          currentType === 'video'
            ? `
              <div class="form-field form-span-2 note-transcript-editor">
                <div class="section-header-row" style="margin-bottom: 6px;">
                  <label for="note-transcript-input" style="margin-bottom: 0;">
                    Video Transcript (Clean Text, No Timestamps)
                  </label>
                  <div class="ref-toolbar-actions">
                    <button
                      type="button"
                      class="btn btn-sm btn-primary"
                      data-action="fetch-note-transcript"
                      ${isFetchingTranscript ? 'disabled' : ''}
                    >${isFetchingTranscript ? 'Fetching Transcript...' : 'Fetch YouTube Transcript'}</button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline"
                      data-action="clean-note-transcript"
                    >Clean Timestamps</button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline"
                      data-action="ai-summarize-note"
                      ${isAiSummarizing ? 'disabled' : ''}
                    >${isAiSummarizing ? 'Summarizing…' : 'Summarize into Notes (AI)'}</button>
                  </div>
                </div>
                ${
                  transcriptError
                    ? `<p class="error-inline">${escapeHtml(transcriptError)}</p>`
                    : ''
                }
                <textarea
                  id="note-transcript-input"
                  name="transcript"
                  rows="6"
                  placeholder="Click 'Fetch YouTube Transcript' above or paste any caption/transcript text here. Timestamps are removed automatically."
                >${escapeHtml(item.transcript)}</textarea>
              </div>
            `
            : `<input type="hidden" name="transcript" value="${escapeHtml(item.transcript)}" />`
        }
      </div>

      <div class="btn-row" style="margin-top: 12px;">
        <button type="submit" class="btn btn-primary">Save Note</button>
        <button type="button" class="btn btn-secondary" data-action="cancel-note-edit">Cancel</button>
      </div>
    </form>
  `;
}

function renderNoteCard({
  item,
  recipeMap,
  isPinned,
  isCollapsed,
  embedExpanded,
  embedStartSec,
  transcriptExpanded,
  aiBusyNoteId = '',
}) {
  const cardId = `note-${item.id}`;
  const safeUrl = normalizeSafeUrl(item.url);
  const host = safeUrl ? getUrlHostname(safeUrl) : '';
  const ytId = item.type === 'video' ? extractYouTubeId(safeUrl) : '';
  const drivePreviewUrl = item.type === 'file' ? getGoogleDrivePreviewUrl(safeUrl) : '';
  const timestamps = item.type === 'video' ? extractVideoTimestamps(item.body) : [];
  const hasTranscript = Boolean(String(item.transcript || '').trim());

  const hasSideColumn = Boolean(ytId || drivePreviewUrl || hasTranscript);

  const linkLabel =
    item.type === 'video'
      ? 'Open Video ↗'
      : item.type === 'file'
      ? 'Open in Drive ↗'
      : item.type === 'website'
      ? 'Open Website ↗'
      : 'Open Link ↗';

  const actionButtons = [];
  if (safeUrl) {
    actionButtons.push(
      `<a class="btn btn-sm btn-outline" href="${escapeHtml(
        safeUrl
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkLabel)}</a>`
    );
  }
  if (ytId) {
    actionButtons.push(
      `<button type="button" class="btn btn-sm ${
        embedExpanded ? 'btn-primary' : 'btn-outline'
      }" data-action="toggle-note-embed" data-note-id="${escapeHtml(item.id)}">${
        embedExpanded ? 'Hide Video Player' : 'Watch Inline'
      }</button>`
    );
  }
  if (drivePreviewUrl) {
    actionButtons.push(
      `<button type="button" class="btn btn-sm ${
        embedExpanded ? 'btn-primary' : 'btn-outline'
      }" data-action="toggle-note-embed" data-note-id="${escapeHtml(item.id)}">${
        embedExpanded ? 'Hide PDF Preview' : 'Preview File'
      }</button>`
    );
  }
  if (item.type === 'website' && safeUrl) {
    actionButtons.push(
      `<button type="button" class="btn btn-sm btn-outline" data-action="note-convert-recipe" data-note-id="${escapeHtml(
        item.id
      )}">Convert to Recipe</button>`
    );
  }
  if (item.type === 'video' && hasTranscript) {
    const isBusy = aiBusyNoteId === item.id;
    actionButtons.push(
      `<button type="button" class="btn btn-sm btn-outline" data-action="ai-transcript-to-recipe" data-note-id="${escapeHtml(
        item.id
      )}" ${isBusy ? 'disabled' : ''}>${
        isBusy ? 'Extracting Recipe…' : 'Transcript → Recipe (AI)'
      }</button>`
    );
  }

  const timestampsHtml =
    timestamps.length > 0
      ? `
        <div class="note-timestamp-section">
          <span class="sub-field-label">Video Jumps</span>
          <div class="note-timestamp-row">
            ${timestamps
              .map(
                (ts) => `<button
                  type="button"
                  class="tag-chip"
                  data-action="jump-video-timestamp"
                  data-note-id="${escapeHtml(item.id)}"
                  data-seconds="${ts.seconds}"
                  title="Jump to ${escapeHtml(ts.label)}"
                ><span class="mono-cell">${escapeHtml(ts.label)}</span> — ${escapeHtml(ts.text)}</button>`
              )
              .join('')}
          </div>
        </div>
      `
      : '';

  const tagsHtml = (item.tags || [])
    .map(
      (tag) =>
        `<button type="button" class="tag-chip" data-action="filter-note-tag" data-tag="${escapeHtml(
          tag
        )}">#${escapeHtml(tag)}</button>`
    )
    .join('');

  const linkedRecipesHtml = (item.recipeIds || [])
    .map((rid) => {
      const rec = recipeMap.get(rid);
      if (!rec) return '';
      return `<button
        type="button"
        class="btn btn-sm btn-outline"
        data-action="open-recipe"
        data-recipe-id="${escapeHtml(rec.id)}"
      >Recipe: ${escapeHtml(rec.title)}</button>`;
    })
    .filter(Boolean)
    .join('');

  let mediaHtml = '';
  if (ytId) {
    if (embedExpanded) {
      const embedUrl = getYouTubeEmbedUrl(ytId, embedStartSec || 0);
      mediaHtml += `
        <div class="note-video-embed">
          <iframe
            src="${escapeHtml(embedUrl)}"
            title="${escapeHtml(item.title)}"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      `;
    } else {
      const thumbUrl = getYouTubeThumbnailUrl(ytId);
      mediaHtml += `
        <button
          type="button"
          class="note-video-thumb-btn"
          data-action="toggle-note-embed"
          data-note-id="${escapeHtml(item.id)}"
          title="Play video inline"
        >
          <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" />
          <span class="note-play-pill">▶ Play Inline</span>
        </button>
      `;
    }
  } else if (drivePreviewUrl && embedExpanded) {
    mediaHtml += `
      <div class="note-drive-preview">
        <iframe
          src="${escapeHtml(drivePreviewUrl)}"
          title="${escapeHtml(item.title)}"
          loading="lazy"
        ></iframe>
      </div>
    `;
  }

  let transcriptHtml = '';
  if (hasTranscript) {
    const wordCount = String(item.transcript).trim().split(/\s+/).filter(Boolean).length;
    transcriptHtml = `
      <div class="note-transcript-box">
        <div class="section-header-row" style="margin-bottom: ${transcriptExpanded ? '8px' : '0'};">
          <span class="sub-field-label" style="margin-bottom: 0;">Transcript (No Timestamps · ${wordCount} words)</span>
          <div class="ref-card-controls">
            <button
              type="button"
              class="btn btn-sm btn-outline"
              data-action="copy-note-transcript"
              data-note-id="${escapeHtml(item.id)}"
            >Copy</button>
            <button
              type="button"
              class="btn btn-sm btn-outline"
              data-action="toggle-note-transcript"
              data-note-id="${escapeHtml(item.id)}"
              aria-expanded="${transcriptExpanded ? 'true' : 'false'}"
            >${transcriptExpanded ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        ${
          transcriptExpanded
            ? `<div class="note-transcript-content">${escapeHtml(item.transcript)}</div>`
            : ''
        }
      </div>
    `;
  }

  const extraButtonsHtml = `
    <button type="button" class="btn btn-sm btn-outline" data-action="edit-note" data-note-id="${escapeHtml(
      item.id
    )}">Edit</button>
    <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-note" data-note-id="${escapeHtml(
      item.id
    )}">Delete</button>
  `;

  return `
    <article class="panel-card ref-card note-card ${isPinned ? 'is-pinned' : ''} ${
    isCollapsed ? 'is-collapsed' : ''
  }">
      <div class="ref-card-header">
        <div class="ref-card-title-group">
          <button
            type="button"
            class="ref-card-title-btn"
            data-action="toggle-collapse-note-card"
            data-card-id="${escapeHtml(cardId)}"
            aria-expanded="${isCollapsed ? 'false' : 'true'}"
          >
            <h3 class="note-card-title">${escapeHtml(item.title)}</h3>
          </button>
          <span class="badge badge-divider">${escapeHtml(getTypeLabel(item.type))}</span>
          ${host ? `<span class="badge">${escapeHtml(host)}</span>` : ''}
        </div>
        <div class="ref-card-controls">
          <button
            type="button"
            class="btn btn-sm btn-outline ref-pin-btn ${isPinned ? 'is-pinned' : ''}"
            data-action="toggle-pin-note-card"
            data-card-id="${escapeHtml(cardId)}"
            aria-pressed="${isPinned ? 'true' : 'false'}"
            title="${isPinned ? 'Unpin card' : 'Pin card to top'}"
          >${isPinned ? 'Pinned' : 'Pin'}</button>
          ${extraButtonsHtml}
          <button
            type="button"
            class="btn btn-sm btn-outline ref-collapse-btn"
            data-action="toggle-collapse-note-card"
            data-card-id="${escapeHtml(cardId)}"
            aria-expanded="${isCollapsed ? 'false' : 'true'}"
          >${isCollapsed ? 'Expand ▾' : 'Collapse ▴'}</button>
        </div>
      </div>

      <div class="ref-card-body">
        <div class="note-horiz-body ${hasSideColumn ? '' : 'is-single-col'}">
          <div class="note-horiz-main">
            ${
              item.body
                ? `<div class="note-body-text">${escapeHtml(item.body)}</div>`
                : '<p class="muted" style="margin: 0 0 8px;">No written notes yet.</p>'
            }
            ${timestampsHtml}
            ${
              actionButtons.length > 0
                ? `<div class="note-action-row">${actionButtons.join('')}</div>`
                : ''
            }
            ${
              tagsHtml || linkedRecipesHtml
                ? `<div class="note-meta-footer">
                    ${tagsHtml ? `<div class="flavor-chip-row">${tagsHtml}</div>` : ''}
                    ${linkedRecipesHtml ? `<div class="note-linked-recipes">${linkedRecipesHtml}</div>` : ''}
                  </div>`
                : ''
            }
          </div>

          ${
            hasSideColumn
              ? `<div class="note-horiz-side">
                  ${mediaHtml}
                  ${transcriptHtml}
                </div>`
              : ''
          }
        </div>
      </div>
    </article>
  `;
}

/**
 * Renders the top-level Notes, Websites, Videos & Google Drive Files tab.
 */
export function renderNotesView({
  notesData,
  recipes = [],
  typeFilter = 'all',
  tagFilter = '',
  query = '',
  editingNoteId = null,
  draftNote = null,
  editingDriveFolder = false,
  pinnedCards,
  collapsedCards,
  pinnedOnly = false,
  expandedEmbeds,
  embedStartSeconds,
  expandedTranscripts,
  isFetchingTranscript = false,
  transcriptError = '',
  aiConfig = null,
  aiBusyNoteId = '',
  isAiSummarizing = false,
}) {
  const data = normalizeNotesData(notesData);
  const pinnedSet = asIdSet(pinnedCards);
  const collapsedSet = asIdSet(collapsedCards);
  const embedSet = asIdSet(expandedEmbeds);
  const transcriptSet = asIdSet(expandedTranscripts);
  const startMap = embedStartSeconds instanceof Map ? embedStartSeconds : new Map();

  const activeItems = (data.items || []).filter((i) => !i.deleted);
  const activeRecipes = (recipes || []).filter((r) => !r.deleted);
  const recipeMap = new Map(activeRecipes.map((r) => [r.id, r]));
  const recipeTitleById = new Map(activeRecipes.map((r) => [r.id, r.title]));

  const visibleItems = filterAndSortNotes({
    items: activeItems,
    typeFilter,
    tagFilter,
    query,
    pinnedSet,
    pinnedOnly,
    recipeTitleById,
  });
  const visibleCardIds = visibleItems.map((i) => `note-${i.id}`);
  const allCollapsed =
    visibleCardIds.length > 0 && visibleCardIds.every((id) => collapsedSet.has(id));

  const countByType = new Map();
  for (const item of activeItems) {
    countByType.set(item.type, (countByType.get(item.type) || 0) + 1);
  }

  const typePills = [
    `<button type="button" class="tag-pill ${
      typeFilter === 'all' ? 'is-active' : ''
    }" data-action="select-note-type" data-type="all">All (${activeItems.length})</button>`,
    ...NOTE_TYPES.map(
      (t) => `<button type="button" class="tag-pill ${
        typeFilter === t.id ? 'is-active' : ''
      }" data-action="select-note-type" data-type="${escapeHtml(t.id)}">${escapeHtml(
        t.label
      )} (${countByType.get(t.id) || 0})</button>`
    ),
  ].join('');

  const tags = collectNoteTags(activeItems);
  const tagPills =
    tags.length > 0
      ? `
        <div class="tag-filter-bar" aria-label="Filter notes by tag">
          <span class="tag-filter-label">Tags:</span>
          <button type="button" class="tag-pill ${
            !tagFilter ? 'is-active' : ''
          }" data-action="filter-note-tag" data-tag="">All Tags</button>
          ${tags
            .slice(0, 14)
            .map(
              (t) => `<button type="button" class="tag-pill ${
                tagFilter === t.tag ? 'is-active' : ''
              }" data-action="filter-note-tag" data-tag="${escapeHtml(t.tag)}">#${escapeHtml(
                t.tag
              )} (${t.count})</button>`
            )
            .join('')}
        </div>
      `
      : '';

  const existingNote =
    editingNoteId && editingNoteId !== '__new__'
      ? activeItems.find((i) => i.id === editingNoteId) || null
      : null;

  return `
    <section class="notes-shell">
      ${renderDriveStorageBar(data, editingDriveFolder)}

      <div class="panel-card toolbar-card">
        <div class="collection-toolbar">
          <div class="toolbar-search">
            <label for="notes-search-input" class="sr-only">Search notes, links, transcripts, and tags</label>
            <input
              id="notes-search-input"
              type="search"
              value="${escapeHtml(query)}"
              placeholder="Search notes, websites, video transcripts, tags, or linked recipes..."
            />
          </div>
          <div class="ref-toolbar-actions">
            <button
              type="button"
              class="btn btn-sm ${pinnedOnly ? 'btn-primary' : 'btn-outline'}"
              data-action="toggle-notes-pinned-only"
              aria-pressed="${pinnedOnly ? 'true' : 'false'}"
            >${pinnedOnly ? 'Pinned Only: On' : 'Pinned Only'}</button>
            ${
              visibleCardIds.length > 0
                ? `<button
                    type="button"
                    class="btn btn-sm btn-outline"
                    data-action="toggle-collapse-all-notes"
                    data-card-ids="${escapeHtml(visibleCardIds.join(','))}"
                  >${allCollapsed ? 'Expand All' : 'Collapse All'}</button>`
                : ''
            }
            <button type="button" class="btn btn-primary" data-action="new-note" data-note-type="note">+ Note</button>
            <button type="button" class="btn btn-outline" data-action="new-note" data-note-type="website">+ Website</button>
            <button type="button" class="btn btn-outline" data-action="new-note" data-note-type="video">+ Video</button>
            <button type="button" class="btn btn-outline" data-action="new-note" data-note-type="file">+ Drive File</button>
            <button
              type="button"
              class="badge ai-status-pill ${isAiReady(aiConfig) ? 'is-ready' : ''}"
              data-action="open-ai-settings"
              title="Configure Local Ollama or Gemini API in Sync & Backup"
            >${isAiReady(aiConfig) ? 'AI: Ready' : 'AI: Off'}</button>
          </div>
        </div>
        <div class="tag-filter-bar" aria-label="Filter by clipping type">
          <span class="tag-filter-label">Type:</span>
          ${typePills}
        </div>
        ${tagPills}
      </div>

      ${
        editingNoteId
          ? renderNoteEditorForm({
              editingNoteId,
              draftNote,
              existingNote,
              recipes: activeRecipes,
              driveFolderUrl: data.googleDriveFolderUrl,
              isFetchingTranscript,
              transcriptError,
              isAiSummarizing,
            })
          : ''
      }

      ${
        visibleItems.length > 0
          ? `<div class="notes-grid">
              ${visibleItems
                .map((item) =>
                  renderNoteCard({
                    item,
                    recipeMap,
                    isPinned: pinnedSet.has(`note-${item.id}`),
                    isCollapsed: collapsedSet.has(`note-${item.id}`),
                    embedExpanded: embedSet.has(item.id),
                    embedStartSec: startMap.get(item.id) || 0,
                    transcriptExpanded: transcriptSet.has(item.id),
                    aiBusyNoteId,
                  })
                )
                .join('')}
            </div>`
          : `<div class="panel-card empty-state">
              <p class="muted">
                ${
                  activeItems.length === 0
                    ? 'No kitchen notes, websites, videos, or Drive files saved yet. Use "+ Note", "+ Website", "+ Video", or "+ Drive File" above to start collecting.'
                    : 'No matching items found. Adjust your search, filters, or turn off "Pinned Only".'
                }
              </p>
            </div>`
      }
    </section>
  `;
}
