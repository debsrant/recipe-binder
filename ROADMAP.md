# Recipe Binder — Product Roadmap

Grounded in `zed/recipe-binder-roadmap.md` ("The Modern Digital Kitchen Binder"): tactile, distraction-free, offline-first, and designed for active cooking across desktop, phone, and kitchen tablet.

---

## Phase 1: Core Recipe Cards, Dividers & Cross-Device Sync *(Implemented)*

- [x] **Unified Binder Filters & Horizontal Recipe Cards:** **Dividers:** (`All`, `Favorites`, custom dividers), **Methods:**, and **Tags:** filter strips above horizontal, pinnable, collapsible, alphabetically sorted recipe cards with optional compressed thumbnails (`imageUrl`), dedicated Storage/Freezer & Microwave/Reheat notes, and divider management (add/rename/reorder/delete).
- [x] **Open-Binder Detail View:** Responsive split ingredients + steps spread, checkable ingredient & method-scoped step items, collapsible Margin Notes & Storage/Reheat cards, `A-` / `A` / `A+` text scaling, and Warm Parchment / Slate / Dusk themes.
- [x] **Dynamic Recipe Scaling:** `0.5x`, `1x`, `2x`, `3x` with fraction-aware ingredient line scaling and per-portion serving yield labels (`servingSize`).
- [x] **Active Kitchen UX Basics & Print:** Screen Wake Lock `Keep Awake` toggle, auto-dismissing alert banners, and **Classic Sheet** traditional cookbook view with `@media print` (**Print: Selected / Print: All**).
- [x] **Cross-Device Availability & Offline-First Persistence:** Dexie IndexedDB (`RecipeBinderDB_Test` / `RecipeBinderDB`), installable VitePWA Workbox shell, LAN Wi-Fi dev/preview scripts, GitHub Pages CI workflow, optional Firebase Auth + Cloud Firestore sync with tombstones, and lossless `.json` export/merge/replace backup.

---

## Phase 2: Enhanced Core Recipe Management *(Partially Implemented)*

- [x] **Volume <-> Weight Unit Converter:** Standalone reference converter plus live in-recipe `Original` / `g / ml` / `oz / lb` toggle with ingredient densities.
- [x] **Frictionless Import & Export Engine:** Website URL scraper (`/api/fetch-recipe` proxy + Schema.org JSON-LD/Microdata + CORS fallback), single `.md` export/import (YAML frontmatter + multi-method sections + `## Canning Specs`), bulk `.zip` Markdown export, drag-and-drop file import, and copy-paste text converter.
- [x] **Multi-Method Cooking Tabs & Toaster Oven Support:** Multiple cooking methods (`methods[]`) per card with method notes, `Toaster Oven`, `Water Bath Canner`, `Pressure Canner`, and 1-click editor Quick-Tag chips (`#toaster-oven`, `#mix`, `#canning`, `#freezer-friendly`, `#make-ahead`, `#quick`).
- [x] **Clickable Mix / Sub-Recipe Ingredient Pop-Ups:** Highlighted `#mix` / `#sub-recipe` ingredients inside other recipes open an inline modal with independent `0.5x`–`3x` scaling, instructions, and storage notes.
- [x] **Canning & Preserving Specs:** Dedicated optional canning specs panel (`method`, `jarSize`, `headspace`, `processingTime`, `pressure`, `altitudeNote`, `testedSource`) synced through IndexedDB, Firestore, and Markdown.
- [ ] **Recipe Version History:** Preserve previous snapshots when tweaking a recipe over time so cooks can compare or revert.
- [ ] **OCR / Photo Scan:** Extract text from photographed index cards and cookbook pages while keeping the photo attached.

---

## Phase 3: Active Cook Mode & Inline Timers

- [ ] **Inline Step Timers:** Automatically detect durations in steps (e.g., `"simmer for 15 minutes"`) so tapping spawns a labeled pinned countdown timer.
- [ ] **Hands-Free Step Navigation:** Voice commands or oversized next/prev step mode for flour-covered hands.
- [ ] **"Cooked It" Log:** Track when each dish was last made and surface recent kitchen history.

---

## Phase 4: Cooking Techniques & Reference Guide (The "Front Pocket") *(Implemented)*

- [x] **Interactive Reference Charts:** Internal meat temperatures, grain-to-water ratios, cooking oil smoke points, and **Canning Quick Reference (Headspace & Altitude Adjustments)** tables.
- [x] **Customizable Substitutions & Food Storage Times:** Searchable substitutions (including Spices & Herbs) plus 6-category Food Storage Times guide (`Fridge`, `Freezer`, `Pantry`), all pinnable, collapsible, and cloud-synced.
- [x] **Technique Cards & In-Recipe Linking:** Step-by-step reference cards linked from highlighted keywords inside instructions.
- [x] **Herb & Spice Profiles:** Food-pairing-focused guide grounded in UMaine #4365 *(replaces the earlier SVG Flavor Wheel concept)* with customizable pairings and quick-add companion chips.

---

## Phase 5: Batch Cooking & Meal Prep Engine *(Implemented)*

- [x] **"Cook Once, Eat Thrice" Templates:** Link a batch base to derivative weeknight recipes.
- [x] **Merged Prep Timelines:** Combine multiple selected recipes into one scaled, temperature-highlighted chronological prep checklist.
- [x] **Freezer, Fridge & Canning Shelf Inventory:** `"Send to Freezer"` portion/date tracker with freshness alerts, `Canning Shelf / Cellar` support (`365d` default), and reheating notes.

---

## Phase 6: Dynamic Pantry & Grocery Ecosystem *(Partially Implemented)*

- [x] **Virtual Pantry & "Always Stocked" Staples:** Track pantry, fridge, freezer, spice rack, and `Canning Shelf / Cellar` inventory, quick-add ingredients from recipes, and filter by *"What Can I Make?"*.
- [ ] **Smart Grocery List Aggregation:** Merge duplicate ingredients across planned recipes and group by grocery aisle.
- [ ] **Household Shared Binders:** Multi-user shared binder & live grocery checklist collaboration.

---

## Phase 7: Notes, Video Transcripts & Optional AI Assistant *(Implemented)*

- [x] **Cooking Notes, YouTube & Google Drive Media:** Top-level **Notes** tab with YouTube inline player, `/api/fetch-transcript` auto-captions, timestamp cleaning, clickable timestamp jump chips, Google Drive folder/PDF preview, and bi-directional recipe links.
- [x] **Optional Dual-Backend AI (`Ollama` Local Proxy + `Gemini API BYOK`):** 100% offline when **Off**; when enabled, powers Notes Transcript -> Recipe & Summarize, Import AI cleanup, Editor AI Co-Pilot (Auto-Fill, Cleanup, Title, Yield, Storage/Reheat, Undo), and Cook Mode Assistant (Generate New Method Tab including `Toaster Oven`, plus live Recipe Q&A with save-to-card actions).

---

## Ideas Under Consideration (Undecided)

- **AI Step 2 — Pantry & Meal Prep AI Suggestions:** Ask AI *"What can I cook with expiring fridge/pantry items?"* or draft a weekly *"Cook Once, Eat Thrice"* batch plan. *(Discussed during AI rollout planning; no decision yet on whether/when to implement.)*
- **Built-In Default `Mixes` / `Canning` Dividers:** Decide whether fresh starter binders should ship with pre-created `Mixes & Staples` or `Canning & Preserving` divider tabs by default, or rely on `#mix` / `#canning` quick tags + user-created dividers.
- **One-Tap Jar / Batch Logging for Mixes & Canning:** Option inside a Mix or Canning recipe card to log freshly prepared jars/batches directly into Pantry or Meal Prep `Canning Shelf` inventory.
- **Dedicated `Toaster Oven` Pan-Size / Rack Field:** Decide whether to add an explicit pan-size field (e.g., `8x8` / `9x9`) or keep capturing fit notes via `#toaster-oven` + method notes.

---

## On Hold / Deferred

- **AI Auto-Generated Canning Processing Times or PSI:** Excluded from Cook Mode AI method conversion presets for food safety; always record tested NCHFP, USDA, or Ball specifications manually.
- **OCR / Cookbook Photo Scanning (Phase 2):** Paused while URL scraping, `.md`/text import, and YouTube transcript AI extraction cover primary ingestion needs.
- **Household Multi-User Shared Binders (Phase 6):** Deferred while the project remains in `Site Stage: TEST` using single-user per-UID Firestore security rules.
- **Promoting `Site Stage` from `TEST` to `LIVE`:** Held until core features settle and sandbox test data is ready to be separated from production `RecipeBinderDB` / `state_live`.
