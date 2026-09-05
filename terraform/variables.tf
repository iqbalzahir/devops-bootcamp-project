variable "az" {
  description = "Availability Zone untuk semua subnet"
  type        = string
  default     = "ap-southeast-1a"
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token dengan kebenaran DNS Edit"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cloudflare_domain" {
  description = "Nama domain utama di Cloudflare"
  type        = string
  default     = "keepitshort.my"
}
