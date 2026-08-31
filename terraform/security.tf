# Security Group untuk Public Subnet (Web Server)
resource "aws_security_group" "devops_public_sg" {
  name        = "devops-public-sg"
  description = "Security Group untuk Web Server Public"
  vpc_id      = aws_vpc.devops_vpc.id

  tags = {
    Name = "devops-public-sg"
  }
}

# Port 80 dari mana-mana (Internet)
resource "aws_vpc_security_group_ingress_rule" "public_http_ingress" {
  security_group_id = aws_security_group.devops_public_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

# Port 9100 (Node Exporter) dari Monitoring Server (10.0.0.136/32) sahaja
resource "aws_vpc_security_group_ingress_rule" "public_node_exporter_ingress" {
  security_group_id = aws_security_group.devops_public_sg.id
  cidr_ipv4         = "10.0.0.136/32"
  ip_protocol       = "tcp"
  from_port         = 9100
  to_port           = 9100
}

# Port 22 (SSH) dari Subnet VPC (10.0.0.0/24)
resource "aws_vpc_security_group_ingress_rule" "public_ssh_ingress" {
  security_group_id = aws_security_group.devops_public_sg.id
  cidr_ipv4         = "10.0.0.0/24"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
}

# Egress All
resource "aws_vpc_security_group_egress_rule" "public_all_egress" {
  security_group_id = aws_security_group.devops_public_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# Security Group untuk Private Subnet (Ansible Controller & Monitoring)
resource "aws_security_group" "devops_private_sg" {
  name        = "devops-private-sg"
  description = "Security Group untuk Private Server"
  vpc_id      = aws_vpc.devops_vpc.id

  tags = {
    Name = "devops-private-sg"
  }
}

# Port 22 (SSH) dari Subnet VPC (10.0.0.0/24)
resource "aws_vpc_security_group_ingress_rule" "private_ssh_ingress" {
  security_group_id = aws_security_group.devops_private_sg.id
  cidr_ipv4         = "10.0.0.0/24"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
}

# Egress All
resource "aws_vpc_security_group_egress_rule" "private_all_egress" {
  security_group_id = aws_security_group.devops_private_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
