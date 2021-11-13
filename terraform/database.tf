# resource "linode_instance" "prod-db" {
#   region = "us-west"
#   type = "g6-standard-4"
#   label = "vaccinespotter-prod-db"
#   private_ip = true
#   watchdog_enabled = true
#   image = "linode/debian10"
#   root_pass = data.sops_file.secrets.data.db_instance_root_pass
#   authorized_keys = yamldecode(data.sops_file.secrets.raw).db_instance_authorized_keys
#
#   provisioner "remote-exec" {
#     inline = ["apt-get update", "apt-get -y install python3"]
#
#     connection {
#       host = self.ip_address
#       type = "ssh"
#       user = "root"
#       password = data.sops_file.secrets.data.db_instance_root_pass
#     }
#   }
#
#   provisioner "local-exec" {
#     command = "ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -u root -i '${self.ip_address},' -e 'ansible_python_interpreter=/usr/bin/python3' database.yml"
#   }
#
#   lifecycle {
#     prevent_destroy = true
#   }
# }
