# Farnel — design

Date: 2026-11-22 · Status: draft for approval

## 1. Intent

A private meal planner for one household of two people. It plans the week's **lunches** (the main
meal; dinners are usually light and only occasionally planned) within a weekly budget, respecting
one person's hard dietary restriction (gluten) and both people's soft preferences, and it
**remembers**: a dish comes back only after its own minimum interval, and ratings and comments on
past cookings shape future plans.

The planning intelligence is Claude, used through the household's existing Claude Pro subscription:
the app is a remote MCP server that claude.ai connects to as a custom connector. The app owns all
state and every rule that must hold; Claude does the creative part (balancing the week, reading
feedback, proposing new dishes). A web UI covers everything that is not a conversation: history,
ratings, comments, the dish catalogue, validation of new dishes, settings.

It is also a portfolio piece, so it follows the conventions of the existing Cloudflare projects
(`coutada`, `pitchboard`).

## 2. Goals, non-goals, anti-goals

**Goals**
- Plan a week in a claude.ai conversation ("plan next week, we eat out on Thursday").
- Plan by **cooking**, not by day: one cooking yields N portions that cover N meals. Cooking fewer
  times is preferred.
- Never propose a dish inside its repeat interval; never propose a dish that breaks a hard
  restriction. Both are enforced by the server, not by the model.
- Keep the week within a budget using estimated costs.
- Capture per-person ratings (1–5) and comments per cooking, and feed them back into planning.
- Show history, the current plan and a shopping list in a web UI.

**Non-goals (v1)**
- Real supermarket prices (v2: Continente only; see §9).
- Nutrition, calories, macros.
- Step-by-step cooking mode, recipe import from URLs.
- Multiple households, public sign-up, i18n (UI, code and docs are in English).
- A native mobile app (the web UI is responsive; the Claude mobile app uses the same connector).
- Calling the Claude API from the Worker.

**Anti-goals** (a failure even if everything "works")
- A dish containing gluten, or of unknown gluten status, is ever planned.
- The model's memory is the source of truth for what was eaten or when.
- Any running cost beyond the Claude Pro subscription and Cloudflare's free tier.
- The model validating its own new dishes.

## 3. Constraints

- Two users, fixed, known emails.
- Cloudflare free tier: Workers, D1, static assets, Zero Trust (Access, free up to 50 users).
- Claude Pro: custom remote MCP connectors are supported (Customize → Connectors), with custom
  request headers for fixed credentials. claude.ai has no access to the Claude API through the
  subscription, and the subscription's OAuth token must never be used from the Worker (terms).
- Domain: `farnel.migueljfsc.dev` (zone already on the account).
- Match the existing projects' stack and conventions (see §6.1).
- No new dependency without explicit approval (see §6.1 for the ones this design needs).

## 4. Approaches considered

### 4.1 Where the LLM runs
| | Approach | Trade-off |
|---|---|---|
| A | Web app button → Claude API from the Worker | Simplest UX for both people; extra pay-per-use bill and an API key to manage. |
| **B** | **Worker exposes an MCP server; planning happens in claude.ai via a custom connector** | **No extra cost; conversation is a better planning UI; only the person with a Claude account plans.** |
| C | Workers AI (open models) from the Worker | Free; noticeably weaker at juggling hard rules, budget and feedback at once. |
| D | No LLM; deterministic weighted-random planner in the Worker | Free and predictable; no creativity, no new dishes, feedback only as weights. |

**Chosen: B.** The person picked it because it uses the subscription they already pay for at no
extra cost. Deterministic rules (repeat interval, hard restrictions, validated-only) live in the
Worker regardless, so the choice of B does not weaken any guarantee.

### 4.2 Authentication
| | Approach | Trade-off |
|---|---|---|
| **A** | **Cloudflare Access: email OTP for the web UI, a service token for `/mcp`** | **Zero auth code; managed in OpenTofu; a pattern new to the portfolio.** |
| B | Copy coutada's accounts (browser KDF, verified email, sessions, Turnstile, Resend) | Existing pattern; hundreds of lines for two fixed users; the MCP endpoint would still need its own auth. |

**Chosen: A.**

### 4.3 Prices
Real prices (scraping supermarket sites, as PlanMyMeals does) vs. estimated cost per ingredient.
**Chosen for v1: estimates**, with the data model ready for a price source per ingredient (§9).

## 5. Domain

### 5.1 Concepts
- **Person** — one of the two users, identified by the email Access authenticates. Has hard
  restrictions and soft preferences.
- **Restriction** — a named property an ingredient can have (gluten, lactose…), added to or removed
  from a person by name. A person's restriction is either **hard** (never served) or **soft** (a
  preference with a weight). Only restrictions someone has are asked about; removing the last one
  keeps its ingredient decisions for when it comes back.
- **Ingredient** — name, unit (`g`, `ml`, `un`), estimated price per unit, and a per-restriction
  status set by a person: `safe` or `forbidden`, or `unknown` until
  someone decides. `unknown` is a to-do, not a classification: the web UI lists every unknown
  ingredient/restriction pair for manual input, and a dish cannot be validated while any of its
  ingredients is `unknown` for any restriction.
- **Dish** — name, notes (free text: recipe, tips), ingredients with quantities for a stated
  number of portions, tags (`peixe`, `carne`, `vegetariano`, `rápido`, …), **repeat interval in
  days**, and status: `pending` (proposed by Claude, not yet reviewed), `validated`, `archived`.
- **Plan** — one per week (week starts Monday). Holds a budget snapshot, notes, and cookings.
- **Cooking** — one dish cooked once: cook date, portions, the meals it covers, estimated cost,
  status `planned` · `skipped` · `replaced` (with the replacing dish). `done` is derived, not
  stored: a `planned` cooking whose cook date is before today.
- **Meal** — a date and a slot (`lunch` | `dinner`) covered by a cooking.
- **Feedback** — per person per cooking: rating 1–5 and an optional comment.

**Portions.** A portion is one person's serving. A plan records who eats it (everyone unless chosen
otherwise when planning); every meal of the plan consumes one portion per eater, so a cooking must
cover `meals × eaters ≤ portions`. Scaling a dish to a cooking scales its ingredient quantities linearly.

**Time.** All dates are calendar dates in `Europe/Lisbon`; a week starts on Monday. "Past" means
before today in that zone.

**Repeat interval** is per dish only. Variety across categories (e.g. not three fish dishes in a
week) is left to Claude through tags and soft preferences.

### 5.2 Rules (server-enforced)
1. **Eligible dish** for a week starting `W`:
   - status `validated`, and
   - for every hard restriction of *any person eating the plan*, every ingredient of the dish is
     `safe` for it (a `forbidden` or `unknown` ingredient excludes the dish), and
   - one portion holds at least the household's minimum raw protein (rule 8), and
   - `last_cooked(dish)` is null, or `last_cooked + repeat_interval_days <= first cook date in the
     proposed plan` — where `last_cooked` is the latest cook date among cookings of that dish
     with status `planned` or `done` (skipped and replaced cookings do not count), excluding the
     plan being replaced.
2. A dish appears **at most once per plan**. One cooking covering several meals counts once.
3. `save_plan` re-checks rule 1 for every cooking and **rejects the whole plan** with a per-dish
   reason if any check fails. The model cannot bypass it.
4. The history is what was **eaten**: a cooking whose date has passed counts as `done` unless a
   person marks it `skipped` or `replaced` in the web UI. A replacement is either a catalogue
   dish (which then counts towards that dish's repeat interval) or free text (which does not).
5. Only a person, in the web UI, can move a dish from `pending` to `validated`, set an
   ingredient's restriction status, or change a person's restrictions. No MCP tool can.
6. A new ingredient created through MCP starts with every restriction status `unknown`. Adding a
   new restriction later sets it to `unknown` on every existing ingredient; validated dishes
   stay validated, but any dish with an `unknown` ingredient for a hard restriction is excluded
   by rule 1 until a person decides.
7. For a soft restriction, a `forbidden` ingredient does not exclude the dish; `list_candidates`
   reports it so Claude can weigh it.
8. **Protein per portion** is the sum of `quantity × protein_grams` over a dish's ingredients,
   divided by its portions, and must reach `settings.min_protein_grams` (200 g to start).
   `protein_grams` is the raw protein weight in 1 g, 1 ml or 1 un of an ingredient (1 for meat
   weighed in grams, about 60 for an egg); null means not a protein and counts as nothing. A
   person sets it in the web UI; Claude may give it for an ingredient it creates. Validating a
   dish does not check it; planning does.

### 5.3 Cost
- Dish cost per portion = Σ(quantity × ingredient price per unit) ÷ dish portions.
- Cooking cost = cost per portion × portions. Plan cost = Σ cooking costs.
- Prices are estimates in v1, marked `estimated` with a `price_updated_at`; Claude may suggest a
  price when it creates an ingredient, and people correct it in the web UI.
- The budget is a weekly amount in settings; `save_plan` stores the plan's total and flags (does
  not reject) a plan over budget. The model is told to stay within it.

## 6. Architecture

### 6.1 Stack (matches coutada)
pnpm 11, Node ≥ 22.12, TypeScript strict, React 19, Vite 8, Tailwind v4, zod, Vitest in two
projects (`app` on node, `worker` on workerd via `@cloudflare/vitest-plugin`), ESLint, pre-commit,
commitizen, OpenTofu, GitHub Actions.

**New dependencies needing approval:** `agents` (for `createMcpHandler` from `agents/mcp/server`)
and `@modelcontextprotocol/server` at the exact version that `agents` release requires; `jose`
for Access JWT validation (§7).

### 6.2 One Worker
```
farnel.migueljfsc.dev
├── /*        static SPA from dist/ (free, not metered)
├── /api/*    JSON API for the web UI          (run_worker_first)
└── /mcp      stateless MCP server, Streamable HTTP (run_worker_first)
```
- `wrangler.jsonc`: `assets` with `not_found_handling: "single-page-application"` and
  `run_worker_first: ["/api/*", "/mcp"]`, custom domain route, `workers_dev: false`, one D1 binding,
  `observability` on. No Durable Objects, no KV.
- The MCP server is built per request by a factory passed to `createMcpHandler` (stateless; no
  session, no Durable Object). Tools read and write D1.
- Shared domain logic (eligibility, cost, plan validation) lives in one module used by both the
  API and the MCP tools, so the web UI and Claude see the same rules.

### 6.3 MCP tools
All tool outputs are compact JSON plus a one-line human summary. Dates are ISO `YYYY-MM-DD`,
money in integer cents.

| Tool | Purpose |
|---|---|
| `get_context` | Settings (weekly budget, default lunches per week), people with hard restrictions (names only) and soft preferences (text + weighted tags), today's date, the current and next week's plan status. |
| `list_candidates(week_start, tags?)` | Eligible dishes (rule 1) with last cooked date, repeat interval, cost per portion, portions, tags, average rating per person, and the latest few comments. |
| `get_dish(id)` | Full dish incl. ingredients, notes and full feedback history. |
| `get_history(from, to)` | Cookings in range with status and feedback. |
| `save_plan(week_start, cookings[], notes?)` | `cookings[] = {dish_id, cook_date, portions, meals: [{date, slot}]}`. Validates (§5.2), computes costs, replaces that week's existing plan **only if none of its cookings is in the past**, returns the saved plan or the rejection reasons. |
| `add_dish(name, portions, ingredients[], tags[], repeat_interval_days, notes?)` | Creates a `pending` dish. Ingredients match existing ones by normalised name; unmatched ones are created with `unknown` restriction status and an optional suggested price. Returns the dish and which ingredients need review. |
| `get_shopping_list(week_start)` | Aggregated ingredient quantities and estimated cost for the week's planned cookings. |

The server's MCP `instructions` describe the planning contract: plan lunches by cooking with
multiple portions where sensible, stay within budget, use feedback, never propose a dish outside
`list_candidates` for saving (new ideas go through `add_dish` and wait for validation), and reply
in the language the person writes in.

### 6.4 Web UI (English, mobile-first)
- **Week** — this week's (and next week's) plan by day, each meal linking to its cooking; mark a
  cooking `skipped` or `replaced` (pick the dish); the shopping list with estimated total vs. budget.
- **History** — past cookings, newest first; per-person stars and comment, editable inline.
- **Dishes** — catalogue with filters (tag, status, eligible now); dish editor (ingredients,
  quantities, portions, repeat interval, tags, notes); a **To validate** queue where a person
  reviews a pending dish and its new ingredients' restriction status before validating.
- **Ingredients** — name, unit, price, and a *safe* / *forbidden* choice per restriction; a
  **To decide** list of every `unknown` pair, shown as a count in the navigation.
- **Settings** — weekly budget, default lunches per week, each person's hard restrictions and
  soft preferences.

Sketch — History:
```
History                              [Week] [Dishes]
─────────────────────────────────────────────────
Mon 17/11  Bacalhau à Brás (2 portions)  A ★★★★☆  B ★★★☆☆  "not enough potato"
Tue 18/11  ↳ same cooking
Wed 19/11  Chickpea curry (3 portions)   A ★★★★★  B ★★★★★
Fri 21/11  (skipped)
```

### 6.5 Data (D1)
Tables, in outline (the builder owns exact columns and indexes):
`people`, `restrictions`, `person_restrictions (person, restriction, kind hard|soft, weight)`,
`person_preferences (person, text)`, `ingredients`, `ingredient_restrictions (ingredient,
restriction, status)`, `dishes`, `dish_ingredients`, `dish_tags`, `plans`, `cookings`, `meals`,
`feedback (cooking, person, rating, comment, updated_at; unique per cooking+person)`, `settings`
(single row). Migrations in `worker/migrations`, applied by CI before deploy. The migration seeds
the `gluten` restriction and the settings row. The two people (emails) are **not** committed: they
are inserted once with `wrangler d1 execute` (README), and gluten is then set as one person's hard
restriction in Settings.

**Cold start.** The catalogue starts empty. The first session is "propose 15 dishes": Claude
calls `add_dish` for each, they land in **To validate**, and planning works once enough are
validated. No bulk import in v1.

## 7. Security

- **Two Access applications on one hostname.** Access matches the most specific path:
  - `farnel.migueljfsc.dev` — Allow policy, the two emails, one-time PIN login.
  - `farnel.migueljfsc.dev/mcp` — the same people policy, with Access **managed OAuth** on, so
    claude.ai signs in through Access (dynamic client registration, claude.ai's callback allowed);
    plus a Service Auth policy with one service token for non-interactive clients. Strict service
    token authentication should be on (returns 401/403 instead of redirecting); it is an
    organisation-wide setting, so it is a one-time manual toggle, not part of this stack.
- The claude.ai connector is added by URL only; claude.ai does not use a connector whose only
  credential is fixed request headers once its OAuth probe fails.
- **The Worker checks Access too**, not only the edge: every `/api/*` and `/mcp` request must carry
  a `Cf-Access-Jwt-Assertion` that verifies (RS256, the team's JWKS, issuer = team domain,
  audience = the AUD of the application that path belongs to). `ctx.access` cannot be used: it is
  not passed to Workers that serve static assets. `/api/*` also requires the JWT's email to be one
  of the two people (that email is the acting person for feedback).
- Local development sets `DEV_ACCESS_EMAIL` in `.dev.vars`; it is honoured only when the request's
  hostname is `localhost` or `127.0.0.1`, and never set in production.
- The two emails live outside the repository: a GitHub secret feeds the OpenTofu Access policy,
  and the `people` rows are inserted by hand.
- The MCP tool surface cannot validate dishes, change restrictions, or delete anything (§5.2 r5).
- Every response carries the same security headers as coutada (`secured`, CSP, `_headers`).
  JSON bodies are read through a size-capped, content-type-checked reader.
- **Risks, accepted:** the service token grants full MCP access to whoever holds it; it lives in
  the connector settings of one Claude account and in OpenTofu state (private R2 bucket). Rotation
  is manual (new token in OpenTofu, update the connector). The data is not sensitive beyond
  household meal habits and two emails.

## 8. Infrastructure and delivery

Same split as coutada:
- **OpenTofu** (state in the shared R2 bucket, key `farnel/cloudflare/terraform.tfstate`) owns
  the D1 database, both Access applications and policies, and the service token (client secret
  as a sensitive output).
- **wrangler** owns the deploy, the route, the bindings and the schema. No
  `cloudflare_workers_script` in OpenTofu.
- **GitHub Actions**: `ci` (lint, typecheck, test), `deploy-worker` on push to `main` (migrations
  then deploy), `terraform` for the stack. Repo on the personal account (`migueljfsc`), created by
  the owner.

**The name is provisional.** `farnel` appears only where a name is unavoidable, and the README
lists every one of those places: `package.json` `name`, `wrangler.jsonc` `name` and route, the D1
database name, OpenTofu `locals` (D1, Access application names, hostname) and the backend state
key, the GitHub environment URL, and one `APP_NAME` constant the UI reads for its title. Source
code, tables, cookies and storage keys never embed it.

## 9. Later (v2), designed for but not built
- **Continente prices**: a daily Cron Trigger fetches prices for ingredients mapped to a Continente
  product; `ingredients` gains `price_source`, `external_ref`, `price_updated_at` (the last can
  exist from v1). Only ingredients in the catalogue, only one store. Fetching retail sites carries
  terms-of-use risk; acceptable at household scale, to be revisited before building.
- Lidl, Pingo Doce, Mercadona: not planned.

## 10. Left to the builder
- Exact schema, indexes, migration split, and API routes for the web UI.
- Component structure, routing library choice within the existing stack, visual design.
- MCP tool input schemas (zod) and response shapes beyond §6.3.
- Name normalisation for ingredient matching.
- Test strategy beyond: eligibility rules, `save_plan` rejection paths, `unknown` blocking both
  validation and eligibility, past-cooking protection, and Access checks each need a test.
