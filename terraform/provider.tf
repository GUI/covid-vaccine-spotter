provider "google" {
  project = "vaccine-spotter-307400"
  region = "us-central1"
}

variable "alicloud_access_key" {
  type = string
  sensitive = true
}

variable "alicloud_secret_key" {
  type = string
  sensitive = true
}

variable "alicloud_region" {
  type = string
}

variable "alicloud_account_id" {
  type = string
}

provider "alicloud" {
  access_key = var.alicloud_access_key
  secret_key = var.alicloud_secret_key
  region = var.alicloud_region
}

terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      version = "~> 2.0"
    }
  }
}

variable "cloudflare_email" {
  type = string
  sensitive = true
}

variable "cloudflare_api_key" {
  type = string
  sensitive = true
}

provider "cloudflare" {
  email = var.cloudflare_email
  api_key = var.cloudflare_api_key
}
