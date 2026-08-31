module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "devops-vpc"
  cidr = "10.0.0.0/24"

  azs             = [var.az]
  public_subnets  = ["10.0.0.0/25"]
  private_subnets = ["10.0.0.128/25"]

  public_subnet_names  = ["devops-public-subnet"]
  private_subnet_names = ["devops-private-subnet"]

  map_public_ip_on_launch = true

  enable_nat_gateway = true
  single_nat_gateway = true
  enable_vpn_gateway = false

  enable_dns_hostnames = true
  enable_dns_support   = true

  igw_tags = {
    Name = "devops-igw"
  }

  nat_gateway_tags = {
    Name = "devops-ngw"
  }

  nat_eip_tags = {
    Name = "devops-nat-eip"
  }

  public_route_table_tags = {
    Name = "devops-public-route"
  }

  private_route_table_tags = {
    Name = "devops-private-route"
  }

  tags = {
    Name = "devops-vpc"
  }
}
