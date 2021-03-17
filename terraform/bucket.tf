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
