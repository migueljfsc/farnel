# Two Access applications on one hostname; Access applies the most specific path.
# The web app signs people in by email; /mcp accepts only the service token claude.ai sends.

resource "cloudflare_zero_trust_access_service_token" "mcp" {
  account_id = var.cloudflare_account_id
  name       = "${local.name_prefix}-mcp"
  duration   = var.service_token_duration
}

resource "cloudflare_zero_trust_access_policy" "people" {
  account_id = var.cloudflare_account_id
  name       = "${local.name_prefix}-people"
  decision   = "allow"
  include    = [for email in var.access_emails : { email = { email = email } }]
}

resource "cloudflare_zero_trust_access_policy" "mcp" {
  account_id = var.cloudflare_account_id
  name       = "${local.name_prefix}-mcp"
  decision   = "non_identity"
  include    = [{ service_token = { token_id = cloudflare_zero_trust_access_service_token.mcp.id } }]
}

resource "cloudflare_zero_trust_access_application" "web" {
  account_id       = var.cloudflare_account_id
  name             = local.name_prefix
  type             = "self_hosted"
  domain           = local.app_fqdn
  session_duration = var.access_session_duration
  policies         = [{ id = cloudflare_zero_trust_access_policy.people.id, precedence = 1 }]
}

resource "cloudflare_zero_trust_access_application" "mcp" {
  account_id = var.cloudflare_account_id
  name       = "${local.name_prefix}-mcp"
  type       = "self_hosted"
  domain     = "${local.app_fqdn}${local.mcp_path}"
  policies   = [{ id = cloudflare_zero_trust_access_policy.mcp.id, precedence = 1 }]
}
