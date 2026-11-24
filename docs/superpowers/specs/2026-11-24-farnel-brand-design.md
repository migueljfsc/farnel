# Farnel brand and UI revamp

## Intent
The UI reads as generic AI output: cream background, one accent, rounded cards with the same
shadow everywhere, pills, "·"-joined meta. Farnel gets an identity of its own, taken from the
thing it is named after (the packed lunch you carry) and from Portuguese tinned-fish labels, and
every page is redone with it. Mockups: `.superpowers/brainstorm/76483-1795552326/content/`
(`directions.html`, `brand-a.html`, `brand-a-v2.html`).

## Goals, non-goals, anti-goals
- Goals: a recognisable brand (wordmark, icon, palette, type, voice); every page restyled; a new
  navigation; a new ingredients table; a lighter dark mode.
- Non-goals: new features, data or API changes; changing what any page does, except where the
  navigation and the ingredients table say so below.
- Anti-goals: kitsch (labels, frames and ornament spreading past the tins and the wordmark);
  teal on everything; losing legibility for decoration.

## Approaches considered
- **A. Lata de conserva** (picked): tinned-fish labels. Tied to the name and to the cooking-as-a-tin
  idea the app already has; keeps a green.
- B. Quadro da tasca: chalk menu board. Handwritten faces are a cliché and dark boards read worse.
- C. Placa de rua: tile plaques. Least about food, drops the green, can feel touristy.
- Navigation: **M2 side rail** (picked) over M1 top band with a user menu.
- Ingredients: **T1 spreadsheet** (picked) over T2 list with an editor panel.

## Brand
- **Wordmark**: "Farnel" in Abril Fatface, only for the name (rail, sign-in, icon). Never headings.
- **Icon**: teal rounded square, a paper-white sardine tin with a mustard label, an Abril "F" and a
  ring-pull. Favicon: the mustard F on teal. Regenerate `public/icon.svg`, `icons/*.png`,
  `favicon.ico`, manifest and `theme-color`.
- **Type**: Big Shoulders Display 800–900, uppercase, for page and section titles and tin dish
  names; Public Sans for everything else (body, labels, buttons, tables), sentence case.
- **Colour tokens** (light / dark):
  - `papel` page `#fbfaf7` / `#232c2a`; `raised` fields, menus `#ffffff` / `#2b3532`
  - `tinta` ink `#17201e` / `#ece6da`; `tinta-soft` `#55605d` / `#b3bbb6`; `linha` rules: ink at ~14%
  - `mar` brand teal `#0f5257` / `#8fcfc8`; `mar-soft` `#dcebea` / `#2f4a47`
  - `tomate` `#d2452c`, soft `#f8e1db` / `#4a2a24`; `mostarda` `#e8b23a`
  - Tin colours, the same in both modes: carne `tomate`, peixe `#234e70` (atlântico), marisco
    `#6d3a5c` (tinta de polvo), ovos `mostarda` (ink text), vegetariano `#0f5257`; a dish without
    a protein tag is ink grey.
- **Rules**:
  - Teal only on: page titles, section titles, the active navigation item, primary buttons, links.
  - Tins are the one loud element. Lists, tables and forms are ink on paper.
  - Corners 3px (2px for small marks). No pills, no floating cards: pages are divided by ink rules
    (2px under page heads and table heads, 1px hairlines between rows).
  - Tomato only means "look at this": forbidden, over budget, too little protein, delete.
  - Mustard: today, counts waiting for review, the save bar's Save, egg tins.
  - No "·"-joined meta strings; commas or separate cells.
  - Copy: plain and short in both languages ("Faltam proteínas").

## Navigation (M2)
- Desktop (`sm` and up): a teal rail on the left: wordmark; Semana, Pratos, Ingredientes,
  Histórico; "A rever" with a mustard count, shown only when something waits. Rail foot:
  Definições, theme (Claro / Auto / Escuro), language (PT / EN), the signed-in name.
- Ingredientes becomes a top-level destination; the Pratos/Ingredientes tab switch goes away.
- Phone: a bottom bar with Semana, Pratos, Ingredientes, Histórico (icons + labels, active with a
  teal top bar); a top strip with the wordmark, the mustard review count and a settings button.

## Pages
- **Semana**: the board as tin labels (protein colour, inner hairline frame, condensed dish name,
  portions in italic), leftovers span their days, today's day label in mustard, free meals as
  dashed slots with a teal "+". Budget as condensed figures with a thin bar. Tin detail and the
  add-meal sheet follow the brand (square corners, ink rules).
- **Pratos**: rows with a protein-colour strip on the left, name, meta in plain text, tags as
  small outlined marks, warnings (low protein, missing prices) in tomato.
- **Ingredientes (T1)**: a table grouped by aisle (aisle as a teal condensed group heading with
  a count), columns Ingrediente, Preço, Proteína, then one narrow column per restriction in use
  (– safe, ✕ contains in tomato, ? undecided in mustard). Rows read as text; clicking a row turns
  its cells into fields. Changes collect in the save bar as today. Search box and filters:
  Todos, Por decidir, Proteínas, Sem preço. Selection checkboxes and bulk delete stay.
- **Dish editor, Review, History, Settings**: same rules: condensed teal section titles, ink
  rules instead of cards, square fields and buttons.
- **Save bar**: ink background, mustard Save, outlined Discard; in dark mode inverted.

## Constraints
- Fonts self-hosted in `public/fonts` like Bricolage today (OFL licences alongside); Bricolage
  removed.
- Tailwind v4 tokens via `light-dark()` as today; class names follow the new token names.
- Existing tests keep passing; behaviour unchanged apart from navigation and the table.

## Left to the builder
- Exact spacing scale, icon drawings (simple stroked set), focus styles (visible, teal), motion
  (keep the one tin-drop moment, nothing else animates on its own).
