variable "project_name" {
  description = "Project name prefix for resource tags and names"
  type        = string
  default     = "chyraapp"
}

variable "region" {
  description = "AWS region to deploy resources (primary). CloudFront/ACM certs will use us-east-1."
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Root domain name managed in Route53 (e.g., chyraapp.com)"
  type        = string
}

variable "hosted_zone_id" {
  description = "Route53 Hosted Zone ID for the root domain"
  type        = string
}

variable "ssh_key_name" {
  description = "Name of an existing EC2 Key Pair to enable SSH access"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH to EC2 (e.g., your IP/32)"
  type        = string
  default     = "0.0.0.0/0"
}

variable "ec2_instance_type" {
  description = "EC2 instance type for backend"
  type        = string
  default     = "t3.micro"
}

variable "api_subdomain" {
  description = "Subdomain for API"
  type        = string
  default     = "api"
}
