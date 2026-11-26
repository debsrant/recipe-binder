const env = import.meta.env || {};

export const SITE_STAGE = (env.VITE_SITE_STAGE || 'TEST').toUpperCase();
export const IS_TEST_STAGE = SITE_STAGE !== 'LIVE';
export const APP_TITLE = 'Recipe Binder';
export const DB_NAME = IS_TEST_STAGE ? 'RecipeBinderDB_Test' : 'RecipeBinderDB';
export const FIRESTORE_STAGE_DOC = IS_TEST_STAGE ? 'state_test' : 'state_live';

export const PREF_KEYS = {
  theme: 'recipe-binder:theme',
  fontScale: 'recipe-binder:fontScale',
  detailLayout: 'recipe-binder:detailLayout',
  printMethodsMode: 'recipe-binder:printMethodsMode',
  unitMode: 'recipe-binder:unitMode',
};

export const RECIPE_PROXY_URL = (env.VITE_RECIPE_PROXY_URL || '').trim();

export const FIREBASE_CONFIG = {
  apiKey: (env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (env.VITE_FIREBASE_APP_ID || '').trim(),
};

export const IS_FIREBASE_CONFIGURED = Boolean(
  FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.authDomain &&
    FIREBASE_CONFIG.projectId &&
    FIREBASE_CONFIG.appId
);
