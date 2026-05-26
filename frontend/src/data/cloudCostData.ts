/**
 * Cloud Cost Comparison — Static Price Dataset
 *
 * 81 entries: 27 service categories × 3 providers (AWS, Azure, GCP).
 * All prices are approximate reference values as of DATASET_META.last_updated.
 * Do NOT use these values for financial commitments — consult official provider
 * pricing pages for authoritative figures.
 */

export const PRICE_DATASET = [
  // ── 1. Compute (VMs) ──────────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Compute (VMs)',
    service_name: 'EC2 t3.medium',
    unit: 'per hour',
    price_usd: 0.0416,
    tier_label: 'On-Demand',
  },
  {
    provider: 'Azure',
    category: 'Compute (VMs)',
    service_name: 'Azure VM B2s',
    unit: 'per hour',
    price_usd: 0.0416,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'GCP',
    category: 'Compute (VMs)',
    service_name: 'Compute Engine e2-medium',
    unit: 'per hour',
    price_usd: 0.0335,
    tier_label: 'On-Demand',
  },

  // ── 2. Managed Kubernetes ─────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Managed Kubernetes',
    service_name: 'EKS (control plane)',
    unit: 'per hour',
    price_usd: 0.10,
    tier_label: 'Standard',
  },
  {
    provider: 'Azure',
    category: 'Managed Kubernetes',
    service_name: 'AKS (control plane)',
    unit: 'per hour',
    price_usd: 0.10,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'Managed Kubernetes',
    service_name: 'GKE (control plane)',
    unit: 'per hour',
    price_usd: 0.10,
    tier_label: 'Standard',
  },

  // ── 3. Object Storage ─────────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Object Storage',
    service_name: 'S3 Standard',
    unit: 'per GB/month',
    price_usd: 0.023,
    tier_label: 'Standard',
  },
  {
    provider: 'Azure',
    category: 'Object Storage',
    service_name: 'Azure Blob Storage',
    unit: 'per GB/month',
    price_usd: 0.018,
    tier_label: 'Hot Tier',
  },
  {
    provider: 'GCP',
    category: 'Object Storage',
    service_name: 'Cloud Storage Standard',
    unit: 'per GB/month',
    price_usd: 0.020,
    tier_label: 'Standard',
  },

  // ── 4. Managed Databases ──────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Managed Databases',
    service_name: 'RDS db.t3.medium',
    unit: 'per hour',
    price_usd: 0.068,
    tier_label: 'On-Demand',
  },
  {
    provider: 'Azure',
    category: 'Managed Databases',
    service_name: 'Azure SQL Database S2',
    unit: 'per hour',
    price_usd: 0.150,
    tier_label: 'General Purpose',
  },
  {
    provider: 'GCP',
    category: 'Managed Databases',
    service_name: 'Cloud SQL db-n1-standard-1',
    unit: 'per hour',
    price_usd: 0.0965,
    tier_label: 'On-Demand',
  },

  // ── 5. Container Registry ─────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Container Registry',
    service_name: 'ECR',
    unit: 'per GB/month',
    price_usd: 0.10,
    tier_label: 'Standard',
  },
  {
    provider: 'Azure',
    category: 'Container Registry',
    service_name: 'Azure Container Registry (ACR)',
    unit: 'per GB/month',
    price_usd: 0.167,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'Container Registry',
    service_name: 'Artifact Registry',
    unit: 'per GB/month',
    price_usd: 0.10,
    tier_label: 'Standard',
  },

  // ── 6. Load Balancers ─────────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Load Balancers',
    service_name: 'Application Load Balancer (ALB)',
    unit: 'per hour',
    price_usd: 0.008,
    tier_label: 'On-Demand',
  },
  {
    provider: 'Azure',
    category: 'Load Balancers',
    service_name: 'Azure Load Balancer',
    unit: 'per hour',
    price_usd: 0.005,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'Load Balancers',
    service_name: 'Cloud Load Balancing',
    unit: 'per hour',
    price_usd: 0.008,
    tier_label: 'On-Demand',
  },

  // ── 7. Serverless Functions ───────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Serverless Functions',
    service_name: 'AWS Lambda',
    unit: 'per million invocations',
    price_usd: 0.20,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'Azure',
    category: 'Serverless Functions',
    service_name: 'Azure Functions',
    unit: 'per million invocations',
    price_usd: 0.20,
    tier_label: 'Consumption',
  },
  {
    provider: 'GCP',
    category: 'Serverless Functions',
    service_name: 'Cloud Functions',
    unit: 'per million invocations',
    price_usd: 0.40,
    tier_label: 'Pay-as-you-go',
  },

  // ── 8. CDN ────────────────────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'CDN',
    service_name: 'CloudFront',
    unit: 'per GB egress',
    price_usd: 0.0085,
    tier_label: 'On-Demand',
  },
  {
    provider: 'Azure',
    category: 'CDN',
    service_name: 'Azure CDN',
    unit: 'per GB egress',
    price_usd: 0.0075,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'CDN',
    service_name: 'Cloud CDN',
    unit: 'per GB egress',
    price_usd: 0.008,
    tier_label: 'On-Demand',
  },

  // ── 9. VPC / Networking ───────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'VPC / Networking',
    service_name: 'NAT Gateway',
    unit: 'per hour',
    price_usd: 0.045,
    tier_label: 'On-Demand',
  },
  {
    provider: 'Azure',
    category: 'VPC / Networking',
    service_name: 'Azure NAT Gateway',
    unit: 'per hour',
    price_usd: 0.045,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'VPC / Networking',
    service_name: 'Cloud NAT',
    unit: 'per hour',
    price_usd: 0.044,
    tier_label: 'On-Demand',
  },

  // ── 10. Networking Egress ─────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Networking Egress',
    service_name: 'AWS Data Transfer Out',
    unit: 'per GB',
    price_usd: 0.09,
    tier_label: 'Standard',
  },
  {
    provider: 'Azure',
    category: 'Networking Egress',
    service_name: 'Azure Bandwidth Out',
    unit: 'per GB',
    price_usd: 0.087,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'Networking Egress',
    service_name: 'GCP Network Egress',
    unit: 'per GB',
    price_usd: 0.08,
    tier_label: 'Standard',
  },

  // ── 11. Managed Cache ─────────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Managed Cache',
    service_name: 'ElastiCache cache.t3.micro',
    unit: 'per hour',
    price_usd: 0.017,
    tier_label: 'On-Demand',
  },
  {
    provider: 'Azure',
    category: 'Managed Cache',
    service_name: 'Azure Cache for Redis C1',
    unit: 'per hour',
    price_usd: 0.055,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'Managed Cache',
    service_name: 'Memorystore M1',
    unit: 'per hour',
    price_usd: 0.049,
    tier_label: 'Standard',
  },

  // ── 12. Messaging & Queues ────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Messaging & Queues',
    service_name: 'SQS Standard',
    unit: 'per million messages',
    price_usd: 0.40,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'Azure',
    category: 'Messaging & Queues',
    service_name: 'Azure Service Bus',
    unit: 'per million messages',
    price_usd: 0.10,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'Messaging & Queues',
    service_name: 'Cloud Pub/Sub',
    unit: 'per million messages',
    price_usd: 0.04,
    tier_label: 'Pay-as-you-go',
  },

  // ── 13. Managed Kafka / Streaming ─────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Managed Kafka / Streaming',
    service_name: 'Amazon MSK',
    unit: 'per hour',
    price_usd: 0.21,
    tier_label: 'On-Demand',
  },
  {
    provider: 'Azure',
    category: 'Managed Kafka / Streaming',
    service_name: 'Azure Event Hubs',
    unit: 'per hour',
    price_usd: 0.015,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'Managed Kafka / Streaming',
    service_name: 'Pub/Sub Streaming',
    unit: 'per GB',
    price_usd: 0.06,
    tier_label: 'Pay-as-you-go',
  },

  // ── 14. Block Storage (Disks) ─────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Block Storage (Disks)',
    service_name: 'EBS gp3',
    unit: 'per GB/month',
    price_usd: 0.08,
    tier_label: 'General Purpose',
  },
  {
    provider: 'Azure',
    category: 'Block Storage (Disks)',
    service_name: 'Azure Managed Disk SSD',
    unit: 'per GB/month',
    price_usd: 0.096,
    tier_label: 'Standard SSD',
  },
  {
    provider: 'GCP',
    category: 'Block Storage (Disks)',
    service_name: 'Persistent Disk SSD',
    unit: 'per GB/month',
    price_usd: 0.17,
    tier_label: 'SSD',
  },

  // ── 15. Monitoring & Logging ──────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Monitoring & Logging',
    service_name: 'CloudWatch Logs',
    unit: 'per GB ingested',
    price_usd: 0.50,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'Azure',
    category: 'Monitoring & Logging',
    service_name: 'Azure Monitor',
    unit: 'per GB ingested',
    price_usd: 0.25,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'GCP',
    category: 'Monitoring & Logging',
    service_name: 'Cloud Logging',
    unit: 'per GB ingested',
    price_usd: 0.01,
    tier_label: 'Pay-as-you-go',
  },

  // ── 16. Secret Management ─────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Secret Management',
    service_name: 'AWS Secrets Manager',
    unit: 'per secret/month',
    price_usd: 0.40,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'Azure',
    category: 'Secret Management',
    service_name: 'Azure Key Vault',
    unit: 'per secret/month',
    price_usd: 0.03,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'Secret Management',
    service_name: 'Secret Manager',
    unit: 'per secret/month',
    price_usd: 0.06,
    tier_label: 'Pay-as-you-go',
  },

  // ── 17. Data Warehousing ──────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Data Warehousing',
    service_name: 'Redshift dc2.large',
    unit: 'per hour',
    price_usd: 0.25,
    tier_label: 'On-Demand',
  },
  {
    provider: 'Azure',
    category: 'Data Warehousing',
    service_name: 'Azure Synapse Analytics',
    unit: 'per TB queried',
    price_usd: 5.00,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'GCP',
    category: 'Data Warehousing',
    service_name: 'BigQuery',
    unit: 'per TB queried',
    price_usd: 5.00,
    tier_label: 'On-Demand',
  },

  // ── 18. DNS ───────────────────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'DNS',
    service_name: 'Route 53',
    unit: 'per hosted zone/month',
    price_usd: 0.50,
    tier_label: 'Standard',
  },
  {
    provider: 'Azure',
    category: 'DNS',
    service_name: 'Azure DNS',
    unit: 'per hosted zone/month',
    price_usd: 0.50,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'DNS',
    service_name: 'Cloud DNS',
    unit: 'per hosted zone/month',
    price_usd: 0.20,
    tier_label: 'Standard',
  },

  // ── 19. Email / Notifications ─────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Email / Notifications',
    service_name: 'Amazon SES',
    unit: 'per million emails',
    price_usd: 0.10,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'Azure',
    category: 'Email / Notifications',
    service_name: 'Azure Communication Services',
    unit: 'per million emails',
    price_usd: 0.85,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'GCP',
    category: 'Email / Notifications',
    service_name: 'Cloud Pub/Sub (Notifications)',
    unit: 'per million messages',
    price_usd: 0.04,
    tier_label: 'Pay-as-you-go',
  },

  // ── 20. API Gateway ───────────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'API Gateway',
    service_name: 'AWS API Gateway',
    unit: 'per million API calls',
    price_usd: 3.50,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'Azure',
    category: 'API Gateway',
    service_name: 'Azure API Management',
    unit: 'per million API calls',
    price_usd: 0.35,
    tier_label: 'Consumption',
  },
  {
    provider: 'GCP',
    category: 'API Gateway',
    service_name: 'Cloud Endpoints',
    unit: 'per million API calls',
    price_usd: 3.00,
    tier_label: 'Pay-as-you-go',
  },

  // ── 21. Container Orchestration (Serverless) ──────────────────────────────
  {
    provider: 'AWS',
    category: 'Container Orchestration (Serverless)',
    service_name: 'ECS Fargate',
    unit: 'per vCPU/hour',
    price_usd: 0.04048,
    tier_label: 'On-Demand',
  },
  {
    provider: 'Azure',
    category: 'Container Orchestration (Serverless)',
    service_name: 'Azure Container Instances',
    unit: 'per vCPU/second',
    price_usd: 0.0000135,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'GCP',
    category: 'Container Orchestration (Serverless)',
    service_name: 'Cloud Run',
    unit: 'per vCPU/second',
    price_usd: 0.000024,
    tier_label: 'Pay-as-you-go',
  },

  // ── 22. Identity & Access (IAM) ───────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Identity & Access (IAM)',
    service_name: 'Amazon Cognito',
    unit: 'per MAU',
    price_usd: 0.0055,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'Azure',
    category: 'Identity & Access (IAM)',
    service_name: 'Azure AD B2C',
    unit: 'per MAU',
    price_usd: 0.0016,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'GCP',
    category: 'Identity & Access (IAM)',
    service_name: 'Cloud Identity',
    unit: 'per MAU',
    price_usd: 0.0030,
    tier_label: 'Pay-as-you-go',
  },

  // ── 23. CI/CD Pipeline ────────────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'CI/CD Pipeline',
    service_name: 'AWS CodePipeline',
    unit: 'per pipeline/month',
    price_usd: 1.00,
    tier_label: 'Standard',
  },
  {
    provider: 'Azure',
    category: 'CI/CD Pipeline',
    service_name: 'Azure DevOps Pipelines',
    unit: 'per build-minute',
    price_usd: 0.008,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'GCP',
    category: 'CI/CD Pipeline',
    service_name: 'Cloud Build',
    unit: 'per build-minute',
    price_usd: 0.003,
    tier_label: 'Pay-as-you-go',
  },

  // ── 24. Artifact / Package Registry ──────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Artifact / Package Registry',
    service_name: 'AWS CodeArtifact',
    unit: 'per GB/month',
    price_usd: 0.05,
    tier_label: 'Standard',
  },
  {
    provider: 'Azure',
    category: 'Artifact / Package Registry',
    service_name: 'Azure Artifacts',
    unit: 'per GB/month',
    price_usd: 2.00,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'Artifact / Package Registry',
    service_name: 'Artifact Registry (packages)',
    unit: 'per GB/month',
    price_usd: 0.10,
    tier_label: 'Standard',
  },

  // ── 25. Machine Learning Platform ─────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Machine Learning Platform',
    service_name: 'SageMaker ml.m5.xlarge',
    unit: 'per hour',
    price_usd: 0.269,
    tier_label: 'On-Demand',
  },
  {
    provider: 'Azure',
    category: 'Machine Learning Platform',
    service_name: 'Azure ML DS3_v2',
    unit: 'per hour',
    price_usd: 0.251,
    tier_label: 'Pay-as-you-go',
  },
  {
    provider: 'GCP',
    category: 'Machine Learning Platform',
    service_name: 'Vertex AI n1-standard-4',
    unit: 'per hour',
    price_usd: 0.190,
    tier_label: 'On-Demand',
  },

  // ── 26. Backup & Disaster Recovery ────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'Backup & Disaster Recovery',
    service_name: 'AWS Backup',
    unit: 'per GB/month',
    price_usd: 0.05,
    tier_label: 'Standard',
  },
  {
    provider: 'Azure',
    category: 'Backup & Disaster Recovery',
    service_name: 'Azure Backup',
    unit: 'per GB/month',
    price_usd: 0.02,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'Backup & Disaster Recovery',
    service_name: 'Cloud Backup',
    unit: 'per GB/month',
    price_usd: 0.023,
    tier_label: 'Standard',
  },

  // ── 27. File Storage (NFS/SMB) ────────────────────────────────────────────
  {
    provider: 'AWS',
    category: 'File Storage (NFS/SMB)',
    service_name: 'Amazon EFS',
    unit: 'per GB/month',
    price_usd: 0.30,
    tier_label: 'Standard',
  },
  {
    provider: 'Azure',
    category: 'File Storage (NFS/SMB)',
    service_name: 'Azure Files',
    unit: 'per GB/month',
    price_usd: 0.06,
    tier_label: 'Standard',
  },
  {
    provider: 'GCP',
    category: 'File Storage (NFS/SMB)',
    service_name: 'Filestore',
    unit: 'per GB/month',
    price_usd: 0.20,
    tier_label: 'Standard',
  },
]

/**
 * Metadata about the dataset.
 */
export const DATASET_META = {
  last_updated: '2025-05-01',
}

/**
 * Provider color mapping used by both the SVG chart and the comparison table.
 */
export const PROVIDER_COLORS = {
  AWS: {
    bar: '#f97316',
    text: 'text-orange-400',
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/30',
  },
  Azure: {
    bar: '#3b82f6',
    text: 'text-blue-400',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
  },
  GCP: {
    bar: '#22c55e',
    text: 'text-green-400',
    bg: 'bg-green-500/15',
    border: 'border-green-500/30',
  },
}
