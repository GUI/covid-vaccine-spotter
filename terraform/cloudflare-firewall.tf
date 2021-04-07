resource "cloudflare_filter" "staging-access" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  expression = data.sops_file.secrets.data.stage_website_firewall_filter
}

resource "cloudflare_firewall_rule" "staging-access" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  description = "Staging Access"
  filter_id = cloudflare_filter.staging-access.id
  action = "block"
}
