output "cloudfront_domain" {
  description = "CloudFront distribution domain"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_bucket" {
  description = "S3 bucket name for frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "media_bucket" {
  description = "S3 bucket name for media uploads"
  value       = aws_s3_bucket.media.bucket
}

output "media_bucket_arn" {
  description = "S3 bucket ARN for media uploads"
  value       = aws_s3_bucket.media.arn
}

output "api_eip" {
  description = "Elastic IP address for API EC2"
  value       = aws_eip.api_eip.public_ip
}

output "api_fqdn" {
  description = "API FQDN"
  value       = "${var.api_subdomain}.${var.domain_name}"
}
