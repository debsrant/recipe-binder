# `Recipe Binder`

An offline-first, cross-device digital kitchen recipe binder built with Vanilla ES6 JavaScript, Dexie (IndexedDB), VitePWA, and optional Firebase Cloud Firestore sync. Organize recipes with tactile binder divider tabs, multi-tagging, fraction-aware serving scaling, and an open-binder cook layout across desktop, phone, and kitchen tablet.

---

## Overview

- **Site Stage:** `TEST` <!-- Options: TEST (isolated RecipeBinderDB_Test) | LIVE (production RecipeBinderDB) -->
- **Central Project Card:** `../dev-hub/projects/recipe-binder.md`
- **Style Guide:** `../dev-hub/style-guides/flat-utilitarian-warm-parchment.md`
- **Roadmap:** `./ROADMAP.md` (derived from `zed/recipe-binder/recipe-binder-roadmap.md`)
- **Repository:** `https://github.com/debsrant/recipe-binder` *(configure remote before pushing)*
- **Local URLs:** `http://localhost:5176` (`dev`) · `http://localhost:4174` (`preview`) · LAN Wi-Fi (`dev:lan` / `preview:lan`) · Optional GitHub Pages HTTPS via `.github/workflows/deploy-pages.yml`

### Core Features

- **Recipe Cards, Binder Dividers & Multi-Tagging:** Tactile divider tabs (`Weeknight Staples`, `Baking`, `Breakfast`, `Sides & Salads`, `Holiday Classics`, plus custom add/rename/reorder/delete), normalized `#tag` filtering, full-text search across ingredients/steps/notes, Favorites toggle, and sort options.
- **Open-Binder Cook View & Cross-Device UX:** Responsive split-pane layout (ingredients + Cook's Margin Notes alongside numbered instructions), `0.5x` / `1x` / `2x` / `3x` fraction-aware ingredient scaling, checkable ingredients & steps, Screen Wake Lock (`Keep Awake`), `Parchment` / `Slate` / `Dusk` themes, `A-` / `A` / `A+` text scale, and printable recipe cards.
- **Offline-First & Multi-Device Sync:** Local IndexedDB persistence via Dexie (`RecipeBinderDB_Test` / `RecipeBinderDB`), installable Workbox PWA (`vite-plugin-pwa`), lossless `.json` Export/Merge/Replace backups, and optional Firebase Auth + Firestore real-time sync with last-write-wins & soft-delete tombstones.

---

## Setup & Configuration

### Prerequisites

- **Runtime / Tools:** Node.js LTS (v20+), Git, Chrome / Edge / Safari (for PWA install & Wake Lock)
- **Editor (Recommended):** VS Code opening `recipe-binder.code-workspace` (pairs the app with `../dev-hub`)
- **Windows PowerShell Note:** If execution policy blocks `npm.ps1`, use `npm.cmd` instead of `npm` and separate chained commands with `;` rather than `&&`.

### Workspace & Installation

```powershell
# 1. Install dependencies
npm.cmd install

# 2. Start local development server (http://localhost:5176)
npm.cmd run dev

# 3. Start LAN Wi-Fi server for phone / tablet testing (http://<PC-IP>:5176)
npm.cmd run dev:lan

# 4. Build & preview production PWA (http://localhost:4174)
npm.cmd run build; npm.cmd run preview
```

### Environment Files (`.env.example` vs. `.env.local`)

- **`.env.example`** (committed to Git): Safe reference template showing supported `VITE_*` configuration keys.
- **`.env.local`** (always in `.gitignore`, never committed): Machine-specific overrides and optional Firebase web app config.
- **Firebase Web Keys Note:** Firebase web app identifiers (`VITE_FIREBASE_*`) are public client config values bundled into the browser and protected by `firestore.rules` (`request.auth.uid == userId`). Never put admin or private server secrets in `VITE_*` variables.
- **Restart Required:** Restart `npm.cmd run dev` whenever `.env.local` changes.

| Variable | Scope | Required? | Default / Example | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_SITE_STAGE` | Browser | No | `TEST` (`TEST` \| `LIVE`) | Switches `RecipeBinderDB_Test` / `state_test` vs. `RecipeBinderDB` / `state_live` |
| `VITE_FIREBASE_API_KEY` | Browser | Optional | _(blank = offline-only)_ | Firebase Web App API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Browser | Optional | _(blank = offline-only)_ | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Browser | Optional | _(blank = offline-only)_ | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Browser | Optional | _(blank = offline-only)_ | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Browser | Optional | _(blank = offline-only)_ | Firebase Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Browser | Optional | _(blank = offline-only)_ | Firebase Web App ID |

Example `.env.local` (create only when enabling Firebase sync or switching to `LIVE`):

```text
VITE_SITE_STAGE=TEST
# Optional Firebase cross-device sync:
# VITE_FIREBASE_API_KEY=
# VITE_FIREBASE_AUTH_DOMAIN=
# VITE_FIREBASE_PROJECT_ID=
# VITE_FIREBASE_STORAGE_BUCKET=
# VITE_FIREBASE_MESSAGING_SENDER_ID=
# VITE_FIREBASE_APP_ID=
```

### Optional Services, Cloud Sync & Cross-Device Deployment

- **100% Offline Mode by Default:** Without `.env.local` Firebase keys, the app runs completely offline with IndexedDB + Service Worker caching and `.json` file backup/restore.
- **Optional Firebase Cloud Sync:**
  1. Create a Firebase project and enable **Authentication** (Google and/or Email/Password) plus **Cloud Firestore**.
  2. Publish `firestore.rules` in Firebase Console → Firestore Database → Rules.
  3. Add your `VITE_FIREBASE_*` keys to `.env.local` (for local/LAN) or GitHub Repository Variables (for GitHub Pages).
  4. Note: Over local LAN IP (`http://192.168.x.x:5176`), use **Email & Password** sign-in unless that IP is added to Firebase Authorized Domains or the app is hosted on HTTPS.
- **GitHub Pages HTTPS Hosting:** Enable **Settings → Pages → Source: GitHub Actions** in your repository; pushing to `main` triggers `.github/workflows/deploy-pages.yml` so your binder is reachable from any phone, tablet, or desktop over HTTPS.
- **Local AI / Ollama:** None required (`100% Offline-Capable`).

---

## How to Use (Daily Workflows)

1. **Browse & Filter Collection:** Launch the app and switch between **Binder Divider** tabs (`All Recipes`, `Favorites`, `Weeknight Staples`, `Baking`, etc.), click `#tag` pills, or type in the search bar to filter by title, ingredient, or note.
2. **Cook From an Open Card:** Click any recipe card to open the two-pane binder spread. Choose `0.5x`, `1x`, `2x`, or `3x` to scale quantities, check off ingredients and steps as you go, tap **Keep Awake** to prevent screen sleep, or use **Print Card** for a clean paper sheet.
3. **Add, Edit & Manage Dividers:** Click **+ New Recipe** to create a card (one ingredient/step per line), or switch to the **Dividers** tab to add, rename, reorder, or remove binder sections.
4. **Sync Across Devices & Back Up:** Open **Sync & Backup** to sign in with Firebase for automatic multi-device sync, export a `.json` backup, or import/merge a backup from another device.
5. **Switching `TEST` vs. `LIVE` Stage:** Set `VITE_SITE_STAGE=LIVE` in `.env.local` (and GitHub repo variables if hosted) when ready to separate production recipes (`RecipeBinderDB` / `state_live`) from sandbox testing (`RecipeBinderDB_Test` / `state_test`).

---

## Data, Backups & Stage Management

- **Where Data Lives:**
  - Browser IndexedDB via Dexie: `RecipeBinderDB_Test` (`TEST`) or `RecipeBinderDB` (`LIVE`) with object stores `recipes`, `dividers`, and `meta`.
  - UI preferences in `localStorage`: `recipe-binder:theme` (`parchment` | `slate` | `dusk`) and `recipe-binder:fontScale` (`sm` | `md` | `lg`).
  - Optional Cloud Firestore: `users/{uid}/recipeBinder/state_test` or `state_live` (plus `recipes` subcollection).
- **Backup & Export Formats:** Lossless `.json` export and import with explicit **Merge with Existing** (timestamp last-write-wins) or **Replace All Local Data** modes.
- **Stage Rules (`TEST` vs. `LIVE`):** In `TEST` mode, **Sync & Backup** exposes `Reset to Starter Recipes` and `Clear All Test Recipes`. In `LIVE` mode, those destructive sandbox actions are hidden and blocked at the database layer.

---

## Folder Architecture

```text
recipe-binder/
├── .env.example                       <-- Environment variable template
├── .github/
│   └── workflows/
│       └── deploy-pages.yml           <-- GitHub Pages build & deploy workflow
├── .gitignore
├── GEMINI.md                          <-- Two-tier AI coding rules & dynamic project state
├── README.md                          <-- Project overview, setup, and usage guide
├── ROADMAP.md                         <-- Phased implementation roadmap
├── firestore.rules                    <-- Per-user Firestore security rules
├── index.html                         <-- App entry HTML
├── package.json                       <-- Scripts & dependencies (dexie, firebase, vite-plugin-pwa)
├── public/
│   ├── favicon.svg                    <-- Browser tab icon
│   └── pwa-icon.svg                   <-- Maskable PWA app icon
├── recipe-binder.code-workspace       <-- Multi-root VS Code workspace paired with dev-hub
├── src/
│   ├── config.js                      <-- Stage flags, DB names, localStorage keys, Firebase env config
│   ├── data/
│   │   └── seedRecipes.js             <-- Default binder dividers & 4 starter recipes
│   ├── db/
│   │   └── database.js                <-- Dexie IndexedDB schema, CRUD, tombstones & stage resets
│   ├── lib/
│   │   ├── collection.js              <-- Tag normalization, filtering, sorting & cloud merge logic
│   │   └── scaling.js                 <-- Kitchen fraction parser & ingredient quantity scaler
│   ├── main.js                        <-- App bootstrap, state controller & event delegation
│   ├── style.css                      <-- Warm Parchment / Slate / Dusk flat utilitarian styles + print CSS
│   ├── sync/
│   │   └── cloudSync.js               <-- Optional Firebase Auth & Firestore real-time sync
│   └── ui/
│       ├── collectionView.js          <-- Divider tabs, tag pills, search & recipe card grid
│       ├── detailView.js              <-- Open-binder 2-column cook view, scaling & Wake Lock
│       ├── dividersView.js            <-- Add, rename, reorder & delete binder dividers
│       ├── editorView.js              <-- Add / edit recipe card form
│       ├── helpers.js                 <-- Escaping, formatting, JSON download & Wake Lock controller
│       └── syncView.js                <-- Cloud sync, cross-device PWA/LAN guide, backup & TEST controls
├── tests/
│   └── recipe-binder.test.js          <-- Node built-in unit tests for scaling, filtering & sync merge
├── vite.config.js                     <-- Vite + VitePWA config (ports 5176 dev / 4174 preview)
└── zed/                               <-- User notes, ideas & roadmap (protected; AI must not overwrite)
    ├── ai.md
    └── recipe-binder-roadmap.md
```

---

## Development & Verification

```powershell
# Run unit tests (scaling, tag normalization, filtering, merge conflict resolution)
npm.cmd test

# Build production PWA bundle and generate Service Worker + manifest
npm.cmd run build
```

- **AI Coding Rules & Architecture State:** `./GEMINI.md`
- **Phased Product Roadmap:** `./ROADMAP.md`
- **Dev Hub Documentation:** `../dev-hub/README.md`
- **Dedicated Multi-Port Runbook:** `../dev-hub/runbooks/localhost-multi-port-setup.md`
