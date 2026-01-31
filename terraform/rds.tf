# SyncLinqs RDS PostgreSQL Configuration

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db-subnet"
  description = "Database subnet group for SyncLinqs"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name = "${local.name_prefix}-db-subnet"
  }
}

# RDS Parameter Group
resource "aws_db_parameter_group" "main" {
  name   = "${local.name_prefix}-pg15"
  family = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking more than 1 second
  }

  tags = {
    Name = "${local.name_prefix}-pg15"
  }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgres"

  # Engine
  engine               = "postgres"
  engine_version       = "15"
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  max_allocated_storage = var.environment == "production" ? var.db_allocated_storage * 4 : var.db_allocated_storage * 2

  # Credentials
  db_name  = "synclinqs"
  username = var.db_username
  password = var.db_password

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  port                   = 5432

  # Storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.main.arn

  # Parameter Group
  parameter_group_name = aws_db_parameter_group.main.name

  # Backup
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # High Availability (production only)
  multi_az = var.environment == "production"

  # Performance Insights (production only)
  performance_insights_enabled          = var.environment == "production"
  performance_insights_retention_period = var.environment == "production" ? 7 : 0

  # Deletion protection (production only)
  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${local.name_prefix}-final-snapshot" : null

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  # Enhanced monitoring
  monitoring_interval = var.environment == "production" ? 60 : 0
  monitoring_role_arn = var.environment == "production" ? aws_iam_role.rds_monitoring[0].arn : null

  tags = {
    Name = "${local.name_prefix}-postgres"
  }

  lifecycle {
    prevent_destroy = false # Set to true for production
  }
}

# KMS Key for RDS encryption
resource "aws_kms_key" "main" {
  description             = "KMS key for SyncLinqs RDS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "${local.name_prefix}-kms"
  }
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name_prefix}-rds"
  target_key_id = aws_kms_key.main.key_id
}

# IAM Role for Enhanced Monitoring (production only)
resource "aws_iam_role" "rds_monitoring" {
  count = var.environment == "production" ? 1 : 0

  name = "${local.name_prefix}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-rds-monitoring"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count = var.environment == "production" ? 1 : 0

  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
