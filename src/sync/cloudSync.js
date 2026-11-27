import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
} from 'firebase/firestore';
import { FIREBASE_CONFIG, FIRESTORE_STAGE_DOC, IS_FIREBASE_CONFIGURED } from '../config.js';
import { mergeCollectionSnapshots, normalizeDivider, normalizeRecipe } from '../lib/collection.js';
import { normalizeReferenceData } from '../lib/reference.js';
import { normalizeMealPrepData } from '../lib/mealPrep.js';
import { normalizePantryData } from '../lib/pantry.js';
import { normalizeNotesData } from '../lib/notes.js';

const CLIENT_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab_${Math.random().toString(36).slice(2)}_${Date.now()}`;

let auth = null;
let db = null;
let unsubMeta = null;
let unsubRecipes = null;

let syncState = {
  configured: IS_FIREBASE_CONFIGURED,
  status: IS_FIREBASE_CONFIGURED ? 'connecting' : 'unconfigured',
  user: null,
  lastSyncedAt: '',
  error: '',
};

let callbacks = {
  getLocalSnapshot: async () => ({ dividers: [], dividersUpdatedMs: 0, recipes: [] }),
  onMergedSnapshot: async () => {},
  onStatusChange: () => {},
};

function emitStatus(patch = {}) {
  syncState = { ...syncState, ...patch };
  callbacks.onStatusChange(getSyncSnapshot());
}

function formatAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/unauthorized-domain') {
    return 'Google Sign-In is not authorized for this LAN IP/domain. Use Email & Password over LAN Wi-Fi, or add this host in Firebase Auth -> Settings -> Authorized domains.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup was closed before completing.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid email or password.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists — use Sign In instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'This sign-in provider is not enabled yet in Firebase Console -> Authentication -> Sign-in method.';
  }
  if (code === 'permission-denied') {
    return 'Firestore permission denied. Publish firestore.rules in Firebase Console -> Firestore Database -> Rules.';
  }
  return err?.message || 'Cloud sync error.';
}

function stopListeners() {
  if (unsubMeta) {
    unsubMeta();
    unsubMeta = null;
  }
  if (unsubRecipes) {
    unsubRecipes();
    unsubRecipes = null;
  }
}

function getStageDocRef(uid) {
  return doc(db, 'users', uid, 'recipeBinder', FIRESTORE_STAGE_DOC);
}

function getRecipesCollectionRef(uid) {
  return collection(db, 'users', uid, 'recipeBinder', FIRESTORE_STAGE_DOC, 'recipes');
}

function getRecipeDocRef(uid, recipeId) {
  return doc(db, 'users', uid, 'recipeBinder', FIRESTORE_STAGE_DOC, 'recipes', recipeId);
}

function nowTimeLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function writeDividersDoc(uid, dividers, dividersUpdatedMs) {
  const payload = {
    dividers: (dividers || []).map((d, idx) => ({ ...normalizeDivider(d, idx), order: idx })),
    dividersUpdatedMs: Number(dividersUpdatedMs || Date.now()),
    updatedBy: CLIENT_ID,
  };
  await setDoc(getStageDocRef(uid), payload, { merge: true });
}

async function writeReferenceDoc(uid, referenceData) {
  const payload = {
    referenceData: normalizeReferenceData(referenceData),
    updatedBy: CLIENT_ID,
  };
  await setDoc(getStageDocRef(uid), payload, { merge: true });
}

async function writeMealPrepDoc(uid, mealPrepData) {
  const payload = {
    mealPrepData: normalizeMealPrepData(mealPrepData),
    updatedBy: CLIENT_ID,
  };
  await setDoc(getStageDocRef(uid), payload, { merge: true });
}

async function writePantryDoc(uid, pantryData) {
  const payload = {
    pantryData: normalizePantryData(pantryData),
    updatedBy: CLIENT_ID,
  };
  await setDoc(getStageDocRef(uid), payload, { merge: true });
}

async function writeNotesDoc(uid, notesData) {
  const payload = {
    notesData: normalizeNotesData(notesData),
    updatedBy: CLIENT_ID,
  };
  await setDoc(getStageDocRef(uid), payload, { merge: true });
}

async function writeRecipeDoc(uid, recipe, fallbackDividerId) {
  const payload = {
    ...normalizeRecipe(recipe, fallbackDividerId),
    updatedBy: CLIENT_ID,
  };
  await setDoc(getRecipeDocRef(uid, payload.id), payload);
}

async function startUserSync(user) {
  stopListeners();
  emitStatus({
    status: navigator.onLine ? 'syncing' : 'offline',
    user: {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email || 'Signed-in User',
    },
    error: '',
  });

  const stageRef = getStageDocRef(user.uid);
  const recipesColRef = getRecipesCollectionRef(user.uid);

  try {
    const [metaSnap, recipesSnap, localSnapshot] = await Promise.all([
      getDoc(stageRef),
      getDocs(recipesColRef),
      callbacks.getLocalSnapshot(),
    ]);

    const remoteMeta = metaSnap.exists() ? metaSnap.data() : null;
    const remoteRecipes = [];
    recipesSnap.forEach((docSnap) => {
      remoteRecipes.push({ ...docSnap.data(), id: docSnap.id });
    });

    const remoteSnapshot = {
      dividers: remoteMeta?.dividers || [],
      dividersUpdatedMs: Number(remoteMeta?.dividersUpdatedMs || 0),
      referenceData: remoteMeta?.referenceData || null,
      mealPrepData: remoteMeta?.mealPrepData || null,
      pantryData: remoteMeta?.pantryData || null,
      notesData: remoteMeta?.notesData || null,
      recipes: remoteRecipes,
    };

    const merged = mergeCollectionSnapshots(localSnapshot, remoteSnapshot);
    await callbacks.onMergedSnapshot(merged);

    const remoteById = new Map(remoteRecipes.map((r) => [r.id, r]));
    const fallbackId = merged.dividers[0]?.id || 'weeknight';
    const pendingWrites = [];

    if (!remoteMeta || merged.dividersUpdatedMs > Number(remoteMeta.dividersUpdatedMs || 0)) {
      pendingWrites.push(writeDividersDoc(user.uid, merged.dividers, merged.dividersUpdatedMs));
    }

    const localRefMs = Number(merged.referenceData?.updatedMs || 0);
    const remoteRefMs = Number(remoteMeta?.referenceData?.updatedMs || 0);
    if (localRefMs > 0 && (!remoteMeta?.referenceData || localRefMs > remoteRefMs)) {
      pendingWrites.push(writeReferenceDoc(user.uid, merged.referenceData));
    }

    const maxUpdated = (arr) =>
      Array.isArray(arr) ? arr.reduce((m, x) => Math.max(m, Number(x?.updatedMs || 0)), 0) : 0;
    const localMpMs = Math.max(
      maxUpdated(merged.mealPrepData?.templates),
      maxUpdated(merged.mealPrepData?.freezerItems)
    );
    const remoteMpMs = Math.max(
      maxUpdated(remoteMeta?.mealPrepData?.templates),
      maxUpdated(remoteMeta?.mealPrepData?.freezerItems)
    );
    if (
      merged.mealPrepData &&
      (!remoteMeta?.mealPrepData || localMpMs > remoteMpMs)
    ) {
      pendingWrites.push(writeMealPrepDoc(user.uid, merged.mealPrepData));
    }

    const localPantryMs = maxUpdated(merged.pantryData?.items);
    const remotePantryMs = maxUpdated(remoteMeta?.pantryData?.items);
    if (
      merged.pantryData &&
      (!remoteMeta?.pantryData || localPantryMs > remotePantryMs)
    ) {
      pendingWrites.push(writePantryDoc(user.uid, merged.pantryData));
    }

    const localNotesMs = Math.max(
      maxUpdated(merged.notesData?.items),
      Number(merged.notesData?.googleDriveUpdatedMs || 0),
      Number(merged.notesData?.updatedMs || 0)
    );
    const remoteNotesMs = Math.max(
      maxUpdated(remoteMeta?.notesData?.items),
      Number(remoteMeta?.notesData?.googleDriveUpdatedMs || 0),
      Number(remoteMeta?.notesData?.updatedMs || 0)
    );
    if (
      merged.notesData &&
      localNotesMs > 0 &&
      (!remoteMeta?.notesData || localNotesMs > remoteNotesMs)
    ) {
      pendingWrites.push(writeNotesDoc(user.uid, merged.notesData));
    }

    for (const recipe of merged.recipes) {
      const remoteRec = remoteById.get(recipe.id);
      if (!remoteRec || recipe.updatedMs > Number(remoteRec.updatedMs || 0)) {
        pendingWrites.push(writeRecipeDoc(user.uid, recipe, fallbackId));
      }
    }

    if (pendingWrites.length > 0) {
      await Promise.all(pendingWrites);
    }

    emitStatus({
      status: navigator.onLine ? 'synced' : 'offline',
      lastSyncedAt: nowTimeLabel(),
      error: '',
    });
  } catch (err) {
    emitStatus({
      status: navigator.onLine ? 'error' : 'offline',
      error: formatAuthError(err),
    });
  }

  unsubMeta = onSnapshot(
    stageRef,
    async (snap) => {
      if (!snap.exists()) return;
      if (snap.metadata.hasPendingWrites) {
        emitStatus({ status: navigator.onLine ? 'syncing' : 'offline' });
        return;
      }
      const data = snap.data();
      if (data?.updatedBy === CLIENT_ID) {
        emitStatus({
          status: navigator.onLine ? 'synced' : 'offline',
          lastSyncedAt: nowTimeLabel(),
          error: '',
        });
        return;
      }
      const local = await callbacks.getLocalSnapshot();
      const merged = mergeCollectionSnapshots(local, {
        dividers: data?.dividers || [],
        dividersUpdatedMs: Number(data?.dividersUpdatedMs || 0),
        referenceData: data?.referenceData || null,
        mealPrepData: data?.mealPrepData || null,
        pantryData: data?.pantryData || null,
        notesData: data?.notesData || null,
        recipes: [],
      });
      await callbacks.onMergedSnapshot(merged);
      emitStatus({
        status: navigator.onLine ? 'synced' : 'offline',
        lastSyncedAt: nowTimeLabel(),
        error: '',
      });
    },
    (err) => {
      emitStatus({
        status: navigator.onLine ? 'error' : 'offline',
        error: formatAuthError(err),
      });
    }
  );

  unsubRecipes = onSnapshot(
    recipesColRef,
    async (querySnap) => {
      if (querySnap.metadata.hasPendingWrites) {
        emitStatus({ status: navigator.onLine ? 'syncing' : 'offline' });
        return;
      }
      const changedRemote = [];
      querySnap.docChanges().forEach((change) => {
        const data = change.doc.data();
        if (data?.updatedBy !== CLIENT_ID) {
          changedRemote.push({ ...data, id: change.doc.id });
        }
      });

      if (changedRemote.length > 0) {
        const local = await callbacks.getLocalSnapshot();
        const merged = mergeCollectionSnapshots(local, {
          dividers: local.dividers,
          dividersUpdatedMs: local.dividersUpdatedMs,
          recipes: changedRemote,
        });
        await callbacks.onMergedSnapshot(merged);
      }

      emitStatus({
        status: navigator.onLine ? 'synced' : 'offline',
        lastSyncedAt: nowTimeLabel(),
        error: '',
      });
    },
    (err) => {
      emitStatus({
        status: navigator.onLine ? 'error' : 'offline',
        error: formatAuthError(err),
      });
    }
  );
}

export function getSyncSnapshot() {
  return { ...syncState };
}

export function initCloudSync({ getLocalSnapshot, onMergedSnapshot, onStatusChange }) {
  callbacks = { getLocalSnapshot, onMergedSnapshot, onStatusChange };

  if (!IS_FIREBASE_CONFIGURED) {
    emitStatus({ configured: false, status: 'unconfigured', user: null, error: '' });
    return;
  }

  const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);

  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app);
  }

  getRedirectResult(auth).catch((err) => {
    if (err) emitStatus({ status: 'error', error: formatAuthError(err) });
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (auth?.currentUser) {
        emitStatus({ status: 'synced', error: '' });
      }
    });
    window.addEventListener('offline', () => {
      if (auth?.currentUser) {
        emitStatus({ status: 'offline' });
      }
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopListeners();
      emitStatus({
        status: 'signed-out',
        user: null,
        lastSyncedAt: '',
        error: '',
      });
      return;
    }
    startUserSync(user);
  });
}

export async function pushRecipeToCloud(recipe, fallbackDividerId = 'weeknight') {
  if (!IS_FIREBASE_CONFIGURED || !auth?.currentUser || !db || !recipe?.id) return;
  emitStatus({ status: navigator.onLine ? 'syncing' : 'offline' });
  try {
    await writeRecipeDoc(auth.currentUser.uid, recipe, fallbackDividerId);
    emitStatus({
      status: navigator.onLine ? 'synced' : 'offline',
      lastSyncedAt: nowTimeLabel(),
      error: '',
    });
  } catch (err) {
    emitStatus({
      status: navigator.onLine ? 'error' : 'offline',
      error: formatAuthError(err),
    });
  }
}

export async function pushDividersToCloud(dividers, dividersUpdatedMs) {
  if (!IS_FIREBASE_CONFIGURED || !auth?.currentUser || !db) return;
  emitStatus({ status: navigator.onLine ? 'syncing' : 'offline' });
  try {
    await writeDividersDoc(auth.currentUser.uid, dividers, dividersUpdatedMs);
    emitStatus({
      status: navigator.onLine ? 'synced' : 'offline',
      lastSyncedAt: nowTimeLabel(),
      error: '',
    });
  } catch (err) {
    emitStatus({
      status: navigator.onLine ? 'error' : 'offline',
      error: formatAuthError(err),
    });
  }
}

export async function pushReferenceDataToCloud(referenceData) {
  if (!IS_FIREBASE_CONFIGURED || !auth?.currentUser || !db) return;
  emitStatus({ status: navigator.onLine ? 'syncing' : 'offline' });
  try {
    await writeReferenceDoc(auth.currentUser.uid, referenceData);
    emitStatus({
      status: navigator.onLine ? 'synced' : 'offline',
      lastSyncedAt: nowTimeLabel(),
      error: '',
    });
  } catch (err) {
    emitStatus({
      status: navigator.onLine ? 'error' : 'offline',
      error: formatAuthError(err),
    });
  }
}

export async function pushMealPrepDataToCloud(mealPrepData) {
  if (!IS_FIREBASE_CONFIGURED || !auth?.currentUser || !db) return;
  emitStatus({ status: navigator.onLine ? 'syncing' : 'offline' });
  try {
    await writeMealPrepDoc(auth.currentUser.uid, mealPrepData);
    emitStatus({
      status: navigator.onLine ? 'synced' : 'offline',
      lastSyncedAt: nowTimeLabel(),
      error: '',
    });
  } catch (err) {
    emitStatus({
      status: navigator.onLine ? 'error' : 'offline',
      error: formatAuthError(err),
    });
  }
}

export async function pushPantryDataToCloud(pantryData) {
  if (!IS_FIREBASE_CONFIGURED || !auth?.currentUser || !db) return;
  emitStatus({ status: navigator.onLine ? 'syncing' : 'offline' });
  try {
    await writePantryDoc(auth.currentUser.uid, pantryData);
    emitStatus({
      status: navigator.onLine ? 'synced' : 'offline',
      lastSyncedAt: nowTimeLabel(),
      error: '',
    });
  } catch (err) {
    emitStatus({
      status: navigator.onLine ? 'error' : 'offline',
      error: formatAuthError(err),
    });
  }
}

export async function pushNotesDataToCloud(notesData) {
  if (!IS_FIREBASE_CONFIGURED || !auth?.currentUser || !db) return;
  emitStatus({ status: navigator.onLine ? 'syncing' : 'offline' });
  try {
    await writeNotesDoc(auth.currentUser.uid, notesData);
    emitStatus({
      status: navigator.onLine ? 'synced' : 'offline',
      lastSyncedAt: nowTimeLabel(),
      error: '',
    });
  } catch (err) {
    emitStatus({
      status: navigator.onLine ? 'error' : 'offline',
      error: formatAuthError(err),
    });
  }
}

export async function forceSyncAllToCloud(snapshot) {
  if (!IS_FIREBASE_CONFIGURED || !auth?.currentUser || !db) return;
  emitStatus({ status: navigator.onLine ? 'syncing' : 'offline', error: '' });
  try {
    const uid = auth.currentUser.uid;
    const fallbackId = snapshot?.dividers?.[0]?.id || 'weeknight';
    await writeDividersDoc(uid, snapshot?.dividers || [], snapshot?.dividersUpdatedMs || Date.now());
    if (snapshot?.referenceData) {
      await writeReferenceDoc(uid, snapshot.referenceData);
    }
    if (snapshot?.mealPrepData) {
      await writeMealPrepDoc(uid, snapshot.mealPrepData);
    }
    if (snapshot?.pantryData) {
      await writePantryDoc(uid, snapshot.pantryData);
    }
    if (snapshot?.notesData) {
      await writeNotesDoc(uid, snapshot.notesData);
    }
    await Promise.all((snapshot?.recipes || []).map((r) => writeRecipeDoc(uid, r, fallbackId)));
    emitStatus({
      status: navigator.onLine ? 'synced' : 'offline',
      lastSyncedAt: nowTimeLabel(),
      error: '',
    });
  } catch (err) {
    emitStatus({
      status: navigator.onLine ? 'error' : 'offline',
      error: formatAuthError(err),
    });
    throw err;
  }
}

export async function signInWithGoogle() {
  if (!auth) throw new Error('Firebase is not configured.');
  emitStatus({ error: '' });
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err?.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return;
    }
    const msg = formatAuthError(err);
    emitStatus({ error: msg });
    throw new Error(msg);
  }
}

export async function signInWithEmail(email, password) {
  if (!auth) throw new Error('Firebase is not configured.');
  const cleanEmail = String(email || '').trim();
  const cleanPass = String(password || '');
  if (!cleanEmail || !cleanPass) {
    const msg = 'Enter both email and password.';
    emitStatus({ error: msg });
    throw new Error(msg);
  }
  emitStatus({ error: '' });
  try {
    await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
  } catch (err) {
    const msg = formatAuthError(err);
    emitStatus({ error: msg });
    throw new Error(msg);
  }
}

export async function signUpWithEmail(email, password) {
  if (!auth) throw new Error('Firebase is not configured.');
  const cleanEmail = String(email || '').trim();
  const cleanPass = String(password || '');
  if (!cleanEmail || cleanPass.length < 6) {
    const msg = 'Enter a valid email and a password of at least 6 characters.';
    emitStatus({ error: msg });
    throw new Error(msg);
  }
  emitStatus({ error: '' });
  try {
    await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
  } catch (err) {
    const msg = formatAuthError(err);
    emitStatus({ error: msg });
    throw new Error(msg);
  }
}

export async function signOutCloud() {
  stopListeners();
  if (!auth) return;
  await signOut(auth);
  emitStatus({ status: 'signed-out', user: null, lastSyncedAt: '', error: '' });
}
