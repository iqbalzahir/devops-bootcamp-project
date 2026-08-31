data "aws_ami" "my_ami" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

data "aws_iam_instance_profile" "my_ssm_profile" {
  name = "EC2-SSM-Role"
}

# 1. Web Server (Public Subnet: 10.0.0.5)
resource "aws_instance" "web_server" {
  ami                    = data.aws_ami.my_ami.id
  instance_type          = "t3.micro"
  subnet_id              = module.vpc.public_subnets[0]
  private_ip             = "10.0.0.5"
  vpc_security_group_ids = [aws_security_group.devops_public_sg.id]
  iam_instance_profile   = data.aws_iam_instance_profile.my_ssm_profile.name

  tags = {
    Name = "web server"
  }
}

# Elastic IP untuk Web Server
resource "aws_eip" "web_eip" {
  instance = aws_instance.web_server.id
  domain   = "vpc"

  tags = {
    Name = "devops-web-eip"
  }
}

# 2. Ansible Controller (Private Subnet: 10.0.0.135)
resource "aws_instance" "controller" {
  ami                    = data.aws_ami.my_ami.id
  instance_type          = "t3.micro"
  subnet_id              = module.vpc.private_subnets[0]
  private_ip             = "10.0.0.135"
  vpc_security_group_ids = [aws_security_group.devops_private_sg.id]
  iam_instance_profile   = data.aws_iam_instance_profile.my_ssm_profile.name

  tags = {
    Name = "Ansible controller"
  }
}

# 3. Monitoring Server (Private Subnet: 10.0.0.136)
resource "aws_instance" "monitoring" {
  ami                    = data.aws_ami.my_ami.id
  instance_type          = "t3.micro"
  subnet_id              = module.vpc.private_subnets[0]
  private_ip             = "10.0.0.136"
  vpc_security_group_ids = [aws_security_group.devops_private_sg.id]
  iam_instance_profile   = data.aws_iam_instance_profile.my_ssm_profile.name

  tags = {
    Name = "monitoring server"
  }
}
