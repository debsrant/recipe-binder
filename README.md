# `Recipe Binder`

An offline-first, cross-device digital kitchen recipe binder built with Vanilla ES6 JavaScript, Dexie (IndexedDB), VitePWA, optional Firebase Cloud Firestore sync, and optional local Ollama or BYOK Gemini AI assistance. Organize recipes with horizontal pinnable cards, unified divider/method/tag filters, clickable mix pop-ups, canning specs, fraction-aware scaling, print-ready recipe sheets, batch meal prep, pantry matching, cooking video notes, and front-pocket reference charts across desktop, phone, and kitchen tablet.

---

## Overview

- **Site Stage:** `TEST` <!-- Options: TEST (isolated RecipeBinderDB_Test) | LIVE (production RecipeBinderDB) -->
- **Central Project Card:** `../dev-hub/projects/recipe-binder.md`
- **Style Guide:** `../dev-hub/style-guides/flat-utilitarian-warm-parchment.md`
- **Roadmap:** `./ROADMAP.md` (derived from local `zed/recipe-binder-roadmap.md`)
- **Repository:** [https://github.com/debsrant/recipe-binder](https://github.com/debsrant/recipe-binder) *(Public)*
- **Live / Hosting URL:** [https://debsrant.github.io/recipe-binder/](https://debsrant.github.io/recipe-binder/) · Local (`http://localhost:5176` dev · `http://localhost:4174` preview · LAN `dev:lan` / `preview:lan`)

### Core Features

- **Collection Cards, Unified Filter Bar & Dividers:** Unified **Dividers:** (`All`, `Favorites`, custom dividers), **Methods:** (`Skillet`, `Oven`, `Toaster Oven`, `Instant Pot`, etc.), and **Tags:** filter strips above horizontal, pinnable, collapsible, alphabetically sorted recipe cards with optional compressed thumbnails (`imageUrl`), quick `Mix` / `Canning` / `Storage / Reheat` badges, full-text search, and sort controls.
- **Cook Mode, Mix Pop-Ups, Canning Specs & Classic Print:** Two-pane binder spread with **multi-method cooking tabs** (`methods[]`), `0.5x`–`3x` fraction-aware scaling, live Volume <-> Weight / US Weight unit conversion, checkable ingredients & method-scoped steps, clickable **Mix / Sub-Recipe** ingredient pop-ups (`#mix` / `#sub-recipe` recipes with independent modal scaling), inline **Technique Cards** step pop-ups, collapsible Margin Notes, Storage/Freezer & Microwave/Reheat instructions, **Canning & Preserving Specs** safety panel, Screen Wake Lock (`Keep Awake`), `Parchment` / `Slate` / `Dusk` themes, `A-` / `A` / `A+` text scale, and a **Classic Sheet** toggle with **Print: Selected / Print: All** cookbook printing (`@media print`).
- **Import & Export Engine:** Single-recipe `.md` export/import (YAML frontmatter + `### Method` + `## Canning Specs`), bulk `.zip` Markdown export by divider folder, website URL scraper (`/api/fetch-recipe` proxy + Schema.org JSON-LD/Microdata + CORS fallback), drag-and-drop file import (`.md`, `.txt`, `.html`, `.json`), and paste-text converter with optional AI cleanup.
- **Front Pocket Reference Guide:** Interactive **Unit Converter** (with kitchen ingredient densities), **Substitutions** (including Spices & Herbs), **Reference Charts** (Meat Temps, Grain Ratios, Oil Smoke Points, and **Canning Quick Reference: Headspace & Altitude**), **Food Storage Times** across 6 categories, **Technique Cards**, and **Herb & Spice Profiles** (all pinnable, collapsible, searchable, and customizable via IndexedDB + cloud sync).
- **Batch Cooking & Virtual Pantry:** **Meal Prep** tab with **Freezer, Fridge & Canning Shelf** portion inventory (`Send to Freezer`), **Merged Prep Timeline**, and **Cook Once, Eat Thrice** templates; **Pantry** tab tracking ingredient locations (including `Canning Shelf / Cellar`) & Always-Stocked staples powering the **"What Can I Make?"** recipe matcher.
- **Notes, Video Transcripts & Optional AI Assistant:** **Notes** tab with YouTube inline player + auto-fetched transcripts (`/api/fetch-transcript`) + clickable timestamp jump chips, Google Drive folder links & inline PDF preview, and bi-directional recipe links. Optional dual-backend AI (**Local Ollama** via `/api/ai/ollama/*` or **Gemini API BYOK**) powers Transcript -> Recipe extraction, Import cleanup, Editor Auto-Fill/Cleanup/Title/Yield/Storage-Reheat + Undo, and Cook Mode method adaptation & recipe Q&A.
- **Offline-First & Multi-Device Sync:** Local IndexedDB persistence via Dexie (`RecipeBinderDB_Test` / `RecipeBinderDB`), installable Workbox PWA (`vite-plugin-pwa`), lossless `.json` Export/Merge/Replace backups, and optional Firebase Auth + Firestore real-time sync with last-write-wins & delete tombstones.

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

# 2. Start local development server (http://localhost:5176, includes /api/* proxies)
npm.cmd run dev

# 3. Start LAN Wi-Fi server for phone / tablet testing (http://<PC-IP>:5176)
npm.cmd run dev:lan

# 4. Build & preview production PWA (http://localhost:4174, includes /api/* proxies)
npm.cmd run build; npm.cmd run preview
```

### Environment Files (`.env.example` vs. `.env.local`)

- **`.env.example`** (committed to Git): Safe reference template showing supported `VITE_*` and proxy environment keys.
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
| `OLLAMA_BASE_URL` | Server (Vite proxy) | Optional | `http://127.0.0.1:11434` | Upstream Local Ollama URL for `/api/ai/ollama/*` dev/preview proxy |

Example `.env.local` (create only when enabling Firebase sync, custom URL proxy, custom Ollama host, or switching to `LIVE`):

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
# Optional local Ollama base URL for Vite proxy (/api/ai/ollama/*):
# OLLAMA_BASE_URL=http://127.0.0.1:11434
```

### Optional Services, Local AI (Ollama), Gemini API & Cloud Sync

- **100% Offline Mode by Default:** With **AI Provider = Off** and no `.env.local` Firebase keys, the app runs completely offline with IndexedDB + Service Worker caching and `.md`/`.zip`/`.json` file backup/restore.
- **Optional Local AI (Ollama):**
  - Run Ollama separately on your PC (`ollama serve` listening on `http://127.0.0.1:11434`; Vite's dev/preview server proxies `/api/ai/ollama/*` to `OLLAMA_BASE_URL`, or set a direct LAN URL inside **Sync & Backup -> AI Assistant Settings**).
  - Recommended starter models: `llama3.2` (fast 3B default), `qwen2.5:3b` / `qwen2.5:7b`, or `gemma3:4b`. Useful commands: `ollama pull llama3.2`, `ollama list`, `ollama serve`, `ollama ps`.
  - See `../dev-hub/guides/ollama-local-ai-and-env-local.md` for Windows setup and troubleshooting.
- **Optional Cloud AI (Gemini API BYOK):**
  - Obtain an API key from Google AI Studio and enter it under **Sync & Backup -> AI Assistant Settings** (`gemini-4-hydrogen` default, `gemini-3.5-flash-lite`, `gemini-4-argon`).
  - Uses the Gemini `v1/interactions` REST API with `store: false`. The API key is stored **only in this browser's `localStorage`** (`recipe-binder:aiConfig`) and is **never synced to Cloud Firestore or exported `.json` backups**.
- **Optional Firebase Cloud Sync:**
  1. Create a Firebase project and enable **Authentication** (Google and/or Email/Password) plus **Cloud Firestore**.
  2. Publish `firestore.rules` in Firebase Console -> Firestore Database -> Rules.
  3. Add your `VITE_FIREBASE_*` keys to `.env.local` (for local/LAN) or GitHub Repository Variables (for GitHub Pages).
  4. Note: Over local LAN IP (`http://192.168.x.x:5176`), use **Email & Password** sign-in unless that IP is added to Firebase Authorized Domains, or host via GitHub Pages HTTPS (with `<username>.github.io` added to Firebase Authorized Domains).
- **GitHub Pages HTTPS Hosting:** Repository **Settings -> Pages -> Source: GitHub Actions** runs `.github/workflows/deploy-pages.yml` on pushes to `main`. See `../dev-hub/runbooks/github-pages-actions-deploy.md`.

---

## How to Use (Daily Workflows)

1. **Browse, Pin & Filter Collection:** Use the unified **Dividers:** (`All`, `Favorites`, divider sections), **Methods:** (`All`, `Skillet`, `Toaster Oven`, `Instant Pot`, etc.), and **Tags:** bars, search across ingredients/notes/storage/canning specs, toggle **Pinned Only**, or pin/collapse horizontal recipe cards. Opening a recipe while a method filter is active jumps straight to that method tab.
2. **Cook, Scale Mixes & Print:** Choose **Cook Mode** or **Classic Sheet**. Click highlighted ingredient **Mix / Sub-Recipe** links to open and scale mixes (`0.5x`–`3x`) in a modal without losing your place, click highlighted step **Technique** links for quick how-to cards, switch cooking method tabs (`Toaster Oven`, `Air Fryer`, etc.), review **Canning & Preserving Specs** or Storage/Reheat collapsibles, or open **AI Cook Assistant** to adapt a recipe to another appliance or ask live cooking questions.
3. **Edit with Quick-Tag Chips & AI Helper:** In **Edit Recipe**, use 1-click **Quick tags** (`#toaster-oven`, `#mix`, `#canning`, `#freezer-friendly`, `#make-ahead`, `#quick`), record optional **Canning & Preserving Specs** (verifying against NCHFP/USDA/Ball sources), keep a **Source Video Transcript** open for reference, or use **AI Recipe Helper** (with 1-click Undo) to auto-fill missing summary/servings/yield/storage/reheat fields.
4. **Capture Videos, Transcripts & Notes:** Open **Notes** to store YouTube cooking videos (with inline player, `/api/fetch-transcript` auto-caption fetch, timestamp stripping, and clickable timestamp jump chips), Google Drive folder links & inline PDF previews, and link them back to specific recipe cards (or convert transcripts directly into recipes via AI).
5. **Plan Batches, Check Pantry & Reference Charts:** Track freezer leftovers, fridge meals, and long-shelf **Canning Shelf / Cellar** jars in **Meal Prep**, manage ingredients and run **"What Can I Make?"** in **Pantry**, and check conversions, substitutions, storage lifetimes, herb pairings, or **Canning Quick Reference (Headspace & Altitude)** in **Reference**.
6. **Sync, Back Up & Switch Stage (`TEST` vs. `LIVE`):** Use **Sync & Backup** for Firebase sign-in, `.md` / `.zip` / `.json` backups, and AI provider setup. Set `VITE_SITE_STAGE=LIVE` in `.env.local` (and GitHub repo variables if hosted) when separating production recipes (`RecipeBinderDB` / `state_live`) from sandbox testing (`RecipeBinderDB_Test` / `state_test`).

---

## Data, Backups & Stage Management

- **Where Data Lives:**
  - Browser IndexedDB via Dexie: `RecipeBinderDB_Test` (`TEST`) or `RecipeBinderDB` (`LIVE`) with object stores `recipes`, `dividers`, and `meta` (`referenceData`, `mealPrepData`, `pantryData`, `notesData`).
  - UI & local AI preferences in `localStorage`: `recipe-binder:theme`, `recipe-binder:fontScale`, `recipe-binder:detailLayout`, `recipe-binder:printMethodsMode`, `recipe-binder:unitMode`, `recipe-binder:refPinnedCards`, `recipe-binder:refCollapsedCards`, `recipe-binder:notesPinnedCards`, `recipe-binder:notesCollapsedCards`, `recipe-binder:recipePinnedCards`, `recipe-binder:recipeCollapsedCards`, and `recipe-binder:aiConfig` (Gemini API key remains strictly local to this browser).
  - Optional Cloud Firestore: `users/{uid}/recipeBinder/state_test` or `state_live` (plus `recipes` subcollection).
- **Backup & Export Formats:** Single-recipe `.md` export/import (including `## Canning Specs`), bulk `.zip` Markdown export (`<divider>/<recipe>.md`), and lossless `.json` full export/import with **Merge with Existing** (timestamp last-write-wins) or **Replace All Local Data** modes.
- **Stage Rules (`TEST` vs. `LIVE`):** In `TEST` mode, **Sync & Backup** exposes `Reset to Starter Recipes` and `Clear All Test Recipes`. In `LIVE` mode, those destructive sandbox actions are hidden and blocked at the database layer.

---

## Folder Architecture

```text
recipe-binder/
├── .env.example                       <-- Safe environment variable template
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
│   │   ├── referenceGuide.js          <-- Meat temps, grain ratios, oil smoke points, canning charts, storage times, techniques & herbs
│   │   └── seedRecipes.js             <-- Default binder dividers & starter recipes
│   ├── db/
│   │   └── database.js                <-- Dexie IndexedDB schema, CRUD, tombstones & stage resets
│   ├── lib/
│   │   ├── ai.js                      <-- Dual-backend AI client (Ollama proxy + Gemini Interactions API) & draft helpers
│   │   ├── collection.js              <-- Method/tag/canning normalization, filtering, sorting & cloud merge logic
│   │   ├── markdown.js                <-- Single/multi-method Markdown serializer & parser (incl. Canning Specs)
│   │   ├── mealPrep.js                <-- Freezer/Fridge/Canning Shelf inventory, merged timeline & batch templates
│   │   ├── notes.js                   <-- Notes, YouTube/Drive URL helpers, timestamps & snapshot merge
│   │   ├── pantry.js                  <-- Virtual pantry locations, Always-Stocked staples & ingredient matcher
│   │   ├── recipeImport.js            <-- Schema.org JSON-LD, Microdata, HTML & plain-text recipe converter
│   │   ├── reference.js               <-- Reference Guide CRUD normalization, defaults & sync merge
│   │   ├── scaling.js                 <-- Kitchen fraction parser & ingredient quantity scaler
│   │   ├── subRecipes.js              <-- Mix / sub-recipe detection & safe ingredient cross-link builder
│   │   ├── techniques.js              <-- Step keyword scanner & technique pop-up linker
│   │   ├── transcript.js              <-- YouTube caption fetcher & timestamp cleaner client
│   │   ├── units.js                   <-- Volume, weight, temperature & density unit converter
│   │   ├── webScraper.js              <-- URL validation & proxy/CORS HTML fetcher
│   │   └── zip.js                     <-- Zero-dependency STORE ZIP archive builder
│   ├── main.js                        <-- App bootstrap, state controller, modals, drag-drop & notices
│   ├── style.css                      <-- Warm Parchment / Slate / Dusk flat utilitarian styles + @media print
│   ├── sync/
│   │   └── cloudSync.js               <-- Optional Firebase Auth & Firestore real-time sync
│   └── ui/
│       ├── collectionView.js          <-- Unified divider/method/tag filters, search & horizontal pinnable cards
│       ├── detailView.js              <-- Cook Mode, Classic Sheet, mix modal, canning panel, Cook AI & print sheet
│       ├── dividersView.js            <-- Add, rename, reorder & delete binder dividers
│       ├── editorView.js              <-- Recipe form with AI Helper, transcript box, canning specs & quick tags
│       ├── helpers.js                 <-- Escaping, image compression, downloads & Wake Lock controller
│       ├── importView.js              <-- URL scraper, file dropzone & paste-text converter with AI cleanup
│       ├── mealPrepView.js            <-- Stored batch inventory (incl. Canning Shelf), timeline & templates UI
│       ├── notesView.js               <-- Cooking notes, Drive links/PDFs, YouTube player & AI transcript conversion
│       ├── pantryView.js              <-- Pantry inventory & "What Can I Make?" matcher UI
│       ├── referenceView.js           <-- Unit converter, substitutions, charts, storage times, techniques & herb profiles
│       └── syncView.js                <-- Cloud sync, AI settings, .zip/.md/.json backup & TEST stage controls
├── tests/
│   └── recipe-binder.test.js          <-- Node built-in unit tests (40 tests)
├── vite.config.js                     <-- Vite + VitePWA + /api/* proxies (ports 5176 / 4174)
└── zed/                               <-- Local user notes, ideas & roadmap (gitignored & protected)
    ├── ai.md
    ├── notes.md
    └── recipe-binder-roadmap.md
```

---

## Development & Verification

```powershell
# Run unit tests (40 tests across scaling, mixes, canning, notes, pantry, meal prep, AI & Markdown)
npm.cmd test

# Build production PWA bundle and generate Service Worker + manifest
npm.cmd run build
```

- **AI Coding Rules & Architecture State:** `./GEMINI.md`
- **Phased Product Roadmap:** `./ROADMAP.md`
- **Dev Hub Documentation:** `../dev-hub/README.md`
- **Local Ollama Setup & `.env.local` Guide:** `../dev-hub/guides/ollama-local-ai-and-env-local.md`
- **Dedicated Multi-Port Runbook:** `../dev-hub/runbooks/localhost-multi-port-setup.md`
- **GitHub Pages Deploy Runbook:** `../dev-hub/runbooks/github-pages-actions-deploy.md`
