resource "cloudflare_record" "vaccinespotter-org-a" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "vaccinespotter.org"
  type = "A"
  ttl = 1
  proxied = true
  value = "192.0.2.1"
}

resource "cloudflare_record" "_domainconnect-vaccinespotter-org-cname" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "_domainconnect"
  type = "CNAME"
  ttl = 1
  proxied = true
  value = "connect.domains.google.com"
}

resource "cloudflare_record" "archive-vaccinespotter-org-cname" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "archive"
  type = "CNAME"
  ttl = 1
  proxied = true
  value = data.sops_file.secrets.data.prod_website_cname
}

resource "cloudflare_record" "www-vaccinespotter-org-cname" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "www"
  type = "CNAME"
  ttl = 1
  proxied = true
  value = data.sops_file.secrets.data.prod_website_cname
}

resource "cloudflare_record" "vaccinespotter-org-mx-40" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "vaccinespotter.org"
  type = "MX"
  ttl = 3600
  priority = 40
  value = "alt4.gmr-smtp-in.l.google.com"
}

resource "cloudflare_record" "vaccinespotter-org-mx-30" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "vaccinespotter.org"
  type = "MX"
  ttl = 3600
  priority = 30
  value = "alt3.gmr-smtp-in.l.google.com"
}

resource "cloudflare_record" "vaccinespotter-org-mx-20" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "vaccinespotter.org"
  type = "MX"
  ttl = 3600
  priority = 20
  value = "alt2.gmr-smtp-in.l.google.com"
}

resource "cloudflare_record" "vaccinespotter-org-mx-10" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "vaccinespotter.org"
  type = "MX"
  ttl = 3600
  priority = 10
  value = "alt1.gmr-smtp-in.l.google.com"
}

resource "cloudflare_record" "vaccinespotter-org-mx-5" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "vaccinespotter.org"
  type = "MX"
  ttl = 3600
  priority = 5
  value = "gmr-smtp-in.l.google.com"
}

resource "cloudflare_record" "vaccinespotter-org-txt-google-site-verification-1" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "vaccinespotter.org"
  type = "TXT"
  ttl = 1
  value = "google-site-verification=5TBi8g22lLA2dNWKrmte2fPiGJBKiFFJXQUzEWpAu7s"
}

resource "cloudflare_record" "vaccinespotter-org-txt-google-site-verification-2" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "vaccinespotter.org"
  type = "TXT"
  ttl = 1
  value = "google-site-verification=jSWPCZT6E_WrIkrD8Eclji44gNulimjQpMdF_nXAIfs"
}

resource "cloudflare_record" "shutdown-vaccinespotter-org-cname" {
  zone_id = cloudflare_zone.vaccinespotter-org.id
  name = "shutdown"
  type = "CNAME"
  ttl = 1
  proxied = true
  value = "gui.github.io"
}
