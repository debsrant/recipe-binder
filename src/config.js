export const SITE_STAGE = (import.meta.env.VITE_SITE_STAGE || 'TEST').toUpperCase();
export const IS_TEST_STAGE = SITE_STAGE !== 'LIVE';
export const APP_TITLE = 'Recipe Binder';
export const DB_NAME = IS_TEST_STAGE ? 'RecipeBinderDB_Test' : 'RecipeBinderDB';
export const FIRESTORE_STAGE_DOC = IS_TEST_STAGE ? 'state_test' : 'state_live';

export const PREF_KEYS = {
  theme: 'recipe-binder:theme',
  fontScale: 'recipe-binder:fontScale',
};

export const FIREBASE_CONFIG = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
};

export const IS_FIREBASE_CONFIGURED = Boolean(
  FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.authDomain &&
    FIREBASE_CONFIG.projectId &&
    FIREBASE_CONFIG.appId
);
