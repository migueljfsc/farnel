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

## Renaming

`farnel` appears only in these places:

- `package.json` `name`
- `wrangler.jsonc` `name`, route and D1 `database_name`
- `infrastructure/terraform/cloudflare/variables.tf` `project_name` default, and `backend.tf` state key
- `.github/workflows/deploy-worker.yml` environment URL and D1 migrations command
- `shared/app.ts` `APP_NAME` (page title and MCP server name)
- this README's commands

## Go live

Everything below runs once; afterwards CI applies the stack and deploys on every push to `main`.

1. **Zero Trust** (dashboard): the organisation has a team domain; *One-time PIN* is enabled as a
   login method; *Settings → Access → Strict service token authentication* is on.
2. **First apply** (locally, from `infrastructure/terraform/cloudflare`):

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
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `ACCESS_EMAILS`; environment `cloudflare-production`;
   repository variable `DEPLOY_ENABLED=true`.
5. **Deploy**: push to `main` (or run `deploy-worker`), then add the people:

   ```sh
   pnpm exec wrangler d1 execute farnel-prod --remote --command "INSERT INTO people(email, name) VALUES ('you@example.com', 'You'), ('them@example.com', 'Them')"
   ```

6. **Sign in** at `https://farnel.migueljfsc.dev`; in Settings, mark gluten as hard for the right person.
7. **Connect Claude**: claude.ai → Customize → Connectors → add a custom connector with URL
   `https://farnel.migueljfsc.dev/mcp` and request headers `CF-Access-Client-Id` /
   `CF-Access-Client-Secret` from `tofu output -raw mcp_client_id` / `tofu output -raw mcp_client_secret`.
8. **Check**: without signing in, `/api/me` redirects or answers 401; `/mcp` without the headers
   answers 401/403, and with them `initialize` answers 200.
9. **First conversation**: "propose 15 dishes" → validate them in the web app → "plan next week".

## Connect Claude to the local server

claude.ai cannot reach `localhost`. To try the tools locally, use Claude Code:
`claude mcp add --transport http farnel http://localhost:8787/mcp`.
