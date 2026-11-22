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
