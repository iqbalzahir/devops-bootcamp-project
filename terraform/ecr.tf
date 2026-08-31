resource "aws_ecr_repository" "app_repo" {
  name                 = "devops-bootcamp/final-project-iqbal"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "devops-bootcamp/final-project-iqbal"
  }
}
