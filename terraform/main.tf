# SyncLinqs AWS Infrastructure
# Terraform configuration for production deployment

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration for remote state
  # Uncomment and configure for production
  # backend "s3" {
  #   bucket         = "synclinqs-terraform-state"
  #   key            = "production/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "synclinqs-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "SyncLinqs"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Local values
locals {
  name_prefix = "synclinqs-${var.environment}"

  azs = slice(data.aws_availability_zones.available.names, 0, 2)

  common_tags = {
    Project     = "SyncLinqs"
    Environment = var.environment
  }
}
