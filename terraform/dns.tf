# Dapatkan maklumat Zone ID domain di Cloudflare
data "cloudflare_zone" "my_zone" {
  count = var.cloudflare_api_token != "" ? 1 : 0
  name  = var.cloudflare_domain
}

# Automasi cipta / kemaskini A Record web.keepitshort.my ke Elastic IP Web Server
resource "cloudflare_record" "web" {
  count           = var.cloudflare_api_token != "" ? 1 : 0
  zone_id         = data.cloudflare_zone.my_zone[0].id
  name            = "web"
  content         = aws_eip.web_eip.public_ip
  type            = "A"
  proxied         = true
  ttl             = 1
  allow_overwrite = true

  comment = "Diuruskan secara automatik oleh Terraform"
}
