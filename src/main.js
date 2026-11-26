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
import { createWakeLockController, downloadJson, escapeHtml, generateId } from './ui/helpers.js';
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
  view: 'collection', // 'collection' | 'detail' | 'editor' | 'dividers' | 'sync'
  theme: readSavedPref(PREF_KEYS.theme, ['parchment', 'slate', 'dusk'], 'parchment'),
  fontScale: readSavedPref(PREF_KEYS.fontScale, ['sm', 'md', 'lg'], 'md'),
  recipes: [],
  dividers: [],
  dividersUpdatedMs: 0,
  selectedRecipeId: null,
  editingRecipeId: null,
  activeDividerId: 'all',
  favoritesOnly: false,
  activeTag: '',
  searchQuery: '',
  sortBy: 'updated',
  scaleFactor: 1,
  checkedIngredients: new Set(),
  checkedSteps: new Set(),
  wakeLockActive: false,
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
      recipe: existing || { dividerId: defaultDivider },
      dividers: state.dividers,
      isNew,
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
    state.selectedRecipeId = target.dataset.recipeId || null;
    state.view = 'detail';
    render();
    return;
  }

  if (action === 'back-collection') {
    resetCookSession(true);
    state.selectedRecipeId = null;
    state.view = 'collection';
    render();
    return;
  }

  if (action === 'new-recipe') {
    resetCookSession(true);
    state.editingRecipeId = null;
    state.view = 'editor';
    render();
    return;
  }

  if (action === 'edit-recipe') {
    resetCookSession(true);
    state.editingRecipeId = target.dataset.recipeId || state.selectedRecipeId;
    state.view = 'editor';
    render();
    return;
  }

  if (action === 'cancel-edit') {
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

document.addEventListener('click', (event) => {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (
    action === 'search-input' ||
    action === 'sort-change' ||
    action === 'toggle-ingredient-check' ||
    action === 'toggle-step-check'
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
  }
});

document.addEventListener('change', async (event) => {
  const target = event.target;

  if (target.dataset.action === 'sort-change') {
    state.sortBy = target.value || 'updated';
    render();
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

  if (target.id === 'import-backup-input') {
    const file = target.files?.[0];
    if (!file) return;
    const mode = document.getElementById('import-mode-select')?.value || 'merge';
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed?.recipes)) {
        throw new Error('Backup JSON must include a recipes array.');
      }

      if (mode === 'replace') {
        if (!window.confirm('Replace all local recipes and dividers with this backup file?')) {
          target.value = '';
          return;
        }
        const snap = await replaceAllData(parsed);
        applySnapshotToState(snap);
        if (state.syncSnapshot.user) {
          await forceSyncAllToCloud(snap).catch(() => {});
        }
        setNotice('positive', `Replaced binder with ${snap.recipes.filter((r) => !r.deleted).length} recipe(s).`);
      } else {
        const local = await getSnapshot();
        const { mergeCollectionSnapshots } = await import('./lib/collection.js');
        const merged = mergeCollectionSnapshots(local, parsed);
        const snap = await applyMergedSnapshot(merged);
        applySnapshotToState(snap);
        if (state.syncSnapshot.user) {
          await forceSyncAllToCloud(snap).catch(() => {});
        }
        setNotice('positive', `Merged backup into binder (${snap.recipes.filter((r) => !r.deleted).length} active recipe(s)).`);
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
