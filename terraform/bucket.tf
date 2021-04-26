resource "google_storage_bucket" "website-bucket" {
  name = "www.vaccinespotter.org"
  location = "US-CENTRAL1"

  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "404.html"
  }

  cors {
    origin = ["*"]
    method = ["GET"]
    max_age_seconds = 60
  }
}

data "google_iam_policy" "all-users-object-viewer" {
  binding {
    role = "roles/storage.objectViewer"
    members = [
      "allUsers",
    ]
  }

  binding {
    role = "roles/storage.objectAdmin"
    members = [
      "serviceAccount:33659902356-compute@developer.gserviceaccount.com",
    ]
  }
}

resource "google_storage_bucket_iam_policy" "website-bucket-policy" {
  bucket = google_storage_bucket.website-bucket.name
  policy_data = data.google_iam_policy.all-users-object-viewer.policy_data
}

resource "google_storage_bucket" "stage-website-bucket" {
  name = "stage.vaccinespotter.org"
  location = "US-CENTRAL1"

  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "404.html"
  }

  cors {
    origin = ["*"]
    method = ["GET"]
    max_age_seconds = 60
  }
}

resource "google_storage_bucket_iam_policy" "stage-website-bucket-policy" {
  bucket = google_storage_bucket.stage-website-bucket.name
  policy_data = data.google_iam_policy.all-users-object-viewer.policy_data
}

resource "alicloud_ram_user" "website-deployer" {
  name = "website-deployer"
  display_name = "Website Deployer"
}

locals {
  cloudflare_ips = [
    "2400:cb00::/32",
    "2405:8100::/32",
    "2405:b500::/32",
    "2606:4700::/32",
    "2803:f800::/32",
    "2c0f:f248::/32",
    "2a06:98c0::/29",
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "104.16.0.0/12",
    "108.162.192.0/18",
    "131.0.72.0/22",
    "141.101.64.0/18",
    "162.158.0.0/15",
    "172.64.0.0/13",
    "173.245.48.0/20",
    "188.114.96.0/20",
    "190.93.240.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17",
  ]
}

resource "alicloud_oss_bucket" "stage-website-bucket" {
  bucket = data.sops_file.secrets.data.stage_website_bucket_name
  acl = "private"

  policy = jsonencode({
    Version = "1"
    Statement = [
      {
        Action = [
          "oss:*",
        ]
        Effect = "Allow"
        Principal = [
          alicloud_ram_user.website-deployer.id,
        ]
        Resource = [
          "acs:oss:*:${data.sops_file.secrets.data.alicloud_account_id}:${data.sops_file.secrets.data.stage_website_bucket_name}",
          "acs:oss:*:${data.sops_file.secrets.data.alicloud_account_id}:${data.sops_file.secrets.data.stage_website_bucket_name}/*",
        ]
      },
      {
        Action = [
          "oss:GetObject",
        ]
        Condition = {
          IpAddress = {
            "acs:SourceIp" = local.cloudflare_ips
          }
        }
        Effect = "Allow"
        Principal = [
          "*",
        ]
        Resource = [
          "acs:oss:*:${data.sops_file.secrets.data.alicloud_account_id}:${data.sops_file.secrets.data.stage_website_bucket_name}",
          "acs:oss:*:${data.sops_file.secrets.data.alicloud_account_id}:${data.sops_file.secrets.data.stage_website_bucket_name}/*",
        ]
      },
    ]
  })

  server_side_encryption_rule {
    sse_algorithm = "AES256"
  }

  website {
    index_document = "index.html"
    error_document = "404.html"
  }

  cors_rule {
    allowed_origins = ["*"]
    allowed_methods = ["GET"]
    max_age_seconds = 60
  }
}

resource "alicloud_oss_bucket" "prod-website-bucket" {
  bucket = data.sops_file.secrets.data.prod_website_bucket_name
  acl = "private"

  policy = jsonencode({
    Version = "1"
    Statement = [
      {
        Action = [
          "oss:*",
        ]
        Effect = "Allow"
        Principal = [
          alicloud_ram_user.website-deployer.id,
        ]
        Resource = [
          "acs:oss:*:${data.sops_file.secrets.data.alicloud_account_id}:${data.sops_file.secrets.data.prod_website_bucket_name}",
          "acs:oss:*:${data.sops_file.secrets.data.alicloud_account_id}:${data.sops_file.secrets.data.prod_website_bucket_name}/*",
        ]
      },
      {
        Action = [
          "oss:GetObject",
        ]
        Condition = {
          IpAddress = {
            "acs:SourceIp" = local.cloudflare_ips
          }
        }
        Effect = "Allow"
        Principal = [
          "*",
        ]
        Resource = [
          "acs:oss:*:${data.sops_file.secrets.data.alicloud_account_id}:${data.sops_file.secrets.data.prod_website_bucket_name}",
          "acs:oss:*:${data.sops_file.secrets.data.alicloud_account_id}:${data.sops_file.secrets.data.prod_website_bucket_name}/*",
        ]
      },
    ]
  })

  server_side_encryption_rule {
    sse_algorithm = "AES256"
  }

  website {
    index_document = "index.html"
    error_document = "404.html"
  }

  cors_rule {
    allowed_origins = ["*"]
    allowed_methods = ["GET"]
    max_age_seconds = 60
  }
}
