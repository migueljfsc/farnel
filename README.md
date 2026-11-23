# Farnel

A household lunch planner. Claude plans the week through an MCP connector in claude.ai; a web app
holds the history, ratings, comments, the dish catalogue and the settings. The rules that must
hold (repeat intervals, hard dietary restrictions, validated dishes only) are enforced by the
server, not by the model.

Design: [`docs/superpowers/specs/2026-11-22-farnel-design.md`](docs/superpowers/specs/2026-11-22-farnel-design.md).

## Run locally

```sh
pnpm install
cp .dev.vars.example .dev.vars        # DEV_ACCESS_EMAIL: who you are signed in as locally
pnpm exec wrangler d1 migrations apply farnel-prod --local
pnpm exec wrangler d1 execute farnel-prod --local --command "INSERT INTO people(email, name) VALUES ('you@example.com', 'You')"

pnpm dev:worker                       # terminal 1: the Worker on :8787
pnpm dev                              # terminal 2: the UI on http://localhost:5173
```

The MCP server is at `http://localhost:8787/mcp`; locally it accepts any request, because
`DEV_ACCESS_EMAIL` is honoured only on `localhost`.

```sh
pnpm test                             # vitest: app in node, Worker in workerd
pnpm lint && pnpm typecheck && pnpm build
pre-commit install                    # hooks; commits are Conventional (`cz commit`)
```

Node >= 22.12, pnpm 11.

## Planning

On the Week page, **Plan with Claude** builds the prompt for the week (plus any notes) and opens it
in the Claude app (`claude://` deep link) or claude.ai, where the Farnel connector saves the plan;
**Refresh** shows it. Locally, claude.ai cannot reach `localhost`: use **Copy prompt** and paste it
into Claude Code connected to the local server (below).

## Languages

The UI speaks English and European Portuguese (the EN/PT button in the navigation; the first visit
follows the browser). Copy lives in `src/i18n/`: `en.ts` declares every key, `pt.ts` must answer
each one (a missing key does not compile), and `i18n.test.ts` checks placeholders and plurals.
The "Plan with Claude" prompt is written in the chosen language, so Claude replies in it.

## Renaming

`farnel` appears only in these places:

- `package.json` `name`
- `wrangler.jsonc` `name`, route and D1 `database_name`
- `infrastructure/terraform/cloudflare/variables.tf` `project_name` default, and `backend.tf` state key
- `.github/workflows/deploy-worker.yml` environment URL and D1 migrations command
- `shared/app.ts` `APP_NAME` (in-app wordmark and MCP server name)
- `index.html` `<title>` and `apple-mobile-web-app-title`, and `public/manifest.webmanifest` `name` / `short_name`
- this README's commands

## Go live

Every push to `main` applies the stack (when it changes) and deploys the Worker. Once, the first time:

1. **Zero Trust** (dashboard): the organisation has a team domain; *One-time PIN* is enabled as a
   login method; *Settings → Access → Strict service token authentication* is on.
2. **First apply**: the `terraform` workflow applies on push and prints the outputs in its
   "Outputs" step. To apply locally instead (from `infrastructure/terraform/cloudflare`):

   ```sh
   export CLOUDFLARE_API_TOKEN=…            # D1 Edit, Access: Apps and Policies Edit, Access: Service Tokens Edit
   export TF_VAR_cloudflare_account_id=…
   export TF_VAR_access_emails='["you@example.com","them@example.com"]'
   export AWS_ENDPOINT_URL_S3="https://<ACCOUNT_ID>.r2.cloudflarestorage.com" AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…
   tofu init && tofu apply -var-file=contexts/prod.tfvars
   ```

3. **Wire the Worker**: paste `tofu output d1_database_id` into `wrangler.jsonc`'s D1 binding, and
   `tofu output access_aud_web`, `access_aud_mcp` and `https://<team>.cloudflareaccess.com` into its
   `vars`. Commit.
4. **GitHub**: secrets `CLOUDFLARE_API_TOKEN` (plus Workers Scripts Edit), `CLOUDFLARE_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `ACCESS_EMAILS`; environment `cloudflare-production`.
5. **Deploy**: push to `main` (or run `deploy-worker`), then add the people:

   ```sh
   pnpm exec wrangler d1 execute farnel-prod --remote --command "INSERT INTO people(email, name) VALUES ('you@example.com', 'You'), ('them@example.com', 'Them')"
   ```

6. **Sign in** at `https://farnel.migueljfsc.dev`; in Settings, mark gluten as hard for the right person.
7. **Connect Claude**: claude.ai → Plugins → Add → **Add custom connector**, URL
   `https://farnel.migueljfsc.dev/mcp`, no headers. **Connect** opens the Access login (your email
   and a one-time PIN); Access's managed OAuth gives claude.ai a token and forwards your identity to
   the Worker.
8. **Check**: without signing in, `/api/me` redirects to the Access login and `/mcp` answers 401 with
   a `WWW-Authenticate` header pointing at Access's OAuth metadata.
9. **First conversation**: "propose 15 dishes" → validate them in the web app → "plan next week".

## Connect Claude to the local server

claude.ai cannot reach `localhost`. To try the tools locally, use Claude Code:
`claude mcp add --transport http farnel http://localhost:8787/mcp`.
