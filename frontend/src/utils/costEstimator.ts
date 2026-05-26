const COST_TABLE = {
  aws_instance: (cfg) => {
    const prices = {
      't2.micro': [8.5, 8.5], 't2.small': [17, 17], 't2.medium': [34, 34],
      't3.micro': [7.6, 7.6], 't3.small': [15, 15], 't3.medium': [30, 30],
      't3.large': [60, 60], 'm5.large': [70, 70], 'm5.xlarge': [140, 140],
      'c5.large': [62, 62], 'c5.xlarge': [124, 124], 'r5.large': [91, 91],
    };
    const it = String(cfg.instance_type || 't2.micro');
    const [min, max] = prices[it] || [30, 200];
    const storage = Number(cfg.root_volume_size || 20) * 0.08;
    return { min: min + storage, max: max + storage, basis: `${it} + ${cfg.root_volume_size || 20}GB EBS` };
  },
  aws_autoscaling_group: (cfg) => {
    const desired = Number(cfg.desired_capacity || 2);
    return { min: desired * 7.6, max: Number(cfg.max_size || 3) * 70, basis: `${cfg.min_size || 1}–${cfg.max_size || 3} instances` };
  },
  aws_eks_cluster: () => ({ min: 73, max: 73, basis: 'Cluster control plane ($0.10/hr)' }),
  aws_eks_node_group: (cfg) => {
    const desired = Number(cfg.desired_size || 2);
    return { min: desired * 30, max: Number(cfg.max_size || 4) * 70, basis: `${desired} nodes` };
  },
  aws_ecs_cluster: () => ({ min: 0, max: 0, basis: 'Cluster free (pay per task)' }),
  aws_ecs_service: (cfg) => {
    const count = Number(cfg.desired_count || 2);
    const cpu = Number(String(cfg.cpu || '256').replace(/[^0-9]/g, '')) / 1024;
    const mem = Number(String(cfg.memory || '512').replace(/[^0-9]/g, '')) / 1024;
    const cpuCost = cpu * 0.04048 * 730;
    const memCost = mem * 0.004445 * 730;
    return { min: count * (cpuCost + memCost), max: count * (cpuCost + memCost) * 2, basis: `${count} Fargate tasks` };
  },
  aws_s3_bucket: (cfg) => {
    const base = cfg.versioning_enabled ? 2 : 0.5;
    return { min: base, max: 50, basis: 'Storage + requests (usage-based)' };
  },
  aws_ebs_volume: (cfg) => {
    const size = Number(cfg.size || 100);
    const prices = { gp3: 0.08, gp2: 0.1, io1: 0.125, io2: 0.125, st1: 0.045, sc1: 0.025 };
    const rate = prices[String(cfg.type || 'gp3')] || 0.08;
    return { min: size * rate, max: size * rate, basis: `${size}GB ${cfg.type || 'gp3'}` };
  },
  aws_efs_file_system: () => ({ min: 3, max: 100, basis: '$0.30/GB-month (usage-based)' }),
  aws_rds_instance: (cfg) => {
    const prices = {
      'db.t3.micro': [15, 15], 'db.t3.small': [30, 30], 'db.t3.medium': [60, 60],
      'db.t3.large': [120, 120], 'db.m5.large': [138, 138], 'db.m5.xlarge': [276, 276],
      'db.r5.large': [175, 175],
    };
    const ic = String(cfg.instance_class || 'db.t3.micro');
    const [min, max] = prices[ic] || [15, 300];
    const storage = Number(cfg.allocated_storage || 20) * 0.115;
    const multiAz = cfg.multi_az ? 2 : 1;
    return { min: (min + storage) * multiAz, max: (max + storage) * multiAz, basis: `${ic}${cfg.multi_az ? ' Multi-AZ' : ''}` };
  },
  aws_rds_cluster: (cfg) => {
    const engine = String(cfg.engine || 'aurora-mysql');
    const base = engine.includes('postgresql') ? 65 : 55;
    return { min: base, max: base * 3, basis: `Aurora ${engine} cluster` };
  },
  aws_dynamodb_table: (cfg) => {
    if (cfg.billing_mode === 'PROVISIONED') {
      const rcu = Number(cfg.read_capacity || 5) * 0.00013 * 730;
      const wcu = Number(cfg.write_capacity || 5) * 0.00065 * 730;
      return { min: rcu + wcu, max: rcu + wcu + 5, basis: `${cfg.read_capacity || 5} RCU + ${cfg.write_capacity || 5} WCU` };
    }
    return { min: 0.5, max: 50, basis: 'On-demand (usage-based)' };
  },
  aws_elasticache_cluster: (cfg) => {
    const prices = {
      'cache.t3.micro': 12, 'cache.t3.small': 24, 'cache.t3.medium': 48,
      'cache.r6g.large': 110, 'cache.r6g.xlarge': 220,
    };
    const nt = String(cfg.node_type || 'cache.t3.micro');
    const nodes = Number(cfg.num_cache_nodes || 1);
    const cost = (prices[nt] || 12) * nodes;
    return { min: cost, max: cost, basis: `${nodes}x ${nt}` };
  },
  aws_elasticache_replication_group: (cfg) => {
    const prices = {
      'cache.t3.medium': 48, 'cache.r6g.large': 110, 'cache.r6g.xlarge': 220,
    };
    const nt = String(cfg.node_type || 'cache.r6g.large');
    const nodes = Number(cfg.num_cache_clusters || 2);
    const cost = (prices[nt] || 110) * nodes;
    return { min: cost, max: cost, basis: `${nodes}x ${nt} HA` };
  },
  aws_redshift_cluster: (cfg) => {
    const prices = {
      'dc2.large': 180, 'dc2.8xlarge': 4800, 'ra3.xlplus': 1060, 'ra3.4xlarge': 3540,
    };
    const nt = String(cfg.node_type || 'dc2.large');
    const nodes = Number(cfg.number_of_nodes || 1);
    const cost = (prices[nt] || 180) * nodes;
    return { min: cost, max: cost, basis: `${nodes}x ${nt}` };
  },
  aws_lambda_function: (cfg) => {
    const mem = Number(cfg.memory_size || 128) / 1024;
    const base = mem * 0.0000166667 * 1000000 * 0.2;
    return { min: 0, max: Math.max(base, 5), basis: 'First 1M requests free, then usage-based' };
  },
  aws_sns_topic: () => ({ min: 0, max: 5, basis: 'First 1M publishes free' }),
  aws_sqs_queue: () => ({ min: 0, max: 5, basis: 'First 1M requests free' }),
  aws_kinesis_stream: (cfg) => {
    const shards = Number(cfg.shard_count || 1);
    return { min: shards * 15, max: shards * 15 + 10, basis: `${shards} shard(s) @ $0.015/hr` };
  },
  aws_lb: (cfg) => {
    const type = String(cfg.load_balancer_type || 'application');
    const base = type === 'network' ? 16 : 18;
    return { min: base, max: base + 20, basis: `${type} LB + LCU charges` };
  },
  aws_vpc: () => ({ min: 0, max: 0, basis: 'VPC is free' }),
  aws_subnet: () => ({ min: 0, max: 0, basis: 'Subnets are free' }),
  aws_internet_gateway: () => ({ min: 0, max: 5, basis: 'Free + data transfer' }),
  aws_nat_gateway: () => ({ min: 32, max: 50, basis: '$0.045/hr + $0.045/GB data' }),
  aws_eip: () => ({ min: 0, max: 3.6, basis: 'Free when attached, $0.005/hr idle' }),
  aws_cloudfront_distribution: () => ({ min: 1, max: 100, basis: 'Usage-based (requests + transfer)' }),
  aws_route53_zone: () => ({ min: 0.5, max: 0.5, basis: '$0.50/hosted zone/month' }),
  aws_api_gateway_rest_api: () => ({ min: 0, max: 20, basis: '$3.50/million API calls' }),
  aws_apigatewayv2_api: () => ({ min: 0, max: 10, basis: '$1.00/million HTTP API calls' }),
  aws_iam_role: () => ({ min: 0, max: 0, basis: 'IAM is free' }),
  aws_iam_policy: () => ({ min: 0, max: 0, basis: 'IAM is free' }),
  aws_kms_key: () => ({ min: 1, max: 1, basis: '$1/key/month + $0.03/10K API calls' }),
  aws_secretsmanager_secret: () => ({ min: 0.4, max: 0.4, basis: '$0.40/secret/month' }),
  aws_cloudwatch_log_group: (cfg) => {
    const ret = Number(cfg.retention_in_days || 30);
    return { min: 0.5, max: 10, basis: `$0.50/GB ingested, ${ret}d retention` };
  },
  aws_cloudwatch_metric_alarm: () => ({ min: 0.1, max: 0.1, basis: '$0.10/alarm/month' }),
  aws_ecr_repository: () => ({ min: 0.1, max: 5, basis: '$0.10/GB-month storage' }),
  aws_sagemaker_endpoint: (cfg) => {
    const prices = {
      'ml.t2.medium': 56, 'ml.t2.large': 112, 'ml.m5.large': 96,
      'ml.m5.xlarge': 192, 'ml.g4dn.xlarge': 526,
    };
    const it = String(cfg.instance_type || 'ml.t2.medium');
    const count = Number(cfg.initial_instance_count || 1);
    const cost = (prices[it] || 56) * count;
    return { min: cost, max: cost, basis: `${count}x ${it}` };
  },
  aws_emr_cluster: (cfg) => {
    const masterPrices = { 'm5.xlarge': 140, 'm5.2xlarge': 280, 'r5.xlarge': 182 };
    const corePrices = { 'm5.xlarge': 140, 'm5.2xlarge': 280, 'c5.xlarge': 124 };
    const master = masterPrices[String(cfg.master_instance_type || 'm5.xlarge')] || 140;
    const core = (corePrices[String(cfg.core_instance_type || 'm5.xlarge')] || 140) * Number(cfg.core_instance_count || 2);
    return { min: master + core, max: (master + core) * 1.5, basis: `1 master + ${cfg.core_instance_count || 2} core nodes` };
  },
  aws_glue_job: (cfg) => {
    const workers = Number(cfg.number_of_workers || 2);
    return { min: workers * 0.44 * 10, max: workers * 0.44 * 100, basis: `${workers} workers (usage-based)` };
  },
  aws_wafv2_web_acl: () => ({ min: 5, max: 15, basis: '$5/ACL/month + $1/rule + requests' }),
  aws_cognito_user_pool: () => ({ min: 0, max: 50, basis: 'First 50K MAU free, then $0.0055/MAU' }),
  aws_acm_certificate: () => ({ min: 0, max: 0, basis: 'ACM certificates are free' }),
  aws_sfn_state_machine: () => ({ min: 0, max: 10, basis: '$0.025/1K state transitions' }),
  aws_mq_broker: (cfg) => {
    const prices = { 'mq.t3.micro': 18, 'mq.m5.large': 110, 'mq.m5.xlarge': 220 };
    const it = String(cfg.host_instance_type || 'mq.t3.micro');
    return { min: prices[it] || 18, max: (prices[it] || 18) * 2, basis: it };
  },

  // ── Azure ─────────────────────────────────────────────────────────────────
  azurerm_linux_virtual_machine: (cfg) => {
    const prices = { 'Standard_B1s': [7, 7], 'Standard_B2s': [15, 15], 'Standard_B4ms': [50, 50], 'Standard_D2s_v3': [70, 70], 'Standard_D4s_v3': [140, 140], 'Standard_E2s_v3': [120, 120], 'Standard_F4s_v2': [100, 100] };
    const size = String(cfg.size || 'Standard_B2s');
    const [min, max] = prices[size] || [15, 100];
    const storage = Number(cfg.os_disk_size_gb || 30) * 0.08;
    return { min: min + storage, max: max + storage, basis: `${size} + ${cfg.os_disk_size_gb || 30}GB managed disk` };
  },
  azurerm_kubernetes_cluster: (cfg) => {
    const nodeCount = Number(cfg.default_node_pool_node_count || 3);
    const vmSize = String(cfg.default_node_pool_vm_size || 'Standard_D2s_v3');
    const nodeCost = vmSize.includes('D4') ? 140 : vmSize.includes('D8') ? 280 : 70;
    return { min: nodeCount * nodeCost + 75, max: nodeCount * nodeCost + 75, basis: `${nodeCount}x ${vmSize} + control plane ($0.10/hr)` };
  },
  azurerm_storage_account: (cfg) => {
    const base = cfg.account_kind === 'BlobStorage' ? 1 : 2;
    return { min: base, max: base + 10, basis: 'Storage + data transfer (usage-based)' };
  },
  azurerm_virtual_network: () => ({ min: 0, max: 0, basis: 'VNet is free (up to 50 address spaces)' }),
  azurerm_subnet: () => ({ min: 0, max: 0, basis: 'Subnets are free' }),
  azurerm_network_security_group: () => ({ min: 0, max: 0, basis: 'NSG is free' }),
  azurerm_lb: (cfg) => {
    const sku = String(cfg.sku || 'Standard');
    const base = sku === 'Basic' ? 0 : 18;
    return { min: base, max: base + 15, basis: `${sku} Load Balancer + data processing` };
  },
  azurerm_mssql_database: (cfg) => {
    const tier = String(cfg.sku_name || 'S0');
    const prices = { 'S0': [15, 15], 'S1': [30, 30], 'S2': [60, 60], 'S3': [120, 120], 'GP_S_Gen5_1': [35, 35], 'GP_Gen5_2': [300, 300], 'BC_Gen5_2': [800, 800] };
    const [min, max] = prices[tier] || [15, 100];
    return { min, max, basis: `Azure SQL ${tier}` };
  },
  azurerm_cosmosdb_account: () => ({ min: 24, max: 200, basis: 'RU/s based (min ~$24/mo for 400 RU/s serverless)' }),
  azurerm_linux_function_app: (cfg) => {
    const plan = String(cfg.plan_type || 'consumption');
    if (plan === 'consumption') return { min: 0, max: 5, basis: 'Consumption plan (pay per execution)' };
    const sku = String(cfg.sku || 'EP1');
    const prices = { 'EP1': [75, 75], 'EP2': [150, 150], 'EP3': [300, 300] };
    const cost = prices[sku] || 75;
    return { min: cost, max: cost, basis: `Premium plan ${sku}` };
  },
  azurerm_key_vault: () => ({ min: 0, max: 0, basis: 'Key Vault free tier available ($0.03/10K ops for standard)' }),
  azurerm_container_registry: (cfg) => {
    const sku = String(cfg.sku || 'Basic');
    const prices = { 'Basic': [0, 0], 'Standard': [24, 24], 'Premium': [100, 100] };
    const cost = prices[sku] || 0;
    return { min: cost, max: cost + 5, basis: `ACR ${sku} tier` };
  },
  azurerm_log_analytics_workspace: () => ({ min: 0, max: 10, basis: '$2/GB data ingested (first 5GB free)' }),

  // ── GCP ──────────────────────────────────────────────────────────────────
  google_compute_instance: (cfg) => {
    const prices = { 'e2-micro': [5, 5], 'e2-small': [10, 10], 'e2-medium': [20, 20], 'e2-standard-2': [40, 40], 'e2-standard-4': [80, 80], 'n1-standard-1': [25, 25], 'n1-standard-2': [50, 50], 'n2-standard-2': [60, 60], 'c2-standard-4': [150, 150] };
    const mt = String(cfg.machine_type || 'e2-medium');
    const [min, max] = prices[mt] || [20, 100];
    const storage = Number(cfg.disk_size_gb || 50) * 0.04;
    return { min: min + storage, max: max + storage, basis: `${mt} + ${cfg.disk_size_gb || 50}GB pd-balanced` };
  },
  google_container_cluster: (cfg) => {
    const nodeCount = Number(cfg.node_count || 3);
    return { min: nodeCount * 20 + 0, max: nodeCount * 60 + 0, basis: `GKE cluster: ${nodeCount} nodes (control plane free)` };
  },
  google_cloud_run_v2_service: () => ({ min: 0, max: 10, basis: 'Pay-per-use (first 2M free monthly)' }),
  google_storage_bucket: (cfg) => {
    const cls = String(cfg.storage_class || 'STANDARD');
    const base = cls === 'NEARLINE' ? 0.5 : cls === 'COLDLINE' ? 0.2 : cls === 'ARCHIVE' ? 0.1 : 1;
    return { min: base, max: base + 10, basis: `${cls} storage + operations` };
  },
  google_compute_network: () => ({ min: 0, max: 0, basis: 'VPC network is free' }),
  google_compute_subnetwork: () => ({ min: 0, max: 0, basis: 'Subnets are free' }),
  google_compute_firewall: () => ({ min: 0, max: 0, basis: 'Firewall rules are free' }),
  google_compute_forwarding_rule: () => ({ min: 18, max: 18, basis: 'Forwarding rule ~$18/mo' }),
  google_sql_database_instance: (cfg) => {
    const tier = String(cfg.database_version || 'POSTGRES_14');
    const prices = { 'db-f1-micro': [7, 7], 'db-g1-small': [15, 15], 'db-n1-standard-1': [50, 50], 'db-n1-standard-2': [100, 100] };
    const dt = String(cfg.tier || 'db-f1-micro');
    const [min, max] = prices[dt] || [7, 100];
    const storage = Number(cfg.disk_size || 10) * 0.17;
    return { min: min + storage, max: max + storage, basis: `${tier} on ${dt} + ${cfg.disk_size || 10}GB SSD` };
  },
  google_firestore_database: () => ({ min: 0, max: 10, basis: 'Pay-per-use (1GB free, $1/GiB stored)' }),
  google_cloudfunctions2_function: () => ({ min: 0, max: 3, basis: 'Pay-per-invocation (first 2M free)' }),
  google_service_account: () => ({ min: 0, max: 0, basis: 'Service accounts are free' }),
  google_logging_project_sink: () => ({ min: 0, max: 5, basis: '$0.50/GB ingested (first 50GB free)' }),
  google_artifact_registry_repository: () => ({ min: 0, max: 5, basis: '$0.10/GB-month storage' }),
};

export function estimateCosts(nodes) {
  const items = [];

  for (const node of nodes) {
    const { resourceType, resourceName, config, definition } = node.data;
    const estimator = COST_TABLE[resourceType];

    if (estimator) {
      const { min, max, basis } = estimator(config);
      items.push({
        resourceType,
        resourceName,
        label: definition.label,
        icon: definition.icon,
        monthlyMin: Math.round(min * 100) / 100,
        monthlyMax: Math.round(max * 100) / 100,
        basis,
      });
    } else {
      items.push({
        resourceType,
        resourceName,
        label: definition.label,
        icon: definition.icon,
        monthlyMin: 0,
        monthlyMax: 0,
        basis: 'Pricing varies',
      });
    }
  }

  const totalMin = items.reduce((s, i) => s + i.monthlyMin, 0);
  const totalMax = items.reduce((s, i) => s + i.monthlyMax, 0);

  return {
    items,
    totalMin: Math.round(totalMin * 100) / 100,
    totalMax: Math.round(totalMax * 100) / 100,
    currency: 'USD',
  };
}
