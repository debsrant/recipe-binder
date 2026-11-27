# Project Context & AI Coding Rules

> **Instructions:** Copy this file to the root of a new project as `GEMINI.md`. This file is divided into **Immutable Rules** (which the AI must never alter or delete) and **Dynamic Project State** (which the AI updates incrementally as the project evolves).

---

## PART 1: IMMUTABLE CORE RULES (AI: DO NOT OVERWRITE OR DELETE)
> **Strict AI Instruction:** When asked to update `GEMINI.md`, **NEVER** overwrite, summarize away, or delete any bullet points in Part 1. Treat Part 1 as read-only unless explicitly instructed to modify a specific rule.

### 1. Project Identity & Links
* **Project Name:** `Recipe Binder`
* **Primary Purpose:** `Offline-first, cross-device digital kitchen recipe binder with tactile divider tabs, multi-tagging, ingredient scaling, open-binder cook mode, and optional Firebase cloud sync.`
* **Target Environment:** `Cross-device Web & Installable PWA (Desktop Browser, Mobile Phone, Kitchen Tablet via LAN Wi-Fi or GitHub Pages HTTPS)`
* **Central Project Card:** `../dev-hub/projects/recipe-binder.md`
* **Site Stage:** `TEST` <!-- Options: TEST | LIVE -->
  * **When `TEST`:** Do NOT maintain legacy code, deprecated fields, backwards-compatibility shims, or multi-step schema migrations. Collapse database schemas to a single clean version, remove unused legacy code freely, and allow destructive data resets/deletions.
  * **When `LIVE`:** Preserve backwards compatibility, increment database schema versions non-destructively, and never wipe or orphan existing production records.

### 2. Coding Conventions & Architecture
* **Modularity:** Keep modules small, readable, and single-purpose inside `src/`. Avoid monolithic files.
* **Offline-First & Resilience:** Gracefully handle network drops; never assume external APIs or local Ollama servers are always reachable without fallback UI states.
* **Secrets & Security:**
  * **NEVER** hardcode API keys, Firebase credentials, or tokens in source files.
  * **NEVER** read or output the contents of `.env` or `.env.local`. Only reference variable names from `.env.example` or `import.meta.env.VITE_*`.
* **Dependencies:** Prefer lightweight, well-maintained libraries or native browser APIs over heavy frameworks unless explicitly requested.
* **Protected User Folder (`zed/`):** The `zed/` folder (when present) contains user notes, ideas, terminal commands, and AI prompts. **NEVER** overwrite, modify, or delete any files inside `zed/` unless explicitly instructed by the user.

### 3. Safe Merging & Update Protocol (How to Edit This File)
When asked to update `GEMINI.md` or sync project progress:
1. **Read First:** Always read the entire existing `GEMINI.md` before making edits.
2. **Preserve Part 1:** Leave everything above the `PART 2` divider completely intact.
3. **Append, Don't Replace:** In Part 2, add new environment variables, ports, or architectural decisions to existing lists rather than replacing the section. Only remove an item if it was explicitly deleted from the codebase.
4. **Sync Dev-Hub:** Mirror major stack, dependency, or status changes to `../dev-hub/projects/recipe-binder.md`.

---

## PART 2: DYNAMIC PROJECT STATE (AI: UPDATE INCREMENTALLY)

### 4. Tech Stack & Attached Services
* **Frontend / Core:** `Vanilla ES6 JavaScript, HTML5, CSS3 (flat-utilitarian-warm-parchment theme variants: Parchment, Slate, Dusk), Vite, VitePWA`
* **Local Storage / DB:** `IndexedDB via Dexie.js (RecipeBinderDB_Test in TEST / RecipeBinderDB in LIVE; stores: recipes, dividers, meta holding referenceData, mealPrepData, pantryData, notesData) + localStorage preferences (recipe-binder:theme, recipe-binder:fontScale, recipe-binder:detailLayout, recipe-binder:printMethodsMode, recipe-binder:unitMode, recipe-binder:refPinnedCards, recipe-binder:refCollapsedCards, recipe-binder:notesPinnedCards, recipe-binder:notesCollapsedCards, recipe-binder:recipePinnedCards, recipe-binder:recipeCollapsedCards, recipe-binder:aiConfig)`
* **Cloud / External Services:** `Optional Firebase Auth (Google + Email/Password) & Cloud Firestore (users/{uid}/recipeBinder/state_{test|live}/recipes) with offline persistence; GitHub Pages deployment via .github/workflows/deploy-pages.yml`
* **AI / LLM Endpoints:** `Optional Dual-Backend AI (100% Offline-Capable by default): Local Ollama via Vite proxy (/api/ai/ollama/* -> OLLAMA_BASE_URL, default http://127.0.0.1:11434) or BYOK Gemini API v1 Interactions REST (gemini-4-hydrogen, gemini-3.5-flash-lite, gemini-4-argon; key stored in browser localStorage only)`

### 5. Tracked Variables, Ports & Config Keys
*(AI: Keep this table updated with variable names and local ports—never log actual secret values.)*
| Key / Port | Purpose | Where Defined |
| :--- | :--- | :--- |
| `VITE_SITE_STAGE` | `TEST` \| `LIVE` stage flag (switches IndexedDB & Firestore stage doc) | `.env.example` / `src/config.js` |
| `VITE_FIREBASE_API_KEY` | Optional Firebase Web App API key (public client identifier protected by `firestore.rules`) | `.env.example` / `src/config.js` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Optional Firebase Auth domain | `.env.example` / `src/config.js` |
| `VITE_FIREBASE_PROJECT_ID` | Optional Firebase Project ID | `.env.example` / `src/config.js` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Optional Firebase Storage bucket | `.env.example` / `src/config.js` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Optional Firebase Messaging sender ID | `.env.example` / `src/config.js` |
| `VITE_FIREBASE_APP_ID` | Optional Firebase App ID | `.env.example` / `src/config.js` |
| `VITE_RECIPE_PROXY_URL` | Optional custom URL proxy for static hosting web-recipe scraping | `.env.example` / `src/config.js` |
| `OLLAMA_BASE_URL` | Optional local Ollama base URL for Vite dev/preview proxy (`/api/ai/ollama/*`; default `http://127.0.0.1:11434`) | `.env.example` / `vite.config.js` |
| `localhost:5176` | Vite local dev server (`strictPort: true`, `dev:lan`; serves `/api/fetch-recipe`, `/api/fetch-transcript`, `/api/ai/ollama/*`) | `vite.config.js` |
| `localhost:4174` | Vite PWA preview server (`strictPort: true`, `preview:lan`; serves `/api/fetch-recipe`, `/api/fetch-transcript`, `/api/ai/ollama/*`) | `vite.config.js` |

### 6. Architectural Decisions & Changelog
*(AI: Append a dated 1-line note whenever a new library, schema change, or structural pattern is introduced.)*
* `2026-11-26`: Initialized project scaffold, multi-root workspace, Dexie IndexedDB + VitePWA offline shell, Phase 1 Recipe Cards & Dividers UI, pure-JS scaling/collection modules with `node --test` suite, and optional Firebase Firestore cross-device sync.
* `2026-11-26`: Added Classic Sheet view & traditional `@media print` cookbook typography, single `.md` export/import + zero-dependency `.zip` bulk Markdown export, local Vite `/api/fetch-recipe` proxy + JSON-LD/Microdata URL scraper, and drag-and-drop file + copy-paste text recipe conversion.
* `2026-11-26`: Added per-recipe multi-method cooking tabs (`methods[]`) with single-method instruction labels, Print Selected / Print All toggle, multi-method Markdown/HTML/text import parsing, and auto-dismissing alert banners.
* `2026-11-26`: Added Collection `Methods:` filter bar above `Tags:` (auto-selecting the filtered method tab on open), untracked `zed/` via `.gitignore`, enabled public GitHub Pages deployment, and aligned `README.md`, CI env vars, and `dev-hub` docs.
* `2026-11-26`: Implemented Phase 4 Front Pocket Reference Guide (meat temps, grain ratios, oil smoke points, substitutions, 12 technique cards with in-recipe keyword pop-ups, and interactive SVG flavor pairing wheel) plus standalone & in-recipe Volume <-> Weight unit converter.
* `2026-11-26`: Added dedicated Substitutions tab (including Spices & Herbs) and full IndexedDB + Firebase cloud sync CRUD (add/edit/delete/reset) for Substitutions, Technique Cards, and Flavor Wheel entries.
* `2026-11-26`: Implemented Phase 5 Batch Cooking & Meal Prep Engine (`src/lib/mealPrep.js`, `src/ui/mealPrepView.js`) with Freezer & Leftover Inventory ("Send to Freezer"), Merged Prep Timelines, "Cook Once, Eat Thrice" templates with IndexedDB/Firebase sync, and added `servingSize` yield labels across recipe cards, editor, detail view, and Markdown export/import.
* `2026-11-26`: Implemented Phase 6 Virtual Pantry & "What Can I Make?" Ingredient Matcher (`src/lib/pantry.js`, `src/ui/pantryView.js`) with starter Always-Stocked staples, quick-add from recipes, missing-ingredient restock actions, IndexedDB persistence (`pantryData`), Firebase cloud sync, and JSON backup support.
* `2026-11-27`: Replaced SVG Flavor Wheel with food-pairing-focused Herb & Spice Profiles (UMaine #4365 guide), added Food Storage Times reference tab across 6 categories, and made all Reference cards pinnable and collapsible via `localStorage` (`recipe-binder:refPinnedCards`, `recipe-binder:refCollapsedCards`).
* `2026-11-27`: Added top-level **Notes** tab (`src/lib/notes.js`, `src/lib/transcript.js`, `src/ui/notesView.js`, `/api/fetch-transcript`) with YouTube inline player + clickable timestamp jump chips, Google Drive folder & inline PDF preview, bi-directional Recipe Linking, and Dexie/Firestore/JSON sync.
* `2026-11-27`: Added optional dual-backend **AI Assistant** (`src/lib/ai.js`, `/api/ai/ollama/*` Vite proxy, Gemini v1 Interactions REST API) powering Notes Transcript -> Recipe & Summarize, Import AI cleanup, Editor AI Co-Pilot (Auto-Fill, Cleanup, Title, Yield, Storage/Reheat, Transcript re-extract, Undo), and Cook Mode Assistant (Generate New Method Tab + Ask About This Recipe + save-to-card actions).
* `2026-11-27`: Redesigned Collection cards as horizontal, pinnable, collapsible, A–Z sorted cards with optional photo thumbnails (`imageUrl`), dedicated `storageNotes` / `reheatNotes`, `sourceTranscript`, collapsible Detail/Editor sections, and unified `Dividers:` filter strip above `Methods:` and `Tags:`.
* `2026-11-27`: Added Clickable Mix / Sub-Recipe ingredient pop-ups (`src/lib/subRecipes.js`, `renderMixModal`), Canning & Preserving specs (`canning` schema + `## Canning Specs` Markdown round-trip + Reference Charts headspace/altitude guide + `canning-shelf` Pantry & Meal Prep location), and `Toaster Oven` cooking method + 1-click editor Quick-Tag chips.

### 7. Dev-Hub Runbook Integration
* **Extracting Runbooks (`../dev-hub/runbooks/<topic>.md`):** When asked to *"turn this into a runbook"*, extract reusable, step-by-step terminal commands and configuration checklists, replacing project-specific names with `<placeholders>`.
* **Referencing Existing Runbooks:** Check `../dev-hub/runbooks/` before reinventing setup steps for Git, Vite, Firebase, Ollama, or Android deployment.
