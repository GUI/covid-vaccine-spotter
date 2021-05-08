resource "linode_firewall" "db-firewall" {
  label = "vaccinespotter-db-firewall"
  inbound_policy = "DROP"
  outbound_policy = "ACCEPT"

  inbound {
    label = "allowed"
    action = "ACCEPT"
    protocol = "TCP"
    ports = "1-65535"
    ipv4 = yamldecode(data.sops_file.secrets.raw).firewall_allowed_inbound_ipv4
  }

  linodes = [linode_instance.prod-db.id]
}

resource "linode_firewall" "k8s-firewall" {
  label = "vaccinespotter-k8s-firewall"
  inbound_policy = "DROP"
  outbound_policy = "ACCEPT"

  inbound {
    label = "allowed"
    action = "ACCEPT"
    protocol = "TCP"
    ports = "1-65535"
    ipv4 = yamldecode(data.sops_file.secrets.raw).firewall_allowed_inbound_ipv4
  }

  inbound {
    label = "kubelet-health-checks"
    action = "ACCEPT"
    protocol = "TCP"
    ports = "10250"
    ipv4 = ["192.168.128.0/17"]
  }

  inbound {
    label = "kubectl-proxy"
    action = "ACCEPT"
    protocol = "UDP"
    ports = "51820"
    ipv4 = ["192.168.128.0/17"]
  }

  inbound {
    label = "calico-bpg"
    action = "ACCEPT"
    protocol = "TCP"
    ports = "179"
    ipv4 = ["192.168.128.0/17"]
  }

  inbound {
    label = "services-tcp"
    action = "ACCEPT"
    protocol = "TCP"
    ports = "30000-32767"
    ipv4 = yamldecode(data.sops_file.secrets.raw).firewall_allowed_inbound_ipv4
  }

  inbound {
    label = "services-udp"
    action = "ACCEPT"
    protocol = "UDP"
    ports = "30000-32767"
    ipv4 = yamldecode(data.sops_file.secrets.raw).firewall_allowed_inbound_ipv4
  }

  linodes = flatten([for pool in linode_lke_cluster.prod-cluster.pool: [ for node in pool.nodes: node.instance_id ]])
}
