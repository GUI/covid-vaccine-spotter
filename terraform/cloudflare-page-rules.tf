resource "cloudflare_page_rule" "no-index-html" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  target = "*.vaccinespotter.org/*index.html*"
  priority = 5
  status = "active"
  actions {
    forwarding_url {
      status_code = 302
      url = "https://$1.vaccinespotter.org/$2$3"
    }
  }
}

resource "cloudflare_page_rule" "legacy-all" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  target = "*.vaccinespotter.org/*/all/"
  priority = 4
  status = "active"
  actions {
    forwarding_url {
      status_code = 302
      url = "https://$1.vaccinespotter.org/$2/"
    }
  }
}

resource "cloudflare_page_rule" "www-settings" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  target = "*.vaccinespotter.org/*"
  priority = 3
  status = "active"
  actions {
    cache_level = "cache_everything"
  }
}

resource "cloudflare_page_rule" "redirect-to-www" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  target = "vaccinespotter.org/*"
  priority = 2
  status = "active"
  actions {
    forwarding_url {
      status_code = 302
      url = "https://www.vaccinespotter.org/$1"
    }
  }
}
