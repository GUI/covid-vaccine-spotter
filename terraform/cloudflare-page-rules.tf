resource "cloudflare_page_rule" "www-settings" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  target = "www.vaccinespotter.org/*"
  priority = 2
  status = "active"
  actions {
    forwarding_url {
      status_code = 302
      url = "https://shutdown.vaccinespotter.org/"
    }
  }
}

resource "cloudflare_page_rule" "redirect-to-www" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  target = "vaccinespotter.org/*"
  priority = 1
  status = "active"
  actions {
    forwarding_url {
      status_code = 302
      url = "https://www.vaccinespotter.org/$1"
    }
  }
}
