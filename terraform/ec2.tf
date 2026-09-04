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

# Jana SSH Key Pair ED25519 secara automatik
resource "tls_private_key" "ssh_key" {
  algorithm = "ED25519"
}

# Daftarkan Public Key ke AWS Key Pair
resource "aws_key_pair" "devops_key" {
  key_name   = "devops-bootcamp-key-iqbal"
  public_key = tls_private_key.ssh_key.public_key_openssh

  tags = {
    Name = "devops-bootcamp-key-iqbal"
  }
}

# 1. Web Server (Public Subnet: 10.0.0.5)
resource "aws_instance" "web_server" {
  ami                    = data.aws_ami.my_ami.id
  instance_type          = "t3.micro"
  subnet_id              = module.vpc.public_subnets[0]
  private_ip             = "10.0.0.5"
  key_name               = aws_key_pair.devops_key.key_name
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
  depends_on             = [module.vpc]
  ami                    = data.aws_ami.my_ami.id
  instance_type          = "t3.micro"
  subnet_id              = module.vpc.private_subnets[0]
  private_ip             = "10.0.0.135"
  key_name               = aws_key_pair.devops_key.key_name
  vpc_security_group_ids = [aws_security_group.devops_private_sg.id]
  iam_instance_profile   = data.aws_iam_instance_profile.my_ssm_profile.name

  # Automasi persediaan Ansible & Private Key semasa pelayan boot
  user_data = <<-EOF
    #!/bin/bash
    # Tunggu sehingga sambungan internet keluar (NAT Gateway) sedia
    until curl -s --connect-timeout 5 http://archive.ubuntu.com > /dev/null; do
      echo "Menunggu internet bersedia..."
      sleep 5
    done

    apt update -y
    apt install -y ansible-core git

    # Simpan private key untuk Ansible
    mkdir -p /home/ubuntu/.ssh
    cat << 'KEY' > /home/ubuntu/.ssh/id_ed25519
    ${tls_private_key.ssh_key.private_key_openssh}
    KEY
    chmod 600 /home/ubuntu/.ssh/id_ed25519
    chown -R ubuntu:ubuntu /home/ubuntu/.ssh

    # Clone repositori projek
    sudo -u ubuntu git clone https://github.com/iqbalzahir/devops-bootcamp-project.git /home/ubuntu/devops-bootcamp-project || true
    if [ -d "/home/ubuntu/devops-bootcamp-project/ansible" ]; then
      cd /home/ubuntu/devops-bootcamp-project/ansible
      sudo -u ubuntu ansible-galaxy install -r requirements.yml || true
    fi
  EOF

  tags = {
    Name = "Ansible controller"
  }
}

# 3. Monitoring Server (Private Subnet: 10.0.0.136)
resource "aws_instance" "monitoring" {
  depends_on             = [module.vpc]
  ami                    = data.aws_ami.my_ami.id
  instance_type          = "t3.micro"
  subnet_id              = module.vpc.private_subnets[0]
  private_ip             = "10.0.0.136"
  key_name               = aws_key_pair.devops_key.key_name
  vpc_security_group_ids = [aws_security_group.devops_private_sg.id]
  iam_instance_profile   = data.aws_iam_instance_profile.my_ssm_profile.name

  tags = {
    Name = "monitoring server"
  }
}
