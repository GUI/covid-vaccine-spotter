resource "linode_lke_cluster" "prod-cluster" {
  region = "us-west"
  k8s_version = "1.20"
  label = "vaccinespotter-prod-cluster"

  pool {
    type = "g6-standard-2"
    count = 2
  }
}
