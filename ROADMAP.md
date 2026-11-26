# Recipe Binder — Product Roadmap

Grounded in `zed/recipe-binder-roadmap.md` ("The Modern Digital Kitchen Binder"): tactile, distraction-free, offline-first, and designed for active cooking across desktop, phone, and kitchen tablet.

---

## Phase 1: Core Recipe Cards, Dividers & Cross-Device Sync *(Implemented)*

- [x] Tactile **Binder Divider Tabs** (`Weeknight Staples`, `Baking`, `Breakfast`, `Sides & Salads`, `Holiday Classics`, plus custom add/rename/reorder/delete).
- [x] **Multi-Tagging & Instant Filtering** (`#30-mins`, `#dairy-free`, `#gluten-free`, search across titles/ingredients/steps/notes, Favorites toggle, sorting).
- [x] **Open-Binder Detail View** (desktop/landscape split ingredients + steps spread, checkable ingredient & step items, Cook's Margin Notes, `A-` / `A` / `A+` text scaling, Warm Parchment / Slate / Dusk themes).
- [x] **Dynamic Recipe Scaling** (`0.5x`, `1x`, `2x`, `3x` with fraction-aware ingredient line scaling).
- [x] **Active Kitchen UX Basics** (Screen Wake Lock `Keep Awake` toggle, `@media print` printable binder card layout).
- [x] **Cross-Device Availability & Offline-First Persistence** (Dexie IndexedDB `RecipeBinderDB_Test` / `RecipeBinderDB`, installable VitePWA Workbox shell, LAN Wi-Fi dev/preview scripts, GitHub Pages CI workflow, optional Firebase Auth + Cloud Firestore per-recipe real-time sync, lossless JSON export/merge/replace backup).

---

## Phase 2: Enhanced Core Recipe Management

- [x] **Volume <-> Weight Unit Converter:** One-tap toggle between Volume (`cups`/`tbsp`) and Weight (`grams`/`oz`) for baking ingredients.
- [ ] **Recipe Version History:** Preserve previous snapshots when tweaking a recipe over time so cooks can compare or revert.
- [ ] **Frictionless Import Engine:**
  - Web URL clipper stripping blog filler into clean ingredients and steps.
  - OCR / Photo Scan for index cards and cookbook pages while keeping the original photo attached.

---

## Phase 3: Active Cook Mode & Inline Timers

- [ ] **Inline Step Timers:** Automatically detect durations in steps (e.g., `"simmer for 15 minutes"`) so tapping spawns a labeled pinned countdown timer.
- [ ] **Hands-Free Step Navigation:** Voice commands or oversized next/prev step mode for flour-covered hands.
- [ ] **"Cooked It" Log:** Track when each dish was last made and surface recent kitchen history.

---

## Phase 4: Cooking Techniques & Reference Guide (The "Front Pocket") *(Implemented)*

- [x] **Interactive Reference Charts:** Internal meat temperatures, grain-to-water ratios, oil smoke points, and common ingredient substitutions.
- [x] **Technique Cards & In-Recipe Linking:** Short step-by-step reference cards (e.g., *Making a Roux*, *Velveting Chicken*) linked from highlighted keywords inside instructions.
- [x] **Flavor Pairing Wheel:** Built-in improvising guide when missing an herb or spice.

---

## Phase 5: Batch Cooking & Meal Prep Engine

- [x] **"Cook Once, Eat Thrice" Templates:** Link a batch base (e.g., pulled pork) to derivative weeknight recipes.
- [x] **Merged Prep Timelines:** Combine multiple selected recipes into one chronological prep checklist.
- [x] **Freezer & Leftover Inventory:** "Send to Freezer" portion/date tracker with reheating notes.

---

## Phase 6: Dynamic Pantry & Grocery Ecosystem

- [ ] **Smart Grocery List Aggregation:** Merge duplicate ingredients across planned recipes and group by grocery aisle.
- [ ] **Virtual Pantry & "Always Stocked" Staples:** Track staples and filter the binder by *"What Can I Make?"* with ingredients on hand.
- [ ] **Household Shared Binders:** Multi-user shared binder & live grocery checklist collaboration.
