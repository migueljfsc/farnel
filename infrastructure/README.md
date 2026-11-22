# Infrastructure

One stack: [`terraform/cloudflare/`](terraform/cloudflare/) owns the D1 database (jurisdiction
`eu`), the two Cloudflare Access applications (web app and `/mcp`), their policies, and the
service token claude.ai uses. It is applied by `.github/workflows/terraform.yml` on push to
`main`.

## Outside the stack

- **The Worker script**, deployed by wrangler (`.github/workflows/deploy-worker.yml`): a Worker
  with static assets is uploaded in steps that end in a short-lived completion token, which
  OpenTofu cannot hold.
- **Zero Trust organisation settings** (team domain, One-time PIN login, strict service token
  authentication): they are account-wide and shared with other projects.
- **The CI API token**, made by hand in the dashboard: a stack that owns its own credential can
  revoke itself mid-apply.
- **The emails** in the Access policy: `TF_VAR_access_emails` (locally) or the `ACCESS_EMAILS`
  secret (CI).

## First apply

See the README's "Go live" section.
