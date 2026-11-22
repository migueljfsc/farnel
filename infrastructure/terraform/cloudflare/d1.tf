# OpenTofu owns the database; wrangler owns its schema (worker/migrations).
resource "cloudflare_d1_database" "app" {
  account_id   = var.cloudflare_account_id
  name         = local.d1_database_name
  jurisdiction = var.d1_jurisdiction

  # Optional and not computed in the provider: omitting it plans a removal that the API refuses.
  read_replication = {
    mode = "disabled"
  }
}
