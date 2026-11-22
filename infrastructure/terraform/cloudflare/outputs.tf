# Pasted into wrangler.jsonc after the first apply: d1_database_id, access_aud_web, access_aud_mcp.
output "d1_database_id" {
  value       = cloudflare_d1_database.app.id
  description = "D1 database id, for the d1_databases binding in wrangler.jsonc."
}

output "access_aud_web" {
  value       = cloudflare_zero_trust_access_application.web.aud
  description = "AUD tag of the web application, for ACCESS_AUD_WEB."
}

output "access_aud_mcp" {
  value       = cloudflare_zero_trust_access_application.mcp.aud
  description = "AUD tag of the MCP application, for ACCESS_AUD_MCP."
}

output "mcp_client_id" {
  value       = cloudflare_zero_trust_access_service_token.mcp.client_id
  description = "CF-Access-Client-Id header for the claude.ai connector."
}

output "mcp_client_secret" {
  value       = cloudflare_zero_trust_access_service_token.mcp.client_secret
  sensitive   = true
  description = "CF-Access-Client-Secret header for the claude.ai connector. Read with -raw."
}
