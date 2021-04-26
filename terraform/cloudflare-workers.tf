locals {
  states = toset([
    "ak",
    "al",
    "ar",
    "az",
    "ca",
    "co",
    "ct",
    "dc",
    "de",
    "fl",
    "ga",
    "hi",
    "ia",
    "id",
    "il",
    "in",
    "ks",
    "ky",
    "la",
    "ma",
    "md",
    "me",
    "mh",
    "mi",
    "mn",
    "mo",
    "ms",
    "mt",
    "nc",
    "nd",
    "ne",
    "nh",
    "nj",
    "nm",
    "nv",
    "ny",
    "oh",
    "ok",
    "or",
    "pa",
    "pr",
    "ri",
    "sc",
    "sd",
    "tn",
    "tx",
    "ut",
    "va",
    "vi",
    "vt",
    "wa",
    "wi",
    "wv",
    "wy",
  ])
}

resource "cloudflare_worker_script" "state-redirect" {
  name = "state-redirect"
  content = file("cloudflare-workers/state-redirect.js")
}

resource "cloudflare_worker_route" "state-redirect-no-slash-no-params" {
  for_each = local.states

  zone_id = cloudflare_zone.vaccinespotter-org.id
  pattern = "*.vaccinespotter.org/${each.key}"
  script_name = cloudflare_worker_script.state-redirect.name
}

resource "cloudflare_worker_route" "state-redirect-slash" {
  for_each = local.states

  zone_id = cloudflare_zone.vaccinespotter-org.id
  pattern = "*.vaccinespotter.org/${each.key}/*"
  script_name = cloudflare_worker_script.state-redirect.name
}
