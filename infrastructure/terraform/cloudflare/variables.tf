###################### CLOUDFLARE ACCOUNT ######################

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token. Prefer the CLOUDFLARE_API_TOKEN env var over passing this."
  sensitive   = true
  default     = null
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID."
  nullable    = false

  validation {
    condition     = var.cloudflare_account_id != ""
    error_message = "Cloudflare account ID cannot be empty."
  }
}

###################### NAMING ######################

variable "project_name" {
  type        = string
  default     = "farnel"
  description = "Base name of every resource, and the app's subdomain."
}

variable "environment" {
  type        = string
  default     = "prod"
  description = "Deployment environment, carried in resource names."
}

###################### D1 ######################

variable "d1_jurisdiction" {
  type        = string
  default     = "eu"
  description = "Where the D1 database runs and stores data (eu | us | fedramp)."
}

###################### DOMAIN ######################

variable "domain" {
  type        = string
  description = "Apex domain in this Cloudflare account; the app is served from <project_name>.<domain>."
  nullable    = false
}

###################### ACCESS ######################

variable "access_emails" {
  type        = list(string)
  sensitive   = true
  description = "Emails allowed to sign in to the web app. Set through TF_VAR_access_emails; never committed."

  validation {
    condition     = length(var.access_emails) > 0
    error_message = "At least one email is required."
  }
}

variable "access_session_duration" {
  type        = string
  default     = "720h"
  description = "How long a web sign-in lasts."
}

variable "mcp_oauth_redirect_uris" {
  type        = list(string)
  default     = ["https://claude.ai/api/mcp/auth_callback"]
  description = "Redirect URIs MCP clients may register through managed OAuth on /mcp."
}

variable "service_token_duration" {
  type        = string
  default     = "8760h"
  description = "Lifetime of the service token claude.ai uses for the MCP endpoint."
}
