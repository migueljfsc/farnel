# Farnel brand and UI revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Give Farnel the "lata de conserva" brand and restyle every page with it, with a side-rail navigation and a spreadsheet ingredients table.

**Architecture:** Swap the colour tokens and fonts in `src/index.css`, rename token classes across `src/`, restyle the shared primitives (`styles.ts`, `ui.tsx`) so most pages change at once, then rework the shell, the week board, the ingredients table and the remaining pages. One small worker change: cookings carry their dish's tags so tins can take the protein colour.

**Tech Stack:** React 19, Tailwind v4 (`light-dark()` tokens), Vite, Vitest (app + worker projects).

**Spec:** `docs/superpowers/specs/2026-11-24-farnel-brand-design.md`

## Global Constraints
- Tokens (light / dark): papel `#fbfaf7`/`#232c2a`, raised `#ffffff`/`#2b3532`, tinta `#17201e`/`#ece6da`, tinta-soft `#55605d`/`#b3bbb6`, linha = tinta at 14%, mar `#0f5257`/`#8fcfc8`, mar-soft `#dcebea`/`#2f4a47`, tomate `#d2452c`, tomate-soft `#f8e1db`/`#4a2a24`, mostarda `#e8b23a`, atlantico `#234e70`, polvo `#6d3a5c`.
- Fonts self-hosted in `public/fonts` with OFL files: Abril Fatface (wordmark only), Big Shoulders Display 800–900 (titles, tin names, uppercase), Public Sans (everything else). Bricolage removed.
- Teal only on page/section titles, active nav, primary buttons, links. Corners 3px. No pills, no floating cards, no "·"-joined strings.
- Behaviour unchanged except navigation (Ingredientes top-level, review only with a count) and the ingredients table. All existing tests pass.

## Review Focus
- Dark mode: every token has a dark value and contrast holds on raised surfaces and tins.
- Phone width (375px): rail hidden, bottom bar usable, ingredients table scrolls horizontally inside itself, no page-level horizontal scroll.
- Ingredients: clicking a row to edit must not lose staged drafts of other rows; discard and save still work; filters/search never hide a row with unsaved changes silently (the save bar count stays right).
- Keyboard: rail, bottom bar, row-to-edit and filters reachable and visibly focused.
- Tins for dishes without a protein tag still render (ink grey).

---

### Task 1: Fonts, tokens and shared primitives
**Files:** `public/fonts/*`, `src/index.css`, all of `src/**` (token rename), `src/components/styles.ts`, `src/components/ui.tsx`, `index.html`.
- [x] Download woff2 (latin + latin-ext) for the three families from Google Fonts into `public/fonts`, add their OFL texts, remove Bricolage files.
- [x] Rewrite `src/index.css`: `@font-face` rules, tokens above, `@theme inline` mapping (`--color-papel` …, `--font-sans: "Public Sans"`, `--font-display: "Big Shoulders Display"`, `--font-brand: "Abril Fatface"`), `.display` = Big Shoulders 900 uppercase, select chevron stays.
- [x] Rename classes across `src/`: `aveia`→`papel`, `louca`→`raised`, `cafe`→`tinta`, `salva`→`mar`, `rosa`→`tomate`.
- [x] `styles.ts`: buttons 3px corners (primary mar, secondary 1.5px ink outline, danger tomate outline); inputs 3px, raised background; `TONES` square marks.
- [x] `ui.tsx`: `Page` title in `.display text-mar`, a 2px ink rule under the page head; `Card` = section with ink rule top, no rounded box; `List`/`Row` = hairline-divided rows on paper; `Badge` = 2px-corner outlined mark.
- [x] Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all pass; screenshot Week and Dishes.
- [x] Commit `feat(ui): farnel brand tokens, fonts and primitives`.

### Task 2: Brand assets
**Files:** `public/icon.svg`, `public/icons/*.png`, `public/favicon.ico`, `public/manifest.webmanifest`, `index.html`.
- [x] Icon per spec (teal square, white tin, mustard label, F drawn as a path, ring-pull); render with `qlmanage -t -s 512`, resize with `sips` to 192 and 180; favicon from a 64px F-only render.
- [x] Manifest and `theme-color`: `#0f5257` light, `#232c2a` dark; background `#fbfaf7`.
- [x] Commit `feat(brand): sardine-tin icon and favicon`.

### Task 3: Navigation (M2)
**Files:** `src/App.tsx`, `src/components/icons.tsx`, `src/components/ui.tsx` (drop `CatalogueTabs`), `src/pages/Dishes.tsx`, `src/pages/Ingredients.tsx`, `src/components/ThemeSwitch.tsx`, `src/components/LocaleSwitch.tsx`, i18n.
- [x] Desktop rail (`sm:`): wordmark (`font-brand`), Semana, Pratos, Ingredientes, Histórico, "A rever" + mustard count only when > 0; foot: Definições, theme segmented (Claro/Auto/Escuro), language segmented (PT/EN), name.
- [x] Phone: top strip (wordmark, review count link when > 0, settings icon) and bottom bar of four with a teal top marker on the active one.
- [x] Icons: add `ingredients`; restyle set to 2px strokes.
- [x] Verify at 1280px and 375px, light and dark; commit `feat(ui): side rail and bottom bar navigation`.

### Task 4: Tins on the week board
**Files:** `shared/types.ts` (`CookingView.tags: string[]`), `worker/lib/service/planning.ts`, `worker/lib/service/planning.test.ts`, `src/lib/tins.ts` + test, `src/pages/Week.tsx`, `src/components/AddMeal.tsx`, `src/components/Sheet.tsx`, `src/components/WeekCalendar.tsx`.
- [x] Test first: `getPlan` cookings include the dish's tags. Implement.
- [x] Test first: `tinTone(tags: string[]): "carne" | "peixe" | "marisco" | "ovos" | "vegetariano" | "none"` picks the first protein tag. Implement.
- [x] Week: tins in the tone's colour with an inner hairline frame, condensed uppercase name, italic portions; free slots dashed with teal "+"; today's day label in mustard; budget as condensed figures with a thin bar. Sheets and calendar: square corners, ink rules.
- [x] Commit `feat(ui): week board as tin labels`.

### Task 5: Ingredients spreadsheet (T1)
**Files:** `src/lib/ingredient-table.ts` + test, `src/pages/Ingredients.tsx`, i18n.
- [x] Test first: `groupByAisle(ingredients): { aisle; items }[]` in `AISLES` order, empty aisles dropped; `matches(ingredient, view, { query, filter }, restrictions)` for `all | undecided | protein | noPrice` and accent-insensitive name search.
- [x] Table: aisle group headings (teal condensed, count), columns Ingrediente, Preço, Proteína, one per restriction in use (– / ✕ tomate / ? mostarda, clickable to cycle when editing), selection checkbox column. Row reads as text; click (or Enter) on a row enters edit mode for that row, showing aisle/price/protein fields; drafts and the save bar as today.
- [x] Toolbar: search box and the four filters; rows with drafts always shown.
- [x] Commit `feat(ui): ingredients as a spreadsheet grouped by aisle`.

### Task 6: Remaining pages and copy
**Files:** `src/pages/{Dishes,DishEditor,Review,History,Settings}.tsx`, `src/components/{SaveBar,SelectionBar,toast,TagPicker,IngredientPicker,NewIngredientForm,ContainsPicker}.tsx`, `src/i18n/{en,pt}.ts`.
- [x] Dishes: protein-colour strip per row (via `tinTone`), plain meta, outlined tag marks, tomato warnings.
- [x] Save bar: ink background, mustard Save, outlined Discard (inverted in dark). Toasts and selection bar square, ink.
- [x] Remaining `rounded-full` pills → 3px marks; section titles via `.display text-mar`.
- [x] Replace "·" joins in en/pt strings with commas.
- [x] Commit `feat(ui): restyle remaining pages`.

### Task 7: Verify and ship
- [x] Full checks; screenshots of every page at 1280px and 375px in light and dark; fix what looks off.
- [x] `pre-commit run --all-files`, push to main, watch deploy-worker.
