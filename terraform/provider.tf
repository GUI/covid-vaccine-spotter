terraform {
  required_providers {
    alicloud = {
      source = "aliyun/alicloud"
      version = "~> 1.122"
    }

    cloudflare = {
      source = "cloudflare/cloudflare"
      version = "~> 2.0"
    }

    linode = {
      source = "linode/linode"
      version = "~> 1.16"
    }

    sops = {
      source = "carlpett/sops"
      version = "~> 0.5"
    }
  }
}

provider "sops" {}

data "sops_file" "secrets" {
  source_file = "secrets.enc.yaml"
}

provider "google" {
  project = data.sops_file.secrets.data.google_project
  region = data.sops_file.secrets.data.google_region
}

provider "alicloud" {
  access_key = data.sops_file.secrets.data.alicloud_access_key
  secret_key = data.sops_file.secrets.data.alicloud_secret_key
  region = data.sops_file.secrets.data.alicloud_region
}

provider "cloudflare" {
  api_token = data.sops_file.secrets.data.cloudflare_api_token
  account_id = data.sops_file.secrets.data.cloudflare_account_id
}

provider "linode" {
  token = data.sops_file.secrets.data.linode_token
  api_version = "v4beta"
}
