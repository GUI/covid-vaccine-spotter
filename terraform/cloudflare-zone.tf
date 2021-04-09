resource "cloudflare_zone" "vaccinespotter-org" {
  zone = "vaccinespotter.org"
}

resource "cloudflare_zone_settings_override" "vaccinespotter-org" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  settings {
    always_use_https = "on"
    brotli = "on"
    browser_cache_ttl = 0
    cache_level = "simplified"
    http2 = "on"
    ssl = "flexible"
    tls_1_3 = "on"
    websockets = "on"
  }
}
