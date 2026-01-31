# SyncLinqs ElastiCache Redis Configuration

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.name_prefix}-redis-subnet"
  description = "Redis subnet group for SyncLinqs"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name = "${local.name_prefix}-redis-subnet"
  }
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  name   = "${local.name_prefix}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  tags = {
    Name = "${local.name_prefix}-redis7"
  }
}

# ElastiCache Replication Group (Redis Cluster)
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "Redis cluster for SyncLinqs"

  # Engine
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.redis_node_type
  port                 = 6379

  # Cluster configuration
  num_cache_clusters = var.environment == "production" ? var.redis_num_cache_nodes : 1

  # Network
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Parameter Group
  parameter_group_name = aws_elasticache_parameter_group.main.name

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                 = aws_kms_key.main.arn

  # Auth token (production)
  auth_token = var.environment == "production" ? random_password.redis_auth_token.result : null

  # Maintenance
  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_window          = "04:00-05:00"
  snapshot_retention_limit = var.environment == "production" ? 7 : 1

  # Auto failover (production with multiple nodes)
  automatic_failover_enabled = var.environment == "production" && var.redis_num_cache_nodes > 1

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  # Notification (optional - uncomment and configure SNS topic)
  # notification_topic_arn = aws_sns_topic.alerts.arn

  tags = {
    Name = "${local.name_prefix}-redis"
  }
}

# Random password for Redis AUTH token
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false # Redis AUTH token doesn't support all special characters
}

# Store Redis auth token in Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth_token" {
  name        = "${local.name_prefix}/redis-auth-token"
  description = "Redis AUTH token for SyncLinqs"

  tags = {
    Name = "${local.name_prefix}-redis-auth-token"
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id     = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = random_password.redis_auth_token.result
}
