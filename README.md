# `Recipe Binder`

An offline-first, cross-device digital kitchen recipe binder built with Vanilla ES6 JavaScript, Dexie (IndexedDB), VitePWA, and optional Firebase Cloud Firestore sync. Organize recipes with tactile binder divider tabs, cooking method filters, multi-tagging, fraction-aware serving scaling, traditional printable recipe sheets, `.md` export/import, and website/file/text recipe conversion across desktop, phone, and kitchen tablet.

---

## Overview

- **Site Stage:** `TEST` <!-- Options: TEST (isolated RecipeBinderDB_Test) | LIVE (production RecipeBinderDB) -->
- **Central Project Card:** `../dev-hub/projects/recipe-binder.md`
- **Style Guide:** `../dev-hub/style-guides/flat-utilitarian-warm-parchment.md`
- **Roadmap:** `./ROADMAP.md` (derived from local `zed/recipe-binder-roadmap.md`)
- **Repository:** [https://github.com/debsrant/recipe-binder](https://github.com/debsrant/recipe-binder) *(Public)*
- **Live / Hosting URL:** [https://debsrant.github.io/recipe-binder/](https://debsrant.github.io/recipe-binder/) · Local (`http://localhost:5176` dev · `http://localhost:4174` preview · LAN `dev:lan` / `preview:lan`)

### Core Features

- **Recipe Cards, Dividers, Methods & Multi-Tagging:** Tactile divider tabs (`Weeknight Staples`, `Baking`, `Breakfast`, `Sides & Salads`, `Holiday Classics`, plus custom add/rename/reorder/delete), a **Methods:** filter bar above **Tags:** (`#tag` pills), full-text search across ingredients/notes/methods, Favorites toggle, and sort options (`Recently Updated`, `Title`, `Total Time`, `Favorites First`).
- **Cook Mode, Multi-Method Tabs & Classic Print:** Responsive two-pane binder spread with per-recipe **multi-method cooking tabs** (`methods[]` such as `Skillet` vs. `Oven` or `Instant Pot` vs. `Slow Cooker`), single-method instruction badges, `0.5x`–`3x` fraction-aware scaling, checkable ingredients & method-scoped steps, Screen Wake Lock (`Keep Awake`), `Parchment` / `Slate` / `Dusk` themes, `A-` / `A` / `A+` text scale, auto-dismissing alerts, plus a **Classic Sheet** toggle and **Print: Selected / Print: All** traditional cookbook print layout (`@media print`).
- **Import & Export Engine:** Single-recipe `.md` export/import (YAML frontmatter + `### Method` sections), bulk `.zip` Markdown export organized by divider folder, cooking website URL scraper (local Vite `/api/fetch-recipe` proxy + Schema.org JSON-LD/Microdata + CORS fallback), drag-and-drop file import (`.md`, `.txt`, `.html`, `.json`), and copy-paste text converter.
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

# 2. Start local development server (http://localhost:5176, includes /api/fetch-recipe proxy)
npm.cmd run dev

# 3. Start LAN Wi-Fi server for phone / tablet testing (http://<PC-IP>:5176)
npm.cmd run dev:lan

# 4. Build & preview production PWA (http://localhost:4174, includes /api/fetch-recipe proxy)
npm.cmd run build; npm.cmd run preview
```

### Environment Files (`.env.example` vs. `.env.local`)

- **`.env.example`** (committed to Git): Safe reference template showing supported `VITE_*` configuration keys.
- **`.env.local`** (always in `.gitignore`, never committed): Machine-specific overrides and optional Firebase web app config.
- **Protected Local Notes (`zed/`):** `zed/` is listed in `.gitignore` so personal notes, ideas, and roadmaps stay local and out of the public GitHub repository.
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
| `VITE_RECIPE_PROXY_URL` | Browser | Optional | _(blank = local `/api/fetch-recipe` + CORS fallback)_ | Custom proxy URL for scraping recipes when hosted statically (e.g., GitHub Pages) |

Example `.env.local` (create only when enabling Firebase sync, custom URL proxy, or switching to `LIVE`):

```text
VITE_SITE_STAGE=TEST
# Optional Firebase cross-device sync:
# VITE_FIREBASE_API_KEY=
# VITE_FIREBASE_AUTH_DOMAIN=
# VITE_FIREBASE_PROJECT_ID=
# VITE_FIREBASE_STORAGE_BUCKET=
# VITE_FIREBASE_MESSAGING_SENDER_ID=
# VITE_FIREBASE_APP_ID=
# Optional custom proxy for static hosting URL scraping:
# VITE_RECIPE_PROXY_URL=
```

### Optional Services, Cloud Sync & Cross-Device Deployment

- **100% Offline Mode by Default:** Without `.env.local` Firebase keys, the app runs completely offline with IndexedDB + Service Worker caching and `.md`/`.zip`/`.json` file backup/restore.
- **Optional Firebase Cloud Sync:**
  1. Create a Firebase project and enable **Authentication** (Google and/or Email/Password) plus **Cloud Firestore**.
  2. Publish `firestore.rules` in Firebase Console → Firestore Database → Rules.
  3. Add your `VITE_FIREBASE_*` keys to `.env.local` (for local/LAN) or GitHub Repository Variables (for GitHub Pages).
  4. Note: Over local LAN IP (`http://192.168.x.x:5176`), use **Email & Password** sign-in unless that IP is added to Firebase Authorized Domains, or host via GitHub Pages HTTPS (with `<username>.github.io` added to Firebase Authorized Domains).
- **GitHub Pages HTTPS Hosting:** Repository **Settings → Pages → Source: GitHub Actions** runs `.github/workflows/deploy-pages.yml` on pushes to `main`. See `../dev-hub/runbooks/github-pages-actions-deploy.md`.
- **Local AI / Ollama:** None required (`100% Offline-Capable`).

---

## How to Use (Daily Workflows)

1. **Browse & Filter Collection:** Switch between **Binder Divider** tabs, filter by **Methods:** (`All`, `Skillet`, `Oven`, `Instant Pot`, etc.), click `#tag` pills, or search by title, ingredient, method, or note. Opening a recipe while a method filter is active jumps straight to that method tab.
2. **Cook or Print From an Open Card:** Choose **Cook Mode** (split-pane spread with checkable ingredients/steps and **Keep Awake**) or **Classic Sheet** (traditional cookbook layout). On multi-method recipes, switch method tabs to update cook times and steps, use **Print: Selected / Print: All**, or click **Export .md** for a portable Markdown file.
3. **Import From Web, Files, or Clipboard:** Open the **Import** tab (or click **+ Import**) to scrape a recipe webpage URL, drag-and-drop `.md` / `.txt` / `.html` / `.json` files (also works directly on the Collection view), or paste copied recipe text and convert it into an editable card.
4. **Add, Edit & Manage Methods/Dividers:** Click **+ New Recipe** or **Edit** to manage ingredients and add/reorder/remove cooking methods (`+ Add Cooking Method`), or open **Dividers** to customize binder sections.
5. **Sync Across Devices & Back Up:** Open **Sync & Backup** to sign in with Firebase, export all recipes as a `.zip` of `.md` files, import `.md` files, or export/merge/replace `.json` backups.
6. **Switching `TEST` vs. `LIVE` Stage:** Set `VITE_SITE_STAGE=LIVE` in `.env.local` (and GitHub repo variables if hosted) when ready to separate production recipes (`RecipeBinderDB` / `state_live`) from sandbox testing (`RecipeBinderDB_Test` / `state_test`).

---

## Data, Backups & Stage Management

- **Where Data Lives:**
  - Browser IndexedDB via Dexie: `RecipeBinderDB_Test` (`TEST`) or `RecipeBinderDB` (`LIVE`) with object stores `recipes`, `dividers`, and `meta`.
  - UI preferences in `localStorage`: `recipe-binder:theme` (`parchment` | `slate` | `dusk`), `recipe-binder:fontScale` (`sm` | `md` | `lg`), `recipe-binder:detailLayout` (`binder` | `classic`), and `recipe-binder:printMethodsMode` (`selected` | `all`).
  - Optional Cloud Firestore: `users/{uid}/recipeBinder/state_test` or `state_live` (plus `recipes` subcollection).
- **Backup & Export Formats:** Single-recipe `.md` export/import, bulk `.zip` Markdown export (`<divider>/<recipe>.md`), and lossless `.json` full export/import with **Merge with Existing** (timestamp last-write-wins) or **Replace All Local Data** modes.
- **Stage Rules (`TEST` vs. `LIVE`):** In `TEST` mode, **Sync & Backup** exposes `Reset to Starter Recipes` and `Clear All Test Recipes`. In `LIVE` mode, those destructive sandbox actions are hidden and blocked at the database layer.

---

## Folder Architecture

```text
recipe-binder/
├── .env.example                       <-- Environment variable template
├── .github/
│   └── workflows/
│       └── deploy-pages.yml           <-- GitHub Pages build & deploy workflow
├── .gitignore                         <-- Ignores node_modules, dist, .env*, and local zed/
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
│   ├── config.js                      <-- Stage flags, DB names, localStorage keys, Firebase & proxy env config
│   ├── data/
│   │   └── seedRecipes.js             <-- Default binder dividers & 4 starter recipes (single & multi-method)
│   ├── db/
│   │   └── database.js                <-- Dexie IndexedDB schema, CRUD, tombstones & stage resets
│   ├── lib/
│   │   ├── collection.js              <-- Method/tag aggregation, filtering, sorting & cloud merge logic
│   │   ├── markdown.js                <-- Single/multi-method Markdown serializer & parser
│   │   ├── recipeImport.js            <-- Schema.org JSON-LD, Microdata, HTML & plain-text recipe converter
│   │   ├── scaling.js                 <-- Kitchen fraction parser & ingredient quantity scaler
│   │   ├── webScraper.js              <-- URL validation & proxy/CORS HTML fetcher
│   │   └── zip.js                     <-- Zero-dependency STORE ZIP archive builder
│   ├── main.js                        <-- App bootstrap, state controller, drag-drop & auto-dismiss notices
│   ├── style.css                      <-- Warm Parchment / Slate / Dusk flat utilitarian styles + @media print
│   ├── sync/
│   │   └── cloudSync.js               <-- Optional Firebase Auth & Firestore real-time sync
│   └── ui/
│       ├── collectionView.js          <-- Divider tabs, method/tag filters, search & recipe card grid
│       ├── detailView.js              <-- Cook Mode, Classic Sheet, method tabs & Print Selected/All layout
│       ├── dividersView.js            <-- Add, rename, reorder & delete binder dividers
│       ├── editorView.js              <-- Add / edit recipe card form with multi-method blocks
│       ├── helpers.js                 <-- Escaping, formatting, Blob/text/JSON download & Wake Lock controller
│       ├── importView.js              <-- URL scraper, file dropzone & paste-text converter view
│       └── syncView.js                <-- Cloud sync, .zip/.md export & import, .json backup & TEST controls
├── tests/
│   └── recipe-binder.test.js          <-- Node built-in unit tests (22 tests)
├── vite.config.js                     <-- Vite + VitePWA + /api/fetch-recipe dev/preview proxy (ports 5176 / 4174)
└── zed/                               <-- Local user notes, ideas & roadmap (gitignored & protected)
    ├── ai.md
    └── recipe-binder-roadmap.md
```

---

## Development & Verification

```powershell
# Run unit tests (scaling, methods, tags, Markdown, ZIP, HTML/text import, merge)
npm.cmd test

# Build production PWA bundle and generate Service Worker + manifest
npm.cmd run build
```

- **AI Coding Rules & Architecture State:** `./GEMINI.md`
- **Phased Product Roadmap:** `./ROADMAP.md`
- **Dev Hub Documentation:** `../dev-hub/README.md`
- **Dedicated Multi-Port Runbook:** `../dev-hub/runbooks/localhost-multi-port-setup.md`
- **GitHub Pages Deploy Runbook:** `../dev-hub/runbooks/github-pages-actions-deploy.md`
