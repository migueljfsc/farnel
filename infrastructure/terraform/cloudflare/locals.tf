locals {
  # Cloudflare resources take no tags, so the name carries project and environment.
  name_prefix = "${var.project_name}-${var.environment}"

  d1_database_name = local.name_prefix

  app_fqdn = "${var.project_name}.${var.domain}"
  mcp_path = "/mcp"
}
