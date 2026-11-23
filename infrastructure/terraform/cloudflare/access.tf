# Two Access applications on one hostname; Access applies the most specific path.
# Both sign people in by email. /mcp also runs Access's managed OAuth, so MCP clients such as
# claude.ai sign in through Access, and accepts the service token for non-interactive clients.

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
  policies = [
    { id = cloudflare_zero_trust_access_policy.people.id, precedence = 1 },
    { id = cloudflare_zero_trust_access_policy.mcp.id, precedence = 2 },
  ]

  oauth_configuration = {
    enabled = true
    dynamic_client_registration = {
      enabled                = true
      allowed_uris           = var.mcp_oauth_redirect_uris
      allow_any_on_localhost = true
      allow_any_on_loopback  = true
    }
    grant = {
      access_token_lifetime = "15m"
      session_duration      = var.access_session_duration
    }
  }
}

# The app icons are public, so Google's favicon service (which claude.ai uses for connector
# icons) can fetch them; nothing else on the hostname is.
resource "cloudflare_zero_trust_access_policy" "public" {
  account_id = var.cloudflare_account_id
  name       = "${local.name_prefix}-public"
  decision   = "bypass"
  include    = [{ everyone = {} }]
}

resource "cloudflare_zero_trust_access_application" "icons" {
  account_id   = var.cloudflare_account_id
  name         = "${local.name_prefix}-icons"
  type         = "self_hosted"
  destinations = [for path in local.public_paths : { type = "public", uri = "${local.app_fqdn}${path}" }]
  policies     = [{ id = cloudflare_zero_trust_access_policy.public.id, precedence = 1 }]
}
