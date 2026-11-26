import { IS_TEST_STAGE, SITE_STAGE } from '../config.js';
import { escapeHtml } from './helpers.js';

export function renderSyncView({ syncSnapshot, recipes, dividers }) {
  const activeCount = (recipes || []).filter((r) => r && !r.deleted).length;
  const dividerCount = (dividers || []).length;

  let cloudBodyHtml = '';
  if (!syncSnapshot.configured) {
    cloudBodyHtml = `
      <div class="callout-box callout-warning">
        <strong>Offline-Only Mode Active:</strong> No Firebase web configuration is set in <code>.env.local</code> yet.
        All recipes save locally in IndexedDB and work offline across tabs.
      </div>
      <p class="muted">
        To enable real-time cross-device sync (Desktop, Phone, Kitchen Tablet):
      </p>
      <ol class="setup-steps-list">
        <li>Create a free Firebase project with Authentication (Google and/or Email/Password) and Cloud Firestore.</li>
        <li>Copy <code>.env.example</code> to <code>.env.local</code> and fill in your <code>VITE_FIREBASE_*</code> values (plus GitHub repository variables if deploying to GitHub Pages).</li>
        <li>Publish <code>firestore.rules</code> from this repo in Firebase Console → Firestore Database → Rules.</li>
      </ol>
    `;
  } else if (syncSnapshot.user) {
    cloudBodyHtml = `
      <div class="callout-box callout-positive">
        <strong>Signed in:</strong> ${escapeHtml(syncSnapshot.user.displayName)}
        ${syncSnapshot.user.email ? `(${escapeHtml(syncSnapshot.user.email)})` : ''}
        <br />
        <span>Status: <strong>${escapeHtml(syncSnapshot.status)}</strong>${
      syncSnapshot.lastSyncedAt ? ` · Last synced ${escapeHtml(syncSnapshot.lastSyncedAt)}` : ''
    }</span>
      </div>
      ${
        syncSnapshot.error
          ? `<div class="callout-box callout-danger">${escapeHtml(syncSnapshot.error)}</div>`
          : ''
      }
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-action="force-cloud-sync">Sync Now</button>
        <button type="button" class="btn btn-outline" data-action="sign-out-cloud">Sign Out</button>
      </div>
    `;
  } else {
    cloudBodyHtml = `
      <p class="muted">
        Sign in to sync your recipe cards and binder dividers automatically across your computer, tablet, and phone.
      </p>
      ${
        syncSnapshot.error
          ? `<div class="callout-box callout-danger">${escapeHtml(syncSnapshot.error)}</div>`
          : ''
      }
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-action="sign-in-google">Sign In with Google</button>
      </div>
      <form id="email-auth-form" class="auth-form">
        <div class="form-grid">
          <div class="form-field">
            <label for="auth-email">Email Address</label>
            <input id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" />
          </div>
          <div class="form-field">
            <label for="auth-password">Password (min 6 chars)</label>
            <input id="auth-password" name="password" type="password" autocomplete="current-password" />
          </div>
        </div>
        <div class="btn-row">
          <button type="submit" class="btn btn-secondary" data-auth-mode="signin">Sign In with Email</button>
          <button type="button" class="btn btn-outline" data-action="sign-up-email">Create Account</button>
        </div>
      </form>
    `;
  }

  const testControlsHtml = IS_TEST_STAGE
    ? `
      <section class="panel-card danger-zone-card">
        <h2>Sandbox Controls (TEST Stage)</h2>
        <p class="muted">
          Current stage is <code>${escapeHtml(SITE_STAGE)}</code> (<code>RecipeBinderDB_Test</code>). You can safely reset or clear sandbox data without affecting <code>LIVE</code> data.
        </p>
        <div class="btn-row">
          <button type="button" class="btn btn-outline" data-action="reset-seed-test">Reset to Starter Recipes</button>
          <button type="button" class="btn btn-danger-outline" data-action="clear-all-test">Clear All Test Recipes</button>
        </div>
      </section>
    `
    : `
      <section class="panel-card">
        <h2>Stage Protection (LIVE Mode)</h2>
        <p class="muted">
          Running in <code>LIVE</code> stage (<code>RecipeBinderDB</code>). Destructive sandbox resets are disabled to protect your recipe collection.
        </p>
      </section>
    `;

  return `
    <section class="sync-shell">
      <div class="panel-card">
        <h2>Cross-Device Cloud Sync (Optional Firebase)</h2>
        ${cloudBodyHtml}
      </div>

      <div class="panel-card">
        <h2>Access Across Devices (PWA, LAN & Hosting)</h2>
        <ul class="cross-device-list">
          <li><strong>Installable Offline PWA:</strong> Open this app in Chrome, Edge, or Safari and choose <em>Install App / Add to Home Screen</em>. Recipes remain readable offline in IndexedDB even without Wi-Fi.</li>
          <li><strong>Home Wi-Fi (LAN):</strong> Run <code>npm.cmd run dev:lan</code> (port <code>5176</code>) or <code>npm.cmd run preview:lan</code> (port <code>4174</code>) on your PC and open <code>http://&lt;PC-IP&gt;:5176</code> on your kitchen tablet or phone.</li>
          <li><strong>Anywhere Access (GitHub Pages):</strong> Push to <code>main</code> with GitHub Pages enabled — <code>.github/workflows/deploy-pages.yml</code> builds and publishes your binder over HTTPS so Wake Lock, PWA install, and Firebase Auth work on any device.</li>
        </ul>
      </div>

      <div class="panel-card">
        <h2>Markdown (.md) Export &amp; Import</h2>
        <p class="muted">
          Export every active recipe as an individual human-readable <code>.md</code> file (organized by divider folder inside a <code>.zip</code> archive), or import existing <code>.md</code> / <code>.txt</code> files.
        </p>
        <div class="backup-controls">
          <button type="button" class="btn btn-primary" data-action="export-all-md-zip">Export All as Markdown (.zip)</button>

          <label class="btn btn-outline file-upload-btn">
            <span>Import Markdown Files (.md)</span>
            <input type="file" id="sync-import-md-input" accept=".md,.markdown,.txt" multiple hidden />
          </label>
        </div>
      </div>

      <div class="panel-card">
        <h2>Offline JSON Backup & Restore</h2>
        <p class="muted">
          Currently storing <strong>${activeCount}</strong> active recipe cards across <strong>${dividerCount}</strong> binder dividers.
        </p>
        <div class="backup-controls">
          <button type="button" class="btn btn-primary" data-action="export-backup">Export Backup (.json)</button>

          <div class="import-box">
            <label for="import-mode-select">Import Mode:</label>
            <select id="import-mode-select">
              <option value="merge">Merge with Existing (newer timestamps win)</option>
              <option value="replace">Replace All Local Data</option>
            </select>
            <label class="btn btn-outline file-upload-btn">
              <span>Choose Backup File (.json)</span>
              <input type="file" id="import-backup-input" accept="application/json,.json" hidden />
            </label>
          </div>
        </div>
      </div>

      ${testControlsHtml}
    </section>
  `;
}
