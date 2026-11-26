import './style.css';
import { APP_TITLE, IS_TEST_STAGE, PREF_KEYS, SITE_STAGE } from './config.js';
import {
  applyMergedSnapshot,
  clearAllTestData,
  duplicateRecipe,
  getSnapshot,
  initDatabase,
  replaceAllData,
  resetToSeedData,
  saveDividers,
  saveRecipe,
  softDeleteRecipe,
  toggleFavorite,
} from './db/database.js';
import { normalizeDivider, normalizeRecipe, parseTagsInput } from './lib/collection.js';
import { recipeToFilename, recipeToMarkdown, slugifyFilename } from './lib/markdown.js';
import { parseImportedContent, parseTextRecipe } from './lib/recipeImport.js';
import { fetchAndScrapeRecipeUrl } from './lib/webScraper.js';
import { createZipBlob } from './lib/zip.js';
import {
  forceSyncAllToCloud,
  getSyncSnapshot,
  initCloudSync,
  pushDividersToCloud,
  pushRecipeToCloud,
  signInWithEmail,
  signInWithGoogle,
  signOutCloud,
  signUpWithEmail,
} from './sync/cloudSync.js';
import { renderCollectionView } from './ui/collectionView.js';
import { renderDetailView } from './ui/detailView.js';
import { renderDividersView } from './ui/dividersView.js';
import { renderEditorView } from './ui/editorView.js';
import {
  createWakeLockController,
  downloadBlob,
  downloadJson,
  downloadTextFile,
  escapeHtml,
  generateId,
} from './ui/helpers.js';
import { renderImportView } from './ui/importView.js';
import { renderSyncView } from './ui/syncView.js';

const THEMES = [
  { id: 'parchment', label: 'Parchment' },
  { id: 'slate', label: 'Slate' },
  { id: 'dusk', label: 'Dusk' },
];

const FONT_SCALES = [
  { id: 'sm', label: 'A-' },
  { id: 'md', label: 'A' },
  { id: 'lg', label: 'A+' },
];

function readSavedPref(key, allowed, fallback) {
  try {
    const val = localStorage.getItem(key);
    return allowed.includes(val) ? val : fallback;
  } catch {
    return fallback;
  }
}

function savePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in restricted browsing contexts
  }
}

const state = {
  ready: false,
  view: 'collection', // 'collection' | 'detail' | 'editor' | 'import' | 'dividers' | 'sync'
  theme: readSavedPref(PREF_KEYS.theme, ['parchment', 'slate', 'dusk'], 'parchment'),
  fontScale: readSavedPref(PREF_KEYS.fontScale, ['sm', 'md', 'lg'], 'md'),
  detailLayout: readSavedPref(PREF_KEYS.detailLayout, ['binder', 'classic'], 'binder'),
  recipes: [],
  dividers: [],
  dividersUpdatedMs: 0,
  selectedRecipeId: null,
  editingRecipeId: null,
  draftRecipe: null,
  activeDividerId: 'all',
  favoritesOnly: false,
  activeTag: '',
  searchQuery: '',
  sortBy: 'updated',
  scaleFactor: 1,
  checkedIngredients: new Set(),
  checkedSteps: new Set(),
  wakeLockActive: false,
  importUrl: '',
  isScraping: false,
  scrapeError: '',
  pasteText: '',
  importSaveImmediately: false,
  isDragOver: false,
  syncSnapshot: getSyncSnapshot(),
  notice: null, // { tone: 'positive' | 'warning' | 'danger', text: string }
};

function applyRootPreferences() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.documentElement.setAttribute('data-font-scale', state.fontScale);
}

const wakeLock = createWakeLockController((active, errorMsg) => {
  state.wakeLockActive = active;
  if (errorMsg) {
    state.notice = { tone: 'warning', text: errorMsg };
  }
  render();
});

function setNotice(tone, text) {
  state.notice = { tone, text };
}

function getSyncPillLabel(snap) {
  if (!snap.configured) return 'Offline Local';
  if (snap.status === 'signed-out') return 'Cloud: Signed Out';
  if (snap.status === 'synced') return 'Cloud: Synced';
  if (snap.status === 'syncing' || snap.status === 'connecting') return 'Cloud: Syncing';
  if (snap.status === 'offline') return 'Cloud: Offline Queue';
  if (snap.status === 'error') return 'Cloud: Error';
  return 'Offline Local';
}

function getSyncPillClass(snap) {
  if (!snap.configured || snap.status === 'signed-out') return '';
  if (snap.status === 'synced') return 'is-synced';
  if (snap.status === 'error') return 'is-error';
  return 'is-test';
}

function renderTopbar() {
  const themeButtons = THEMES.map(
    (t) =>
      `<button type="button" class="seg-btn ${state.theme === t.id ? 'is-active' : ''}" data-action="set-theme" data-theme-id="${t.id}">${t.label}</button>`
  ).join('');

  const scaleButtons = FONT_SCALES.map(
    (s) =>
      `<button type="button" class="seg-btn ${state.fontScale === s.id ? 'is-active' : ''}" data-action="set-font-scale" data-scale-id="${s.id}">${s.label}</button>`
  ).join('');

  const syncLabel = getSyncPillLabel(state.syncSnapshot);
  const syncClass = getSyncPillClass(state.syncSnapshot);

  return `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand-block">
          <h1 class="brand-title">${escapeHtml(APP_TITLE)}</h1>
          <span class="status-pill ${IS_TEST_STAGE ? 'is-test' : 'is-live'}">${escapeHtml(SITE_STAGE)}</span>
          <span class="status-pill ${syncClass}">${escapeHtml(syncLabel)}</span>
        </div>

        <div class="topbar-controls">
          <div class="seg-control" role="group" aria-label="Color theme">
            ${themeButtons}
          </div>
          <div class="seg-control" role="group" aria-label="Recipe text size">
            ${scaleButtons}
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderNavBar() {
  const collectionActive = state.view === 'collection' || state.view === 'detail' || state.view === 'editor';
  return `
    <nav class="primary-nav-bar" aria-label="Primary navigation">
      <div class="nav-tab-list">
        <button type="button" class="nav-tab ${collectionActive ? 'is-active' : ''}" data-action="nav-view" data-view="collection">Collection</button>
        <button type="button" class="nav-tab ${state.view === 'import' ? 'is-active' : ''}" data-action="nav-view" data-view="import">Import</button>
        <button type="button" class="nav-tab ${state.view === 'dividers' ? 'is-active' : ''}" data-action="nav-view" data-view="dividers">Dividers</button>
        <button type="button" class="nav-tab ${state.view === 'sync' ? 'is-active' : ''}" data-action="nav-view" data-view="sync">Sync & Backup</button>
      </div>
    </nav>
  `;
}

function renderNotice() {
  if (!state.notice?.text) return '';
  return `
    <div class="notice-banner is-${escapeHtml(state.notice.tone || 'warning')}" role="status">
      <span>${escapeHtml(state.notice.text)}</span>
      <button type="button" class="btn btn-sm btn-secondary" data-action="dismiss-notice">Dismiss</button>
    </div>
  `;
}

function renderMainContent() {
  if (!state.ready) {
    return '<div class="panel-card"><p>Opening your local recipe binder...</p></div>';
  }

  if (state.view === 'detail') {
    const recipe = state.recipes.find((r) => r.id === state.selectedRecipeId);
    return renderDetailView({
      recipe,
      dividers: state.dividers,
      scaleFactor: state.scaleFactor,
      checkedIngredients: state.checkedIngredients,
      checkedSteps: state.checkedSteps,
      wakeLockActive: state.wakeLockActive,
      wakeLockSupported: wakeLock.isSupported,
      detailLayout: state.detailLayout,
    });
  }

  if (state.view === 'editor') {
    const isNew = !state.editingRecipeId;
    const existing = state.editingRecipeId
      ? state.recipes.find((r) => r.id === state.editingRecipeId)
      : null;
    const defaultDivider =
      state.activeDividerId !== 'all' ? state.activeDividerId : state.dividers[0]?.id || 'weeknight';
    return renderEditorView({
      recipe: existing || state.draftRecipe || { dividerId: defaultDivider },
      dividers: state.dividers,
      isNew,
    });
  }

  if (state.view === 'import') {
    return renderImportView({
      urlInput: state.importUrl,
      isScraping: state.isScraping,
      scrapeError: state.scrapeError,
      pasteText: state.pasteText,
      saveImmediately: state.importSaveImmediately,
      isDragOver: state.isDragOver,
    });
  }

  if (state.view === 'dividers') {
    return renderDividersView({
      dividers: state.dividers,
      recipes: state.recipes,
    });
  }

  if (state.view === 'sync') {
    return renderSyncView({
      syncSnapshot: state.syncSnapshot,
      recipes: state.recipes,
      dividers: state.dividers,
    });
  }

  return renderCollectionView({
    recipes: state.recipes,
    dividers: state.dividers,
    activeDividerId: state.activeDividerId,
    favoritesOnly: state.favoritesOnly,
    activeTag: state.activeTag,
    searchQuery: state.searchQuery,
    sortBy: state.sortBy,
    isDragOver: state.isDragOver,
  });
}

function render() {
  applyRootPreferences();
  const root = document.getElementById('app');
  if (!root) return;

  const activeEl = document.activeElement;
  const preserveSearchFocus = activeEl && activeEl.id === 'recipe-search-input';
  const selStart = preserveSearchFocus ? activeEl.selectionStart : null;
  const selEnd = preserveSearchFocus ? activeEl.selectionEnd : null;

  root.innerHTML = `
    ${renderTopbar()}
    <main class="content-area">
      ${renderNavBar()}
      ${renderNotice()}
      ${renderMainContent()}
    </main>
  `;

  if (preserveSearchFocus) {
    const nextSearch = document.getElementById('recipe-search-input');
    if (nextSearch) {
      nextSearch.focus();
      if (selStart !== null && selEnd !== null) {
        nextSearch.setSelectionRange(selStart, selEnd);
      }
    }
  }
}

function applySnapshotToState(snapshot) {
  state.recipes = snapshot.recipes || [];
  state.dividers = snapshot.dividers || [];
  state.dividersUpdatedMs = Number(snapshot.dividersUpdatedMs || 0);
  if (
    state.activeDividerId !== 'all' &&
    !state.dividers.some((d) => d.id === state.activeDividerId)
  ) {
    state.activeDividerId = 'all';
  }
}

function resetCookSession(releaseLock = true) {
  state.scaleFactor = 1;
  state.checkedIngredients = new Set();
  state.checkedSteps = new Set();
  if (releaseLock && wakeLock.isActive()) {
    wakeLock.release();
  }
}

async function handleAction(action, target) {
  if (action === 'set-theme') {
    state.theme = target.dataset.themeId || 'parchment';
    savePref(PREF_KEYS.theme, state.theme);
    render();
    return;
  }

  if (action === 'set-font-scale') {
    state.fontScale = target.dataset.scaleId || 'md';
    savePref(PREF_KEYS.fontScale, state.fontScale);
    render();
    return;
  }

  if (action === 'dismiss-notice') {
    state.notice = null;
    render();
    return;
  }

  if (action === 'nav-view') {
    const nextView = target.dataset.view || 'collection';
    if (state.view === 'detail' && nextView !== 'detail') {
      resetCookSession(true);
    }
    if (nextView !== 'editor') {
      state.draftRecipe = null;
    }
    state.view = nextView;
    render();
    return;
  }

  if (action === 'select-divider') {
    state.favoritesOnly = false;
    state.activeDividerId = target.dataset.dividerId || 'all';
    render();
    return;
  }

  if (action === 'toggle-favorites-filter') {
    state.favoritesOnly = !state.favoritesOnly;
    if (state.favoritesOnly) {
      state.activeDividerId = 'all';
    }
    render();
    return;
  }

  if (action === 'select-tag') {
    const nextTag = target.dataset.tag || '';
    state.activeTag = state.activeTag === nextTag ? '' : nextTag;
    render();
    return;
  }

  if (action === 'jump-tag') {
    resetCookSession(true);
    state.activeTag = target.dataset.tag || '';
    state.activeDividerId = 'all';
    state.favoritesOnly = false;
    state.view = 'collection';
    render();
    return;
  }

  if (action === 'clear-filters') {
    state.activeDividerId = 'all';
    state.favoritesOnly = false;
    state.activeTag = '';
    state.searchQuery = '';
    render();
    return;
  }

  if (action === 'open-recipe') {
    resetCookSession(true);
    state.draftRecipe = null;
    state.selectedRecipeId = target.dataset.recipeId || null;
    state.view = 'detail';
    render();
    return;
  }

  if (action === 'back-collection') {
    resetCookSession(true);
    state.draftRecipe = null;
    state.selectedRecipeId = null;
    state.view = 'collection';
    render();
    return;
  }

  if (action === 'new-recipe') {
    resetCookSession(true);
    state.editingRecipeId = null;
    state.draftRecipe = null;
    state.view = 'editor';
    render();
    return;
  }

  if (action === 'edit-recipe') {
    resetCookSession(true);
    state.draftRecipe = null;
    state.editingRecipeId = target.dataset.recipeId || state.selectedRecipeId;
    state.view = 'editor';
    render();
    return;
  }

  if (action === 'cancel-edit') {
    state.draftRecipe = null;
    state.view = state.editingRecipeId && state.selectedRecipeId ? 'detail' : 'collection';
    state.editingRecipeId = null;
    render();
    return;
  }

  if (action === 'toggle-favorite') {
    const id = target.dataset.recipeId;
    if (!id) return;
    const updated = await toggleFavorite(id);
    if (updated) {
      applySnapshotToState(await getSnapshot());
      await pushRecipeToCloud(updated, state.dividers[0]?.id);
    }
    render();
    return;
  }

  if (action === 'duplicate-recipe') {
    const id = target.dataset.recipeId || state.selectedRecipeId;
    if (!id) return;
    const copy = await duplicateRecipe(id, generateId('rec'));
    if (copy) {
      applySnapshotToState(await getSnapshot());
      await pushRecipeToCloud(copy, state.dividers[0]?.id);
      state.selectedRecipeId = copy.id;
      state.editingRecipeId = copy.id;
      state.draftRecipe = null;
      state.view = 'editor';
      setNotice('positive', `Duplicated "${copy.title}". Make your edits and save.`);
    }
    render();
    return;
  }

  if (action === 'delete-recipe') {
    const id = target.dataset.recipeId || state.selectedRecipeId;
    const targetRec = state.recipes.find((r) => r.id === id);
    if (!targetRec) return;
    if (!window.confirm(`Delete "${targetRec.title}" from your binder?`)) return;

    const tombstoned = await softDeleteRecipe(id);
    if (tombstoned) {
      applySnapshotToState(await getSnapshot());
      await pushRecipeToCloud(tombstoned, state.dividers[0]?.id);
      resetCookSession(true);
      state.selectedRecipeId = null;
      state.view = 'collection';
      setNotice('warning', `Deleted "${targetRec.title}".`);
    }
    render();
    return;
  }

  if (action === 'set-detail-layout') {
    const nextLayout = target.dataset.layout === 'classic' ? 'classic' : 'binder';
    state.detailLayout = nextLayout;
    savePref(PREF_KEYS.detailLayout, nextLayout);
    render();
    return;
  }

  if (action === 'export-recipe-md') {
    const id = target.dataset.recipeId || state.selectedRecipeId;
    const recipe = state.recipes.find((r) => r.id === id && !r.deleted);
    if (!recipe) return;
    const dividerName = state.dividers.find((d) => d.id === recipe.dividerId)?.name || 'Unfiled';
    const md = recipeToMarkdown(recipe, { dividerName, scaleFactor: state.scaleFactor });
    const filename = recipeToFilename(recipe);
    downloadTextFile(filename, md, 'text/markdown;charset=utf-8');
    setNotice('positive', `Exported "${filename}".`);
    render();
    return;
  }

  if (action === 'export-all-md-zip') {
    const activeRecipes = state.recipes.filter((r) => r && !r.deleted);
    if (activeRecipes.length === 0) {
      setNotice('warning', 'No active recipes to export.');
      render();
      return;
    }
    const dividerMap = new Map(state.dividers.map((d) => [d.id, d.name]));
    const entries = activeRecipes.map((recipe) => {
      const dividerName = dividerMap.get(recipe.dividerId) || 'Unfiled';
      const folder = slugifyFilename(dividerName, recipe.dividerId || 'unfiled');
      return {
        name: `${folder}/${recipeToFilename(recipe)}`,
        content: recipeToMarkdown(recipe, { dividerName }),
      };
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(`recipe-binder-markdown-${stamp}.zip`, createZipBlob(entries));
    setNotice('positive', `Exported ${entries.length} Markdown recipe(s) in a .zip archive.`);
    render();
    return;
  }

  if (action === 'convert-pasted-text') {
    const defaultDivider =
      state.activeDividerId !== 'all' ? state.activeDividerId : state.dividers[0]?.id || 'weeknight';
    try {
      const parsed = parseTextRecipe(state.pasteText, {
        dividers: state.dividers,
        fallbackDividerId: defaultDivider,
      });
      state.draftRecipe = parsed;
      state.editingRecipeId = null;
      state.view = 'editor';
      setNotice('positive', `Converted "${parsed.title}" — review and save to your binder.`);
    } catch (err) {
      setNotice('warning', err.message || 'Could not convert pasted text.');
    }
    render();
    return;
  }

  if (action === 'paste-clipboard') {
    if (!navigator.clipboard?.readText) {
      setNotice('warning', 'Clipboard read is not available in this browser — paste directly into the box with Ctrl+V.');
      render();
      return;
    }
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText || !clipText.trim()) {
        setNotice('warning', 'Clipboard is empty.');
      } else {
        state.pasteText = clipText;
        setNotice('positive', 'Pasted text from clipboard. Click "Convert to Recipe" when ready.');
      }
    } catch {
      setNotice('warning', 'Clipboard access was denied — click inside the text box and press Ctrl+V.');
    }
    render();
    return;
  }

  if (action === 'clear-paste-text') {
    state.pasteText = '';
    render();
    return;
  }

  if (action === 'set-scale') {
    const next = Number(target.dataset.scale || 1);
    if (Number.isFinite(next) && next > 0) {
      state.scaleFactor = next;
      render();
    }
    return;
  }

  if (action === 'reset-checks') {
    state.checkedIngredients = new Set();
    state.checkedSteps = new Set();
    render();
    return;
  }

  if (action === 'toggle-wake-lock') {
    await wakeLock.toggle();
    return;
  }

  if (action === 'print-recipe') {
    window.print();
    return;
  }

  if (action === 'move-divider-up' || action === 'move-divider-down') {
    const id = target.dataset.dividerId;
    const idx = state.dividers.findIndex((d) => d.id === id);
    if (idx === -1) return;
    const swapIdx = action === 'move-divider-up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= state.dividers.length) return;
    const next = [...state.dividers];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const saved = await saveDividers(next);
    applySnapshotToState(await getSnapshot());
    await pushDividersToCloud(saved.dividers, saved.dividersUpdatedMs);
    render();
    return;
  }

  if (action === 'rename-divider') {
    const id = target.dataset.dividerId;
    const input = document.querySelector(`[data-divider-name-input="${CSS.escape(id)}"]`);
    const nextName = String(input?.value || '').trim();
    if (!nextName) {
      setNotice('warning', 'Divider name cannot be empty.');
      render();
      return;
    }
    const next = state.dividers.map((d) => (d.id === id ? { ...d, name: nextName } : d));
    const saved = await saveDividers(next);
    applySnapshotToState(await getSnapshot());
    await pushDividersToCloud(saved.dividers, saved.dividersUpdatedMs);
    setNotice('positive', `Renamed divider to "${nextName}".`);
    render();
    return;
  }

  if (action === 'delete-divider') {
    const id = target.dataset.dividerId;
    if (state.dividers.length <= 1) return;
    const targetDiv = state.dividers.find((d) => d.id === id);
    const remaining = state.dividers.filter((d) => d.id !== id);
    const fallback = remaining[0];
    if (!targetDiv || !fallback) return;

    if (
      !window.confirm(
        `Delete divider "${targetDiv.name}"? Any recipes in this section will move to "${fallback.name}".`
      )
    ) {
      return;
    }

    const affected = state.recipes.filter((r) => !r.deleted && r.dividerId === id);
    for (const rec of affected) {
      const moved = await saveRecipe({ ...rec, dividerId: fallback.id });
      await pushRecipeToCloud(moved, fallback.id);
    }
    const saved = await saveDividers(remaining);
    applySnapshotToState(await getSnapshot());
    await pushDividersToCloud(saved.dividers, saved.dividersUpdatedMs);
    setNotice('warning', `Deleted "${targetDiv.name}" and moved ${affected.length} recipe(s) to "${fallback.name}".`);
    render();
    return;
  }

  if (action === 'export-backup') {
    const snapshot = await getSnapshot();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`recipe-binder-${SITE_STAGE.toLowerCase()}-${stamp}.json`, {
      app: APP_TITLE,
      stage: SITE_STAGE,
      exportedAt: new Date().toISOString(),
      dividers: snapshot.dividers,
      dividersUpdatedMs: snapshot.dividersUpdatedMs,
      recipes: snapshot.recipes,
    });
    setNotice('positive', 'Exported JSON backup.');
    render();
    return;
  }

  if (action === 'sign-in-google') {
    try {
      await signInWithGoogle();
    } catch (err) {
      setNotice('danger', err.message);
      render();
    }
    return;
  }

  if (action === 'sign-up-email') {
    const email = document.getElementById('auth-email')?.value || '';
    const password = document.getElementById('auth-password')?.value || '';
    try {
      await signUpWithEmail(email, password);
    } catch (err) {
      setNotice('danger', err.message);
      render();
    }
    return;
  }

  if (action === 'sign-out-cloud') {
    await signOutCloud();
    setNotice('positive', 'Signed out of cloud sync. Local recipes remain available offline.');
    render();
    return;
  }

  if (action === 'force-cloud-sync') {
    try {
      const snap = await getSnapshot();
      await forceSyncAllToCloud(snap);
      setNotice('positive', 'Cloud sync completed.');
    } catch (err) {
      setNotice('danger', err.message);
    }
    render();
    return;
  }

  if (action === 'reset-seed-test') {
    if (!IS_TEST_STAGE) return;
    if (!window.confirm('Reset sandbox binder to the 4 starter recipes?')) return;
    const snap = await resetToSeedData();
    applySnapshotToState(snap);
    if (state.syncSnapshot.user) {
      await forceSyncAllToCloud(snap).catch(() => {});
    }
    setNotice('positive', 'Restored starter sample recipes in TEST sandbox.');
    render();
    return;
  }

  if (action === 'clear-all-test') {
    if (!IS_TEST_STAGE) return;
    if (!window.confirm('Clear all recipes in the TEST sandbox?')) return;
    const snap = await clearAllTestData();
    applySnapshotToState(snap);
    setNotice('warning', 'Cleared all recipes from TEST sandbox.');
    render();
  }
}

async function importBackupSnapshot(parsed, mode = 'merge') {
  if (!Array.isArray(parsed?.recipes)) {
    throw new Error('Backup JSON must include a recipes array.');
  }

  if (mode === 'replace') {
    if (!window.confirm('Replace all local recipes and dividers with this backup file?')) {
      return null;
    }
    const snap = await replaceAllData(parsed);
    applySnapshotToState(snap);
    if (state.syncSnapshot.user) {
      await forceSyncAllToCloud(snap).catch(() => {});
    }
    return {
      mode: 'replace',
      activeCount: snap.recipes.filter((r) => !r.deleted).length,
    };
  }

  const local = await getSnapshot();
  const { mergeCollectionSnapshots } = await import('./lib/collection.js');
  const merged = mergeCollectionSnapshots(local, parsed);
  const snap = await applyMergedSnapshot(merged);
  applySnapshotToState(snap);
  if (state.syncSnapshot.user) {
    await forceSyncAllToCloud(snap).catch(() => {});
  }
  return {
    mode: 'merge',
    activeCount: snap.recipes.filter((r) => !r.deleted).length,
  };
}

async function handleImportedFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (files.length === 0) return;

  const fallbackDividerId =
    state.activeDividerId !== 'all' ? state.activeDividerId : state.dividers[0]?.id || 'weeknight';
  const importedRecipes = [];
  let mergedSnapshots = 0;
  const failed = [];

  for (const file of files) {
    try {
      const content = await file.text();
      const result = parseImportedContent(content, {
        filename: file.name,
        dividers: state.dividers,
        fallbackDividerId,
      });

      if (result.kind === 'snapshot') {
        await importBackupSnapshot(result.snapshot, 'merge');
        mergedSnapshots += 1;
      } else if (result.kind === 'recipe') {
        importedRecipes.push(result.recipe);
      }
    } catch (err) {
      failed.push(`${file.name}: ${err?.message || 'Unrecognized format'}`);
    }
  }

  if (files.length === 1 && importedRecipes.length === 1 && !state.importSaveImmediately) {
    state.draftRecipe = importedRecipes[0];
    state.editingRecipeId = null;
    state.view = 'editor';
    setNotice('positive', `Loaded "${importedRecipes[0].title}" from ${files[0].name} — review and save.`);
    render();
    return;
  }

  if (importedRecipes.length > 0) {
    const existingIds = new Set(state.recipes.map((r) => r.id));
    for (const draft of importedRecipes) {
      const id = draft.id && !existingIds.has(draft.id) ? draft.id : draft.id || generateId('rec');
      const saved = await saveRecipe({
        ...draft,
        id,
        createdAt: draft.createdAt || new Date().toISOString(),
      });
      existingIds.add(saved.id);
      await pushRecipeToCloud(saved, fallbackDividerId);
    }
    applySnapshotToState(await getSnapshot());
  }

  if (importedRecipes.length > 0 || mergedSnapshots > 0) {
    state.draftRecipe = null;
    state.view = 'collection';
    const summaryParts = [];
    if (importedRecipes.length > 0) summaryParts.push(`imported ${importedRecipes.length} recipe(s)`);
    if (mergedSnapshots > 0) summaryParts.push(`merged ${mergedSnapshots} backup(s)`);
    if (failed.length > 0) summaryParts.push(`${failed.length} skipped`);
    setNotice(failed.length > 0 ? 'warning' : 'positive', `Successfully ${summaryParts.join(', ')}.`);
  } else if (failed.length > 0) {
    setNotice('danger', `Import failed — ${failed[0]}`);
  }
  render();
}

document.addEventListener('click', (event) => {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (
    action === 'search-input' ||
    action === 'sort-change' ||
    action === 'toggle-ingredient-check' ||
    action === 'toggle-step-check' ||
    action === 'toggle-save-immediately'
  ) {
    return;
  }
  handleAction(action, actionEl);
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.dataset.action === 'search-input') {
    state.searchQuery = target.value;
    render();
    return;
  }
  if (target.id === 'scrape-url-input') {
    state.importUrl = target.value;
    state.scrapeError = '';
    return;
  }
  if (target.id === 'paste-recipe-textarea') {
    state.pasteText = target.value;
  }
});

document.addEventListener('change', async (event) => {
  const target = event.target;

  if (target.dataset.action === 'sort-change') {
    state.sortBy = target.value || 'updated';
    render();
    return;
  }

  if (target.dataset.action === 'toggle-save-immediately') {
    state.importSaveImmediately = Boolean(target.checked);
    return;
  }

  if (target.dataset.action === 'toggle-ingredient-check') {
    const idx = Number(target.dataset.index);
    if (target.checked) {
      state.checkedIngredients.add(idx);
    } else {
      state.checkedIngredients.delete(idx);
    }
    render();
    return;
  }

  if (target.dataset.action === 'toggle-step-check') {
    const idx = Number(target.dataset.index);
    if (target.checked) {
      state.checkedSteps.add(idx);
    } else {
      state.checkedSteps.delete(idx);
    }
    render();
    return;
  }

  if (target.id === 'import-files-input' || target.id === 'sync-import-md-input') {
    try {
      await handleImportedFiles(target.files);
    } finally {
      target.value = '';
    }
    return;
  }

  if (target.id === 'import-backup-input') {
    const file = target.files?.[0];
    if (!file) return;
    const mode = document.getElementById('import-mode-select')?.value || 'merge';
    try {
      const parsed = JSON.parse(await file.text());
      const res = await importBackupSnapshot(parsed, mode);
      if (res?.mode === 'replace') {
        setNotice('positive', `Replaced binder with ${res.activeCount} recipe(s).`);
      } else if (res?.mode === 'merge') {
        setNotice('positive', `Merged backup into binder (${res.activeCount} active recipe(s)).`);
      }
    } catch (err) {
      setNotice('danger', `Backup import failed: ${err.message}`);
    } finally {
      target.value = '';
      render();
    }
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;

  if (form.id === 'scrape-url-form') {
    event.preventDefault();
    const urlInput = form.querySelector('#scrape-url-input');
    const url = String(urlInput?.value ?? state.importUrl ?? '').trim();
    state.importUrl = url;
    state.isScraping = true;
    state.scrapeError = '';
    render();

    const fallbackDividerId =
      state.activeDividerId !== 'all' ? state.activeDividerId : state.dividers[0]?.id || 'weeknight';

    try {
      const parsed = await fetchAndScrapeRecipeUrl(url, {
        dividers: state.dividers,
        fallbackDividerId,
      });
      state.isScraping = false;
      state.draftRecipe = parsed;
      state.editingRecipeId = null;
      state.view = 'editor';
      setNotice('positive', `Imported "${parsed.title}" from website — review and save.`);
    } catch (err) {
      state.isScraping = false;
      state.scrapeError = err?.message || 'Failed to scrape recipe webpage.';
    }
    render();
    return;
  }

  if (form.id === 'recipe-editor-form') {
    event.preventDefault();
    const fd = new FormData(form);
    const existingId = form.dataset.recipeId;
    const existing = existingId ? state.recipes.find((r) => r.id === existingId) : null;
    const id = existing?.id || generateId('rec');

    const saved = await saveRecipe({
      id,
      title: fd.get('title'),
      dividerId: fd.get('dividerId'),
      source: fd.get('source'),
      summary: fd.get('summary'),
      prepMinutes: fd.get('prepMinutes'),
      cookMinutes: fd.get('cookMinutes'),
      servings: fd.get('servings'),
      tags: parseTagsInput(fd.get('tags')),
      ingredients: String(fd.get('ingredients') || '').split(/\r?\n/),
      steps: String(fd.get('steps') || '').split(/\r?\n/),
      notes: fd.get('notes'),
      favorite: fd.get('favorite') === 'on',
      createdAt: existing?.createdAt || new Date().toISOString(),
    });

    applySnapshotToState(await getSnapshot());
    await pushRecipeToCloud(saved, state.dividers[0]?.id);
    state.editingRecipeId = null;
    state.draftRecipe = null;
    state.selectedRecipeId = saved.id;
    state.view = 'detail';
    setNotice('positive', `Saved "${saved.title}".`);
    render();
    return;
  }

  if (form.id === 'add-divider-form') {
    event.preventDefault();
    const input = form.querySelector('input[name="name"]');
    const name = String(input?.value || '').trim();
    if (!name) return;

    const baseId =
      name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '') || 'section';
    let uniqueId = baseId;
    let suffix = 2;
    while (state.dividers.some((d) => d.id === uniqueId)) {
      uniqueId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    const next = [...state.dividers, normalizeDivider({ id: uniqueId, name, order: state.dividers.length }, state.dividers.length)];
    const saved = await saveDividers(next);
    applySnapshotToState(await getSnapshot());
    await pushDividersToCloud(saved.dividers, saved.dividersUpdatedMs);
    setNotice('positive', `Added divider "${name}".`);
    render();
    return;
  }

  if (form.id === 'email-auth-form') {
    event.preventDefault();
    const email = document.getElementById('auth-email')?.value || '';
    const password = document.getElementById('auth-password')?.value || '';
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setNotice('danger', err.message);
      render();
    }
  }
});

let dragDepth = 0;

function hasFileTransfer(event) {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

window.addEventListener('dragenter', (event) => {
  if (!hasFileTransfer(event)) return;
  event.preventDefault();
  dragDepth += 1;
  if ((state.view === 'import' || state.view === 'collection') && !state.isDragOver) {
    state.isDragOver = true;
    render();
  }
});

window.addEventListener('dragover', (event) => {
  if (!hasFileTransfer(event)) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
});

window.addEventListener('dragleave', (event) => {
  if (!hasFileTransfer(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0 && state.isDragOver) {
    state.isDragOver = false;
    render();
  }
});

window.addEventListener('drop', async (event) => {
  if (!hasFileTransfer(event)) return;
  event.preventDefault();
  dragDepth = 0;
  state.isDragOver = false;
  if (state.view === 'import' || state.view === 'collection') {
    await handleImportedFiles(event.dataTransfer?.files);
  } else {
    render();
  }
});

async function bootstrap() {
  applyRootPreferences();
  render();

  const initial = await initDatabase();
  applySnapshotToState(initial);
  state.ready = true;
  render();

  initCloudSync({
    getLocalSnapshot: () => getSnapshot(),
    onMergedSnapshot: async (merged) => {
      const updated = await applyMergedSnapshot(merged);
      applySnapshotToState(updated);
      render();
    },
    onStatusChange: (snap) => {
      state.syncSnapshot = snap;
      render();
    },
  });
}

bootstrap().catch((err) => {
  state.ready = true;
  setNotice('danger', `Failed to open Recipe Binder database: ${err.message}`);
  render();
});
