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
  saveMealPrepData,
  savePantryData,
  saveRecipe,
  saveReferenceData,
  softDeleteRecipe,
  toggleFavorite,
} from './db/database.js';
import {
  getRecipeMethods,
  mergeCollectionSnapshots,
  normalizeDivider,
  normalizeRecipe,
  parseTagsInput,
} from './lib/collection.js';
import { recipeToFilename, recipeToMarkdown, slugifyFilename } from './lib/markdown.js';
import {
  adjustFreezerPortions,
  deleteMealPrepItem,
  getDefaultMealPrepData,
  normalizeBatchTemplate,
  normalizeDerivative,
  normalizeFreezerItem,
  upsertMealPrepItem,
} from './lib/mealPrep.js';
import {
  cyclePantryStatus,
  deletePantryItem,
  extractCoreIngredientName,
  getDefaultPantryData,
  normalizeIngredientKey,
  normalizePantryItem,
  toggleAlwaysStocked,
  upsertPantryItem,
} from './lib/pantry.js';
import { parseImportedContent, parseTextRecipe } from './lib/recipeImport.js';
import {
  deleteFlavorItem,
  deleteReferenceItem,
  getDefaultReferenceData,
  normalizeFlavor,
  normalizeSubstitution,
  normalizeTechnique,
  upsertReferenceItem,
} from './lib/reference.js';
import { fetchAndScrapeRecipeUrl } from './lib/webScraper.js';
import { createZipBlob } from './lib/zip.js';
import {
  forceSyncAllToCloud,
  getSyncSnapshot,
  initCloudSync,
  pushDividersToCloud,
  pushMealPrepDataToCloud,
  pushPantryDataToCloud,
  pushRecipeToCloud,
  pushReferenceDataToCloud,
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
import { renderMealPrepView } from './ui/mealPrepView.js';
import { renderPantryView } from './ui/pantryView.js';
import {
  renderConverterResultHtml,
  renderReferenceView,
  renderTechniqueModal,
} from './ui/referenceView.js';
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

const CONVERTER_MODE_DEFAULTS = {
  'volume-weight': { fromUnit: 'cup', toUnit: 'g' },
  volume: { fromUnit: 'cup', toUnit: 'tbsp' },
  weight: { fromUnit: 'oz', toUnit: 'g' },
  temperature: { fromUnit: 'f', toUnit: 'c' },
};

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
  view: 'collection', // 'collection' | 'detail' | 'editor' | 'import' | 'reference' | 'dividers' | 'sync'
  theme: readSavedPref(PREF_KEYS.theme, ['parchment', 'slate', 'dusk'], 'parchment'),
  fontScale: readSavedPref(PREF_KEYS.fontScale, ['sm', 'md', 'lg'], 'md'),
  detailLayout: readSavedPref(PREF_KEYS.detailLayout, ['binder', 'classic'], 'binder'),
  printMethodsMode: readSavedPref(PREF_KEYS.printMethodsMode, ['selected', 'all'], 'selected'),
  unitMode: readSavedPref(PREF_KEYS.unitMode, ['original', 'metric', 'us-weight'], 'original'),
  recipes: [],
  dividers: [],
  dividersUpdatedMs: 0,
  referenceData: getDefaultReferenceData(),
  mealPrepData: getDefaultMealPrepData(),
  pantryData: getDefaultPantryData(),
  selectedRecipeId: null,
  editingRecipeId: null,
  draftRecipe: null,
  activeDividerId: 'all',
  favoritesOnly: false,
  activeMethod: '',
  activeTag: '',
  searchQuery: '',
  sortBy: 'updated',
  scaleFactor: 1,
  activeMethodIndex: 0,
  activeTechniqueId: null,
  referenceTab: 'converter',
  mealPrepTab: 'freezer',
  freezerFilter: 'all',
  freezerQuery: '',
  editingFreezerId: null,
  prefillFreezer: null,
  editingTemplateId: null,
  timelineSelections: {},
  checkedTimelineSteps: new Set(),
  pantryTab: 'inventory',
  pantryCategory: 'all',
  pantryStatusFilter: 'all',
  pantryQuery: '',
  editingPantryId: null,
  matcherSelectedNames: new Set(),
  matcherIncludeStaples: true,
  matcherFilter: 'all',
  matcherSearch: '',
  converter: {
    mode: 'volume-weight',
    value: '1',
    fromUnit: 'cup',
    toUnit: 'g',
    ingredientId: 'ap-flour',
  },
  refSubCategory: 'all',
  refSubQuery: '',
  editingSubId: null,
  refChartQuery: '',
  refTechniqueCategory: 'all',
  refTechniqueQuery: '',
  editingTechniqueId: null,
  selectedFlavorId: 'rosemary',
  editingFlavorId: null,
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

let noticeTimer = null;
const NOTICE_DURATIONS = {
  positive: 4500,
  warning: 6500,
  danger: 9000,
};

function clearNoticeBannerDom() {
  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }
  state.notice = null;
  const banner = document.querySelector('.notice-banner');
  if (banner) {
    banner.remove();
  }
}

function applyRootPreferences() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.documentElement.setAttribute('data-font-scale', state.fontScale);
}

const wakeLock = createWakeLockController((active, errorMsg) => {
  state.wakeLockActive = active;
  if (errorMsg) {
    setNotice('warning', errorMsg);
  }
  render();
});

function setNotice(tone, text, durationMs) {
  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }
  state.notice = { tone, text };
  const delay = durationMs ?? NOTICE_DURATIONS[tone] ?? 5000;
  if (delay > 0) {
    noticeTimer = setTimeout(clearNoticeBannerDom, delay);
  }
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
          <span id="topbar-sync-pill" class="status-pill ${syncClass}">${escapeHtml(syncLabel)}</span>
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

function updateSyncPillDom() {
  const pill = document.getElementById('topbar-sync-pill');
  if (!pill) return;
  const syncLabel = getSyncPillLabel(state.syncSnapshot);
  const syncClass = getSyncPillClass(state.syncSnapshot);
  pill.className = `status-pill ${syncClass}`.trim();
  pill.textContent = syncLabel;
}

function renderNavBar() {
  const collectionActive = state.view === 'collection' || state.view === 'detail' || state.view === 'editor';
  return `
    <nav class="primary-nav-bar" aria-label="Primary navigation">
      <div class="nav-tab-list">
        <button type="button" class="nav-tab ${collectionActive ? 'is-active' : ''}" data-action="nav-view" data-view="collection">Collection</button>
        <button type="button" class="nav-tab ${state.view === 'import' ? 'is-active' : ''}" data-action="nav-view" data-view="import">Import</button>
        <button type="button" class="nav-tab ${state.view === 'mealprep' ? 'is-active' : ''}" data-action="nav-view" data-view="mealprep">Meal Prep</button>
        <button type="button" class="nav-tab ${state.view === 'pantry' ? 'is-active' : ''}" data-action="nav-view" data-view="pantry">Pantry</button>
        <button type="button" class="nav-tab ${state.view === 'reference' ? 'is-active' : ''}" data-action="nav-view" data-view="reference">Reference</button>
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
      unitMode: state.unitMode,
      checkedIngredients: state.checkedIngredients,
      checkedSteps: state.checkedSteps,
      wakeLockActive: state.wakeLockActive,
      wakeLockSupported: wakeLock.isSupported,
      detailLayout: state.detailLayout,
      activeMethodIndex: state.activeMethodIndex,
      printMethodsMode: state.printMethodsMode,
      techniques: state.referenceData.techniques,
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
      recipe: state.draftRecipe || existing || { dividerId: defaultDivider },
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

  if (state.view === 'mealprep') {
    return renderMealPrepView({
      activeTab: state.mealPrepTab,
      mealPrepData: state.mealPrepData,
      recipes: state.recipes,
      freezerFilter: state.freezerFilter,
      freezerQuery: state.freezerQuery,
      editingFreezerId: state.editingFreezerId,
      prefillFreezer: state.prefillFreezer,
      editingTemplateId: state.editingTemplateId,
      timelineSelections: state.timelineSelections,
      checkedTimelineSteps: state.checkedTimelineSteps,
    });
  }

  if (state.view === 'pantry') {
    return renderPantryView({
      activeTab: state.pantryTab,
      pantryData: state.pantryData,
      recipes: state.recipes,
      dividers: state.dividers,
      pantryCategory: state.pantryCategory,
      pantryStatusFilter: state.pantryStatusFilter,
      pantryQuery: state.pantryQuery,
      editingPantryId: state.editingPantryId,
      matcherSelectedNames: state.matcherSelectedNames,
      matcherIncludeStaples: state.matcherIncludeStaples,
      matcherFilter: state.matcherFilter,
      matcherSearch: state.matcherSearch,
    });
  }

  if (state.view === 'reference') {
    return renderReferenceView({
      activeTab: state.referenceTab,
      referenceData: state.referenceData,
      converterState: state.converter,
      subCategory: state.refSubCategory,
      subQuery: state.refSubQuery,
      editingSubId: state.editingSubId,
      chartQuery: state.refChartQuery,
      techniqueCategory: state.refTechniqueCategory,
      techniqueQuery: state.refTechniqueQuery,
      editingTechniqueId: state.editingTechniqueId,
      selectedFlavorId: state.selectedFlavorId,
      editingFlavorId: state.editingFlavorId,
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
    activeMethod: state.activeMethod,
    activeTag: state.activeTag,
    searchQuery: state.searchQuery,
    sortBy: state.sortBy,
    isDragOver: state.isDragOver,
  });
}

const PRESERVED_SEARCH_IDS = new Set([
  'recipe-search-input',
  'mealprep-freezer-search',
  'pantry-search-input',
  'matcher-ingredient-search',
  'reference-sub-search',
  'reference-chart-search',
  'reference-technique-search',
]);

function render() {
  applyRootPreferences();
  const root = document.getElementById('app');
  if (!root) return;

  const activeEl = document.activeElement;
  const focusId = activeEl && PRESERVED_SEARCH_IDS.has(activeEl.id) ? activeEl.id : '';
  const selStart = focusId ? activeEl.selectionStart : null;
  const selEnd = focusId ? activeEl.selectionEnd : null;

  root.innerHTML = `
    ${renderTopbar()}
    <main class="content-area">
      ${renderNavBar()}
      ${renderNotice()}
      ${renderMainContent()}
    </main>
    ${renderTechniqueModal(state.activeTechniqueId, state.referenceData.techniques)}
  `;

  if (focusId) {
    const nextSearch = document.getElementById(focusId);
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
  state.referenceData = snapshot.referenceData || getDefaultReferenceData();
  state.mealPrepData = snapshot.mealPrepData || getDefaultMealPrepData();
  state.pantryData = snapshot.pantryData || getDefaultPantryData();
  if (
    state.activeDividerId !== 'all' &&
    !state.dividers.some((d) => d.id === state.activeDividerId)
  ) {
    state.activeDividerId = 'all';
  }
}

async function persistReferencePatch(patch, noticeMsg) {
  const saved = await saveReferenceData({
    ...state.referenceData,
    ...patch,
  });
  state.referenceData = saved;
  if (noticeMsg) {
    setNotice('positive', noticeMsg);
  }
  render();
  pushReferenceDataToCloud(saved).catch((err) => {
    console.error('Reference cloud sync failed:', err);
  });
}

async function persistMealPrepPatch(patch, noticeMsg) {
  const saved = await saveMealPrepData({
    ...state.mealPrepData,
    ...patch,
  });
  state.mealPrepData = saved;
  if (noticeMsg) {
    setNotice('positive', noticeMsg);
  }
  render();
  pushMealPrepDataToCloud(saved).catch((err) => {
    console.error('Meal prep cloud sync failed:', err);
  });
}

async function persistPantryPatch(patch, noticeMsg) {
  const saved = await savePantryData({
    ...state.pantryData,
    ...patch,
  });
  state.pantryData = saved;
  if (noticeMsg) {
    setNotice('positive', noticeMsg);
  }
  render();
  pushPantryDataToCloud(saved).catch((err) => {
    console.error('Pantry cloud sync failed:', err);
  });
}

function resetCookSession(releaseLock = true) {
  state.scaleFactor = 1;
  state.activeMethodIndex = 0;
  state.checkedIngredients = new Set();
  state.checkedSteps = new Set();
  if (releaseLock && wakeLock.isActive()) {
    wakeLock.release();
  }
}

function readEditorFormIntoDraft() {
  const form = document.getElementById('recipe-editor-form');
  if (!form) return null;
  const fd = new FormData(form);
  const existingId = form.dataset.recipeId || '';
  const existing = existingId ? state.recipes.find((r) => r.id === existingId) : null;

  const methodBlocks = Array.from(form.querySelectorAll('[data-method-block]'));
  const methods = methodBlocks.map((block, idx) => {
    const id = block.dataset.methodId || `method-${idx + 1}`;
    const name = String(block.querySelector('[data-method-field="name"]')?.value || '').trim();
    const cookRaw = Number(block.querySelector('[data-method-field="cookMinutes"]')?.value || 0);
    const cookMinutes = Number.isFinite(cookRaw) && cookRaw >= 0 ? Math.round(cookRaw) : 0;
    const note = String(block.querySelector('[data-method-field="note"]')?.value || '').trim();
    const steps = String(block.querySelector('[data-method-field="steps"]')?.value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return { id, name, cookMinutes, note, steps };
  });

  return {
    id: existingId,
    title: String(fd.get('title') || ''),
    dividerId: String(fd.get('dividerId') || state.dividers[0]?.id || 'weeknight'),
    source: String(fd.get('source') || ''),
    summary: String(fd.get('summary') || ''),
    prepMinutes: Number(fd.get('prepMinutes') || 0),
    cookMinutes: methods[0]?.cookMinutes ?? 0,
    servings: Number(fd.get('servings') || 4),
    servingSize: String(fd.get('servingSize') || '').trim(),
    tags: parseTagsInput(fd.get('tags')),
    ingredients: String(fd.get('ingredients') || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    steps: methods[0]?.steps || [],
    methods: methods.length > 0 ? methods : [{ id: 'method-1', name: '', cookMinutes: 0, note: '', steps: [] }],
    notes: String(fd.get('notes') || ''),
    favorite: fd.get('favorite') === 'on',
    createdAt: existing?.createdAt || state.draftRecipe?.createdAt || '',
  };
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
    clearNoticeBannerDom();
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

  if (action === 'select-method-filter') {
    const nextMethod = target.dataset.method || '';
    state.activeMethod =
      state.activeMethod.toLowerCase() === nextMethod.toLowerCase() ? '' : nextMethod;
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
    state.activeMethod = '';
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
    state.activeMethod = '';
    state.activeTag = '';
    state.searchQuery = '';
    render();
    return;
  }

  if (action === 'open-recipe') {
    resetCookSession(true);
    state.draftRecipe = null;
    state.selectedRecipeId = target.dataset.recipeId || null;
    if (state.activeMethod && state.selectedRecipeId) {
      const opened = state.recipes.find((r) => r.id === state.selectedRecipeId);
      if (opened) {
        const targetMethod = state.activeMethod.toLowerCase();
        const idx = getRecipeMethods(opened).findIndex(
          (m) => String(m.name || '').trim().toLowerCase() === targetMethod
        );
        if (idx >= 0) {
          state.activeMethodIndex = idx;
        }
      }
    }
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

  if (action === 'select-method') {
    const nextIdx = Number(target.dataset.methodIndex || 0);
    if (Number.isFinite(nextIdx) && nextIdx >= 0) {
      state.activeMethodIndex = nextIdx;
      render();
    }
    return;
  }

  if (action === 'set-print-methods-mode') {
    const nextMode = target.dataset.printMode === 'all' ? 'all' : 'selected';
    state.printMethodsMode = nextMode;
    savePref(PREF_KEYS.printMethodsMode, nextMode);
    render();
    return;
  }

  if (action === 'set-unit-mode') {
    const allowed = ['original', 'metric', 'us-weight'];
    const nextMode = allowed.includes(target.dataset.unitMode) ? target.dataset.unitMode : 'original';
    state.unitMode = nextMode;
    savePref(PREF_KEYS.unitMode, nextMode);
    render();
    return;
  }

  if (action === 'open-technique-modal') {
    state.activeTechniqueId = target.dataset.techniqueId || null;
    render();
    return;
  }

  if (action === 'close-technique-modal') {
    state.activeTechniqueId = null;
    render();
    return;
  }

  if (action === 'open-reference-techniques') {
    state.activeTechniqueId = null;
    if (state.view === 'detail') {
      resetCookSession(true);
    }
    state.view = 'reference';
    state.referenceTab = 'techniques';
    render();
    return;
  }

  if (action === 'select-ref-tab') {
    state.referenceTab = target.dataset.refTab || 'converter';
    render();
    return;
  }

  if (action === 'set-converter-mode') {
    const nextMode = target.dataset.mode || 'volume-weight';
    const defaults = CONVERTER_MODE_DEFAULTS[nextMode] || CONVERTER_MODE_DEFAULTS['volume-weight'];
    state.converter = {
      ...state.converter,
      mode: nextMode,
      fromUnit: defaults.fromUnit,
      toUnit: defaults.toUnit,
    };
    render();
    return;
  }

  if (action === 'swap-converter-units') {
    state.converter = {
      ...state.converter,
      fromUnit: state.converter.toUnit,
      toUnit: state.converter.fromUnit,
    };
    render();
    return;
  }

  if (action === 'select-technique-category') {
    state.refTechniqueCategory = target.dataset.category || 'all';
    render();
    return;
  }

  if (action === 'select-flavor-family') {
    const familyId = target.dataset.familyId || '';
    const firstMatch = (state.referenceData.flavors || []).find((p) => p.familyId === familyId);
    if (firstMatch) {
      state.selectedFlavorId = firstMatch.id;
      render();
    }
    return;
  }

  if (action === 'select-flavor') {
    const flavorId = target.dataset.flavorId || '';
    if (flavorId) {
      state.selectedFlavorId = flavorId;
      render();
    }
    return;
  }

  if (action === 'select-sub-category') {
    state.refSubCategory = target.dataset.category || 'all';
    render();
    return;
  }

  if (action === 'cancel-ref-edit') {
    state.editingSubId = null;
    state.editingTechniqueId = null;
    state.editingFlavorId = null;
    render();
    return;
  }

  if (action === 'new-substitution') {
    state.editingSubId = '__new__';
    render();
    return;
  }

  if (action === 'edit-substitution') {
    state.editingSubId = target.dataset.subId || null;
    render();
    return;
  }

  if (action === 'delete-substitution') {
    const id = target.dataset.subId || '';
    const item = (state.referenceData.substitutions || []).find((s) => s.id === id);
    if (!item) return;
    if (!window.confirm(`Delete substitution for "${item.missing}"?`)) return;
    const nextSubs = deleteReferenceItem(state.referenceData.substitutions, id);
    if (state.editingSubId === id) state.editingSubId = null;
    await persistReferencePatch({ substitutions: nextSubs }, `Deleted substitution for "${item.missing}".`);
    return;
  }

  if (action === 'new-technique') {
    state.editingTechniqueId = '__new__';
    render();
    return;
  }

  if (action === 'edit-technique') {
    state.editingTechniqueId = target.dataset.techniqueId || null;
    render();
    return;
  }

  if (action === 'delete-technique') {
    const id = target.dataset.techniqueId || '';
    const tech = (state.referenceData.techniques || []).find((t) => t.id === id);
    if (!tech) return;
    if (!window.confirm(`Delete technique card "${tech.title}"?`)) return;
    const nextTechs = deleteReferenceItem(state.referenceData.techniques, id);
    if (state.editingTechniqueId === id) state.editingTechniqueId = null;
    await persistReferencePatch({ techniques: nextTechs }, `Deleted technique "${tech.title}".`);
    return;
  }

  if (action === 'new-flavor') {
    state.editingFlavorId = '__new__';
    render();
    return;
  }

  if (action === 'edit-flavor') {
    state.editingFlavorId = target.dataset.flavorId || null;
    render();
    return;
  }

  if (action === 'delete-flavor') {
    const id = target.dataset.flavorId || '';
    const flavor = (state.referenceData.flavors || []).find((f) => f.id === id);
    if (!flavor) return;
    if (!window.confirm(`Delete "${flavor.name}" from the Flavor Pairing Wheel?`)) return;
    const nextFlavors = deleteFlavorItem(state.referenceData.flavors, id);
    if (state.editingFlavorId === id) state.editingFlavorId = null;
    if (state.selectedFlavorId === id) {
      state.selectedFlavorId = nextFlavors[0]?.id || '';
    }
    await persistReferencePatch({ flavors: nextFlavors }, `Deleted "${flavor.name}" from Flavor Wheel.`);
    return;
  }

  if (action === 'reset-ref-section') {
    const section = target.dataset.section || '';
    const defaults = getDefaultReferenceData();
    if (section === 'substitutions') {
      if (!window.confirm('Restore all default ingredient & spice substitutions?')) return;
      state.editingSubId = null;
      await persistReferencePatch({ substitutions: defaults.substitutions }, 'Restored default substitutions.');
      return;
    }
    if (section === 'techniques') {
      if (!window.confirm('Restore all default cooking technique cards?')) return;
      state.editingTechniqueId = null;
      await persistReferencePatch({ techniques: defaults.techniques }, 'Restored default technique cards.');
      return;
    }
    if (section === 'flavors') {
      if (!window.confirm('Restore all default Flavor Wheel herbs and spices?')) return;
      state.editingFlavorId = null;
      state.selectedFlavorId = defaults.flavors[0]?.id || 'rosemary';
      await persistReferencePatch({ flavors: defaults.flavors }, 'Restored default Flavor Wheel entries.');
      return;
    }
    return;
  }

  if (action === 'set-mealprep-tab') {
    state.mealPrepTab = target.dataset.tab || 'freezer';
    render();
    return;
  }

  if (action === 'set-freezer-filter') {
    state.freezerFilter = target.dataset.filter || 'all';
    render();
    return;
  }

  if (action === 'adjust-freezer-portions') {
    const id = target.dataset.itemId;
    const delta = Number(target.dataset.delta || 0);
    const items = state.mealPrepData.freezerItems || [];
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const updated = adjustFreezerPortions(items[idx], delta);
    const nextItems = [...items];
    nextItems[idx] = updated;
    await persistMealPrepPatch(
      { freezerItems: nextItems },
      updated.portions === 0 ? `Marked "${updated.title}" empty (0 portions left).` : ''
    );
    return;
  }

  if (action === 'edit-freezer-item') {
    state.editingFreezerId = target.dataset.itemId || null;
    state.prefillFreezer = null;
    state.mealPrepTab = 'freezer';
    render();
    return;
  }

  if (action === 'cancel-freezer-edit') {
    state.editingFreezerId = null;
    state.prefillFreezer = null;
    render();
    return;
  }

  if (action === 'delete-freezer-item') {
    const id = target.dataset.itemId;
    const item = (state.mealPrepData.freezerItems || []).find((i) => i.id === id);
    if (!item || !window.confirm(`Remove "${item.title}" from freezer/leftover inventory?`)) return;
    const nextItems = deleteMealPrepItem(state.mealPrepData.freezerItems || [], id);
    if (state.editingFreezerId === id) {
      state.editingFreezerId = null;
    }
    await persistMealPrepPatch({ freezerItems: nextItems }, `Removed "${item.title}".`);
    return;
  }

  if (action === 'send-recipe-to-freezer') {
    const id = target.dataset.recipeId || state.selectedRecipeId;
    const recipe = state.recipes.find((r) => r.id === id && !r.deleted);
    if (!recipe) return;
    const scaleRaw = Number(target.dataset.scale || state.scaleFactor || 1);
    const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1;
    const portions = Math.max(0.5, Math.round((Number(recipe.servings) || 4) * scale * 100) / 100);
    if (state.view === 'detail') {
      resetCookSession(true);
    }
    const today = new Date().toISOString().slice(0, 10);
    const bestBy = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const newItem = normalizeFreezerItem({
      id: generateId('frz'),
      recipeId: recipe.id,
      title: recipe.title,
      storageLocation: 'freezer',
      portions,
      servingSize: recipe.servingSize || '1 serving',
      storedDate: today,
      bestByDate: bestBy,
      reheatNotes: '',
    });
    const nextItems = upsertMealPrepItem(
      state.mealPrepData.freezerItems || [],
      newItem,
      normalizeFreezerItem
    );
    state.freezerFilter = 'all';
    state.freezerQuery = '';
    state.prefillFreezer = null;
    state.editingFreezerId = newItem.id;
    state.view = 'mealprep';
    state.mealPrepTab = 'freezer';
    await persistMealPrepPatch(
      { freezerItems: nextItems },
      `Sent "${recipe.title}" (${portions} portion${portions === 1 ? '' : 's'}) to Freezer Inventory — edit portions or reheating notes on the right if needed.`
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (action === 'clear-timeline-selection') {
    state.timelineSelections = {};
    state.checkedTimelineSteps = new Set();
    render();
    return;
  }

  if (action === 'print-mealprep-plan') {
    window.print();
    return;
  }

  if (action === 'toggle-timeline-step') {
    const stepId = target.dataset.stepId;
    if (!stepId) return;
    if (state.checkedTimelineSteps.has(stepId)) {
      state.checkedTimelineSteps.delete(stepId);
    } else {
      state.checkedTimelineSteps.add(stepId);
    }
    render();
    return;
  }

  if (action === 'load-template-timeline') {
    const tplId = target.dataset.templateId;
    const tpl = (state.mealPrepData.templates || []).find((t) => t.id === tplId && !t.deleted);
    if (!tpl) return;
    const nextSel = {};
    const activeIds = new Set(state.recipes.filter((r) => !r.deleted).map((r) => r.id));
    if (tpl.baseRecipeId && activeIds.has(tpl.baseRecipeId)) {
      nextSel[tpl.baseRecipeId] = { selected: true, scale: 2, methodId: '' };
    }
    for (const deriv of tpl.derivatives || []) {
      if (deriv.recipeId && activeIds.has(deriv.recipeId)) {
        nextSel[deriv.recipeId] = { selected: true, scale: 1, methodId: '' };
      }
    }
    state.timelineSelections = nextSel;
    state.checkedTimelineSteps = new Set();
    state.mealPrepTab = 'timeline';
    setNotice(
      'positive',
      Object.keys(nextSel).length > 0
        ? `Loaded "${tpl.title}" linked recipes into Merged Prep Timeline.`
        : `"${tpl.title}" has no binder recipe links yet — pick recipes on the left.`
    );
    render();
    return;
  }

  if (action === 'edit-batch-template') {
    state.editingTemplateId = target.dataset.templateId || null;
    state.mealPrepTab = 'templates';
    render();
    return;
  }

  if (action === 'cancel-template-edit') {
    state.editingTemplateId = null;
    render();
    return;
  }

  if (action === 'delete-batch-template') {
    const id = target.dataset.templateId;
    const tpl = (state.mealPrepData.templates || []).find((t) => t.id === id);
    if (!tpl || !window.confirm(`Delete batch plan "${tpl.title}"?`)) return;
    const nextTemplates = deleteMealPrepItem(state.mealPrepData.templates || [], id);
    if (state.editingTemplateId === id) {
      state.editingTemplateId = null;
    }
    await persistMealPrepPatch({ templates: nextTemplates }, `Deleted "${tpl.title}".`);
    return;
  }

  if (action === 'set-pantry-tab') {
    state.pantryTab = target.dataset.tab === 'matcher' ? 'matcher' : 'inventory';
    render();
    return;
  }

  if (action === 'open-pantry-matcher') {
    state.view = 'pantry';
    state.pantryTab = 'matcher';
    if (state.matcherSelectedNames.size === 0) {
      const next = new Set();
      for (const item of state.pantryData.items || []) {
        if (!item.deleted && item.status !== 'out') {
          next.add(item.name);
        }
      }
      state.matcherSelectedNames = next;
    }
    render();
    return;
  }

  if (action === 'set-pantry-status-filter') {
    state.pantryStatusFilter = target.dataset.filter || 'all';
    render();
    return;
  }

  if (action === 'cycle-pantry-status') {
    const id = target.dataset.itemId;
    const items = state.pantryData.items || [];
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const updated = cyclePantryStatus(items[idx]);
    const nextItems = [...items];
    nextItems[idx] = updated;
    await persistPantryPatch({ items: nextItems });
    return;
  }

  if (action === 'toggle-pantry-staple') {
    const id = target.dataset.itemId;
    const items = state.pantryData.items || [];
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const updated = toggleAlwaysStocked(items[idx]);
    const nextItems = [...items];
    nextItems[idx] = updated;
    await persistPantryPatch(
      { items: nextItems },
      updated.alwaysStocked
        ? `Marked "${updated.name}" as an Always-Stocked staple.`
        : `Removed Always-Stocked staple flag from "${updated.name}".`
    );
    return;
  }

  if (action === 'edit-pantry-item') {
    state.editingPantryId = target.dataset.itemId || null;
    state.pantryTab = 'inventory';
    render();
    return;
  }

  if (action === 'cancel-pantry-edit') {
    state.editingPantryId = null;
    render();
    return;
  }

  if (action === 'delete-pantry-item') {
    const id = target.dataset.itemId;
    const item = (state.pantryData.items || []).find((i) => i.id === id);
    if (!item || !window.confirm(`Remove "${item.name}" from pantry inventory?`)) return;
    const nextItems = deletePantryItem(state.pantryData.items || [], id);
    if (state.editingPantryId === id) {
      state.editingPantryId = null;
    }
    await persistPantryPatch({ items: nextItems }, `Removed "${item.name}" from pantry.`);
    return;
  }

  if (action === 'quick-add-pantry-ingredient') {
    const name = String(target.dataset.ingredientName || '').trim();
    if (!name) return;
    const key = normalizeIngredientKey(name);
    const existing = (state.pantryData.items || []).find(
      (i) => !i.deleted && normalizeIngredientKey(i.name) === key
    );
    if (existing) {
      setNotice('warning', `"${existing.name}" is already in your pantry.`);
      render();
      return;
    }
    const newItem = normalizePantryItem({
      id: generateId('pan'),
      name,
      category: 'other',
      location: 'pantry',
      status: 'in-stock',
    });
    const nextItems = upsertPantryItem(state.pantryData.items || [], newItem);
    await persistPantryPatch({ items: nextItems }, `Added "${name}" to pantry.`);
    return;
  }

  if (action === 'toggle-matcher-ingredient') {
    const name = String(target.dataset.ingredientName || '').trim();
    const key = normalizeIngredientKey(name);
    if (!key) return;
    const next = new Set(state.matcherSelectedNames);
    let removed = false;
    for (const existingName of Array.from(next)) {
      if (normalizeIngredientKey(existingName) === key) {
        next.delete(existingName);
        removed = true;
      }
    }
    if (!removed) {
      next.add(name);
    }
    state.matcherSelectedNames = next;
    render();
    return;
  }

  if (action === 'matcher-use-pantry') {
    const next = new Set();
    for (const item of state.pantryData.items || []) {
      if (!item.deleted && item.status !== 'out') {
        next.add(item.name);
      }
    }
    state.matcherSelectedNames = next;
    render();
    return;
  }

  if (action === 'matcher-clear') {
    state.matcherSelectedNames = new Set();
    render();
    return;
  }

  if (action === 'set-matcher-filter') {
    state.matcherFilter = target.dataset.filter || 'all';
    render();
    return;
  }

  if (action === 'add-missing-to-pantry') {
    const recipeId = target.dataset.recipeId;
    const recipe = state.recipes.find((r) => r.id === recipeId && !r.deleted);
    if (!recipe) return;

    const availKeys = new Set();
    for (const name of state.matcherSelectedNames || []) {
      const k = normalizeIngredientKey(name);
      if (k) availKeys.add(k);
    }
    if (state.matcherIncludeStaples) {
      for (const item of state.pantryData.items || []) {
        if (!item.deleted && item.alwaysStocked && item.status !== 'out') {
          const k = normalizeIngredientKey(item.name);
          if (k) availKeys.add(k);
        }
      }
    }

    let nextItems = [...(state.pantryData.items || [])];
    const trackedMap = new Map(
      nextItems
        .filter((i) => !i.deleted)
        .map((i) => [normalizeIngredientKey(i.name), i])
    );

    let addedCount = 0;
    for (const line of recipe.ingredients || []) {
      const k = normalizeIngredientKey(line);
      if (!k) continue;
      const isAvail =
        availKeys.has(k) ||
        Array.from(availKeys).some((a) => k.includes(a) || a.includes(k));
      if (isAvail) continue;
      const coreName = extractCoreIngredientName(line) || String(line).trim();
      const existing = trackedMap.get(k);
      if (existing) {
        if (existing.status !== 'out') {
          nextItems = upsertPantryItem(nextItems, { ...existing, status: 'out' });
          addedCount += 1;
        }
      } else {
        const created = normalizePantryItem({
          id: generateId('pan'),
          name: coreName,
          category: 'other',
          location: 'pantry',
          status: 'out',
        });
        nextItems = upsertPantryItem(nextItems, created);
        trackedMap.set(k, created);
        addedCount += 1;
      }
    }

    if (addedCount === 0) {
      setNotice('warning', 'Missing ingredients are already flagged under Out / Restock.');
      render();
      return;
    }

    await persistPantryPatch(
      { items: nextItems },
      `Added ${addedCount} missing ingredient(s) from "${recipe.title}" to Pantry -> Out / Restock.`
    );
    return;
  }

  if (action === 'add-editor-method') {
    const draft = readEditorFormIntoDraft();
    if (!draft) return;
    draft.methods.push({
      id: generateId('m'),
      name: '',
      cookMinutes: 0,
      note: '',
      steps: [],
    });
    state.draftRecipe = draft;
    render();
    return;
  }

  if (action === 'remove-editor-method') {
    const idx = Number(target.dataset.methodIndex);
    const draft = readEditorFormIntoDraft();
    if (!draft || draft.methods.length <= 1 || !Number.isFinite(idx)) return;
    draft.methods.splice(idx, 1);
    state.draftRecipe = draft;
    render();
    return;
  }

  if (action === 'move-editor-method-up' || action === 'move-editor-method-down') {
    const idx = Number(target.dataset.methodIndex);
    const draft = readEditorFormIntoDraft();
    if (!draft || !Number.isFinite(idx)) return;
    const swapIdx = action === 'move-editor-method-up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= draft.methods.length) return;
    [draft.methods[idx], draft.methods[swapIdx]] = [draft.methods[swapIdx], draft.methods[idx]];
    state.draftRecipe = draft;
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
      referenceData: snapshot.referenceData,
      mealPrepData: snapshot.mealPrepData,
      pantryData: snapshot.pantryData,
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
    action === 'toggle-save-immediately' ||
    action === 'toggle-timeline-recipe' ||
    action === 'set-timeline-scale' ||
    action === 'set-timeline-method' ||
    action === 'toggle-matcher-staples'
  ) {
    return;
  }
  if (
    action === 'close-technique-modal' &&
    actionEl.classList.contains('modal-backdrop') &&
    event.target !== actionEl
  ) {
    return;
  }
  if (action === 'open-technique-modal') {
    event.preventDefault();
    event.stopPropagation();
  }
  Promise.resolve(handleAction(action, actionEl)).catch((err) => {
    console.error('Action failed:', action, err);
    setNotice('danger', err?.message || 'Action failed.');
    render();
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.activeTechniqueId) {
    state.activeTechniqueId = null;
    render();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    const actionEl = event.target.closest?.(
      '[data-action="select-flavor-family"], [data-action="toggle-timeline-step"]'
    );
    if (actionEl) {
      event.preventDefault();
      handleAction(actionEl.dataset.action, actionEl);
    }
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.dataset.action === 'search-input') {
    state.searchQuery = target.value;
    render();
    return;
  }
  if (target.id === 'mealprep-freezer-search') {
    state.freezerQuery = target.value;
    render();
    return;
  }
  if (target.id === 'pantry-search-input') {
    state.pantryQuery = target.value;
    render();
    return;
  }
  if (target.id === 'matcher-ingredient-search') {
    state.matcherSearch = target.value;
    render();
    return;
  }
  if (target.id === 'reference-sub-search') {
    state.refSubQuery = target.value;
    render();
    return;
  }
  if (target.id === 'reference-chart-search') {
    state.refChartQuery = target.value;
    render();
    return;
  }
  if (target.id === 'reference-technique-search') {
    state.refTechniqueQuery = target.value;
    render();
    return;
  }
  if (target.id === 'converter-value-input') {
    state.converter = { ...state.converter, value: target.value };
    const resultPanel = document.getElementById('converter-result-panel');
    if (resultPanel) {
      resultPanel.innerHTML = renderConverterResultHtml(state.converter);
    }
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

  if (target.id === 'converter-from-select') {
    state.converter = { ...state.converter, fromUnit: target.value };
    const resultPanel = document.getElementById('converter-result-panel');
    if (resultPanel) {
      resultPanel.innerHTML = renderConverterResultHtml(state.converter);
    }
    return;
  }

  if (target.id === 'converter-to-select') {
    state.converter = { ...state.converter, toUnit: target.value };
    const resultPanel = document.getElementById('converter-result-panel');
    if (resultPanel) {
      resultPanel.innerHTML = renderConverterResultHtml(state.converter);
    }
    return;
  }

  if (target.id === 'converter-ingredient-select') {
    state.converter = { ...state.converter, ingredientId: target.value };
    const resultPanel = document.getElementById('converter-result-panel');
    if (resultPanel) {
      resultPanel.innerHTML = renderConverterResultHtml(state.converter);
    }
    return;
  }

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
    const stepKey = target.dataset.stepKey || String(target.dataset.index || '');
    if (!stepKey) return;
    if (target.checked) {
      state.checkedSteps.add(stepKey);
    } else {
      state.checkedSteps.delete(stepKey);
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
    return;
  }

  if (target.dataset.action === 'toggle-timeline-recipe') {
    const recipeId = target.dataset.recipeId;
    if (!recipeId) return;
    const prev = state.timelineSelections[recipeId] || { selected: false, scale: 1, methodId: '' };
    state.timelineSelections = {
      ...state.timelineSelections,
      [recipeId]: { ...prev, selected: Boolean(target.checked) },
    };
    render();
    return;
  }

  if (target.dataset.action === 'set-timeline-scale') {
    const recipeId = target.dataset.recipeId;
    const scale = Number(target.value || 1);
    if (!recipeId || !Number.isFinite(scale) || scale <= 0) return;
    const prev = state.timelineSelections[recipeId] || { selected: true, scale: 1, methodId: '' };
    state.timelineSelections = {
      ...state.timelineSelections,
      [recipeId]: { ...prev, scale },
    };
    render();
    return;
  }

  if (target.dataset.action === 'set-timeline-method') {
    const recipeId = target.dataset.recipeId;
    if (!recipeId) return;
    const prev = state.timelineSelections[recipeId] || { selected: true, scale: 1, methodId: '' };
    state.timelineSelections = {
      ...state.timelineSelections,
      [recipeId]: { ...prev, methodId: target.value || '' },
    };
    render();
    return;
  }

  if (target.id === 'freezer-recipe-select') {
    const recipe = state.recipes.find((r) => r.id === target.value && !r.deleted);
    if (!recipe) return;
    const form = target.closest('form');
    if (!form) return;
    const titleInput = form.querySelector('#freezer-title');
    const portionsInput = form.querySelector('#freezer-portions');
    const sizeInput = form.querySelector('#freezer-serving-size');
    if (titleInput) titleInput.value = recipe.title;
    if (portionsInput) portionsInput.value = String(recipe.servings || 4);
    if (sizeInput) sizeInput.value = recipe.servingSize || '1 serving';
    return;
  }

  if (target.id === 'freezer-location') {
    const form = target.closest('form');
    if (!form) return;
    const storedInput = form.querySelector('#freezer-stored-date');
    const bestByInput = form.querySelector('#freezer-bestby-date');
    const baseMs = Date.parse(`${storedInput?.value || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    if (bestByInput && Number.isFinite(baseMs)) {
      const days = target.value === 'fridge' ? 4 : 90;
      bestByInput.value = new Date(baseMs + days * 86400000).toISOString().slice(0, 10);
    }
    return;
  }

  if (target.id === 'pantry-category-select') {
    state.pantryCategory = target.value || 'all';
    render();
    return;
  }

  if (target.dataset.action === 'toggle-matcher-staples') {
    state.matcherIncludeStaples = Boolean(target.checked);
    render();
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  const formId = form.getAttribute?.('id') || '';

  if (formId === 'scrape-url-form') {
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

  if (formId === 'recipe-editor-form') {
    event.preventDefault();
    const draft = readEditorFormIntoDraft();
    if (!draft) return;
    const existingId = form.dataset.recipeId;
    const existing = existingId ? state.recipes.find((r) => r.id === existingId) : null;
    const id = existing?.id || generateId('rec');

    const nonEmptySecondary = draft.methods.filter(
      (m, idx) => idx === 0 || m.name || m.note || (m.steps && m.steps.length > 0)
    );
    const methods = nonEmptySecondary.length > 0 ? nonEmptySecondary : draft.methods.slice(0, 1);

    const saved = await saveRecipe({
      ...draft,
      id,
      cookMinutes: methods[0]?.cookMinutes ?? 0,
      steps: methods[0]?.steps || [],
      methods,
      createdAt: existing?.createdAt || draft.createdAt || new Date().toISOString(),
    });

    applySnapshotToState(await getSnapshot());
    await pushRecipeToCloud(saved, state.dividers[0]?.id);
    state.editingRecipeId = null;
    state.draftRecipe = null;
    state.activeMethodIndex = 0;
    state.selectedRecipeId = saved.id;
    state.view = 'detail';
    setNotice('positive', `Saved "${saved.title}".`);
    render();
    return;
  }

  if (formId === 'add-divider-form') {
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

  if (formId === 'ref-substitution-form') {
    event.preventDefault();
    const fd = new FormData(form);
    const existingId = form.dataset.subId || '';
    const list = state.referenceData.substitutions || [];
    const candidate = normalizeSubstitution({
      id: existingId || undefined,
      missing: fd.get('missing'),
      category: fd.get('category'),
      amount: fd.get('amount'),
      substitute: fd.get('substitute'),
      notes: fd.get('notes'),
    });
    if (!existingId && list.some((s) => s.id === candidate.id)) {
      candidate.id = generateId('sub');
    }
    const nextSubs = upsertReferenceItem(list, candidate);
    state.editingSubId = null;
    await persistReferencePatch({ substitutions: nextSubs }, `Saved substitution for "${candidate.missing}".`);
    return;
  }

  if (formId === 'ref-technique-form') {
    event.preventDefault();
    const fd = new FormData(form);
    const existingId = form.dataset.techId || '';
    const list = state.referenceData.techniques || [];
    const candidate = normalizeTechnique({
      id: existingId || undefined,
      title: fd.get('title'),
      category: fd.get('category'),
      time: fd.get('time'),
      summary: fd.get('summary'),
      keywords: fd.get('keywords'),
      steps: fd.get('steps'),
      visualCue: fd.get('visualCue'),
      commonMistake: fd.get('commonMistake'),
    });
    if (!existingId && list.some((t) => t.id === candidate.id)) {
      candidate.id = generateId('tech');
    }
    const nextTechs = upsertReferenceItem(list, candidate);
    state.editingTechniqueId = null;
    await persistReferencePatch({ techniques: nextTechs }, `Saved technique "${candidate.title}".`);
    return;
  }

  if (formId === 'ref-flavor-form') {
    event.preventDefault();
    const fd = new FormData(form);
    const existingId = form.dataset.flavorId || '';
    const list = state.referenceData.flavors || [];
    const candidate = normalizeFlavor({
      id: existingId || undefined,
      name: fd.get('name'),
      familyId: fd.get('familyId'),
      profile: fd.get('profile'),
      cuisineVibe: fd.get('cuisineVibe'),
      bestWith: fd.get('bestWith'),
      pairsWellWith: fd.getAll('pairsWellWith'),
      substitutes: fd.get('substitutes'),
    });
    if (!existingId && list.some((f) => f.id === candidate.id)) {
      candidate.id = generateId('flv');
    }
    const nextFlavors = upsertReferenceItem(list, candidate);
    state.editingFlavorId = null;
    state.selectedFlavorId = candidate.id;
    await persistReferencePatch({ flavors: nextFlavors }, `Saved "${candidate.name}" to Flavor Wheel.`);
    return;
  }

  if (formId === 'mealprep-freezer-form') {
    event.preventDefault();
    try {
      const fd = new FormData(form);
      const existingId = String(form.dataset.freezerId || '').trim();
      const title = String(fd.get('title') || '').trim();
      if (!title) {
        setNotice('warning', 'Please enter a dish name before saving to inventory.');
        render();
        return;
      }
      const candidate = normalizeFreezerItem({
        id: existingId || generateId('frz'),
        recipeId: fd.get('recipeId'),
        title,
        storageLocation: fd.get('storageLocation'),
        portions: fd.get('portions'),
        servingSize: fd.get('servingSize'),
        storedDate: fd.get('storedDate'),
        bestByDate: fd.get('bestByDate'),
        reheatNotes: fd.get('reheatNotes'),
      });
      const nextItems = upsertMealPrepItem(
        state.mealPrepData.freezerItems || [],
        candidate,
        normalizeFreezerItem
      );
      if (!existingId) {
        state.freezerFilter = 'all';
        state.freezerQuery = '';
      }
      state.editingFreezerId = null;
      state.prefillFreezer = null;
      await persistMealPrepPatch(
        { freezerItems: nextItems },
        `Saved "${candidate.title}" (${candidate.portions} portions) to inventory.`
      );
    } catch (err) {
      console.error('Freezer form save failed:', err);
      setNotice('danger', err?.message || 'Could not save freezer entry.');
      render();
    }
    return;
  }

  if (formId === 'mealprep-template-form') {
    event.preventDefault();
    try {
      const fd = new FormData(form);
      const existingId = String(form.dataset.templateId || '').trim();
      const derivatives = String(fd.get('derivativesText') || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, idx) => {
          const [dayRaw, titleRaw, notesRaw, recipeIdRaw] = line.split('|').map((s) => s.trim());
          const numericDay = Number(dayRaw);
          const hasExplicitDay = Number.isFinite(numericDay);
          return normalizeDerivative({
            id: `deriv-${idx + 1}-${Date.now().toString(36)}`,
            dayOffset: hasExplicitDay ? numericDay : idx,
            title: hasExplicitDay ? titleRaw || dayRaw : dayRaw,
            notes: hasExplicitDay ? notesRaw : titleRaw,
            recipeId: hasExplicitDay ? recipeIdRaw : notesRaw,
          });
        });

      const candidate = normalizeBatchTemplate({
        id: existingId || generateId('batch'),
        title: fd.get('title'),
        baseRecipeId: fd.get('baseRecipeId'),
        baseLabel: fd.get('baseLabel'),
        batchYield: fd.get('batchYield'),
        prepTips: fd.get('prepTips'),
        derivatives,
      });
      const nextTemplates = upsertMealPrepItem(
        state.mealPrepData.templates || [],
        candidate,
        normalizeBatchTemplate
      );
      state.editingTemplateId = null;
      await persistMealPrepPatch(
        { templates: nextTemplates },
        `Saved batch prep plan "${candidate.title}".`
      );
    } catch (err) {
      console.error('Template form save failed:', err);
      setNotice('danger', err?.message || 'Could not save batch prep plan.');
      render();
    }
    return;
  }

  if (formId === 'pantry-item-form') {
    event.preventDefault();
    try {
      const fd = new FormData(form);
      const existingId = String(form.dataset.pantryId || '').trim();
      const name = String(fd.get('name') || '').trim();
      if (!name) {
        setNotice('warning', 'Please enter an ingredient name.');
        render();
        return;
      }
      const candidate = normalizePantryItem({
        id: existingId || generateId('pan'),
        name,
        category: fd.get('category'),
        location: fd.get('location'),
        quantity: fd.get('quantity'),
        status: fd.get('status'),
        alwaysStocked: fd.get('alwaysStocked') === 'on',
        notes: fd.get('notes'),
      });
      const nextItems = upsertPantryItem(state.pantryData.items || [], candidate);
      if (!existingId) {
        state.pantryStatusFilter = 'all';
        state.pantryCategory = 'all';
        state.pantryQuery = '';
      }
      state.editingPantryId = null;
      await persistPantryPatch(
        { items: nextItems },
        `Saved "${candidate.name}" to pantry.`
      );
    } catch (err) {
      console.error('Pantry form save failed:', err);
      setNotice('danger', err?.message || 'Could not save pantry item.');
      render();
    }
    return;
  }

  if (formId === 'matcher-custom-form') {
    event.preventDefault();
    const fd = new FormData(form);
    const raw = String(fd.get('customIngredient') || '').trim();
    if (!raw) return;
    const key = normalizeIngredientKey(raw);
    const next = new Set(state.matcherSelectedNames);
    const exists = Array.from(next).some((n) => normalizeIngredientKey(n) === key);
    if (!exists && key) {
      next.add(raw);
    }
    state.matcherSelectedNames = next;
    render();
    return;
  }

  if (formId === 'email-auth-form') {
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
      if (state.view === 'sync') {
        render();
      } else {
        updateSyncPillDom();
      }
    },
  });
}

bootstrap().catch((err) => {
  state.ready = true;
  setNotice('danger', `Failed to open Recipe Binder database: ${err.message}`);
  render();
});
