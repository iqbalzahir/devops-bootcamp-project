output "web_public_ip" {
  description = "Elastic IP untuk Web Server"
  value       = aws_eip.web_eip.public_ip
}

output "web_private_ip" {
  description = "Private IP untuk Web Server"
  value       = aws_instance.web_server.private_ip
}

output "ssm_command_web" {
  description = "Arahan SSM untuk Web Server"
  value       = "aws ssm start-session --target ${aws_instance.web_server.id}"
}

output "controller_private_ip" {
  description = "Private IP untuk Ansible Controller"
  value       = aws_instance.controller.private_ip
}

output "ssm_command_controller" {
  description = "Arahan SSM untuk Ansible Controller"
  value       = "aws ssm start-session --target ${aws_instance.controller.id}"
}

output "monitoring_private_ip" {
  description = "Private IP untuk Monitoring Server"
  value       = aws_instance.monitoring.private_ip
}

output "ssm_command_monitoring" {
  description = "Arahan SSM untuk Monitoring Server"
  value       = "aws ssm start-session --target ${aws_instance.monitoring.id}"
}

output "ecr_repository_url" {
  description = "URL Repositori ECR"
  value       = aws_ecr_repository.app_repo.repository_url
}
