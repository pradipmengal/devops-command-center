/**
 * diagramScanner.ts
 *
 * Scans architecture diagrams and extracts cloud resources → Terraform HCL.
 *
 * Strategies by file type:
 *  - Draw.io (.drawio/.xml) : parse XML shapes + labels  → high confidence
 *  - PNG / JPEG             : Tesseract.js OCR            → medium confidence
 *  - PDF                    : pdfjs-dist text extraction  → medium confidence
 */

const RESOURCE_MAPPINGS = [
  { keywords: ['ec2','amazon ec2','elastic compute','virtual machine','vm instance','web server','app server','application server','compute instance','t2.micro','t3.micro','t3.small','m5.large'],
    terraformType: 'aws_instance', provider: 'aws',
    defaultConfig: { ami: 'ami-0c55b159cbfafe1f0', instance_type: 't3.micro' } },
  { keywords: ['auto scaling','autoscaling','asg','auto scale group','scaling group'],
    terraformType: 'aws_autoscaling_group', provider: 'aws',
    defaultConfig: { min_size: 1, max_size: 3, desired_capacity: 2 } },
  { keywords: ['eks','elastic kubernetes','kubernetes cluster','k8s cluster','amazon eks'],
    terraformType: 'aws_eks_cluster', provider: 'aws',
    defaultConfig: { version: '1.29' } },
  { keywords: ['ecs','elastic container service','fargate','container service','amazon ecs'],
    terraformType: 'aws_ecs_cluster', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['lambda','aws lambda','serverless function','function as a service','faas'],
    terraformType: 'aws_lambda_function', provider: 'aws',
    defaultConfig: { runtime: 'nodejs18.x', handler: 'index.handler', memory_size: 128, timeout: 30 } },
  { keywords: ['elastic beanstalk','beanstalk','paas'],
    terraformType: 'aws_elastic_beanstalk_environment', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['s3','amazon s3','simple storage service','s3 bucket','object storage','bucket'],
    terraformType: 'aws_s3_bucket', provider: 'aws',
    defaultConfig: { force_destroy: false } },
  { keywords: ['ebs','elastic block store','block storage','ebs volume'],
    terraformType: 'aws_ebs_volume', provider: 'aws',
    defaultConfig: { size: 20, type: 'gp3' } },
  { keywords: ['efs','elastic file system','file storage','nfs','shared storage'],
    terraformType: 'aws_efs_file_system', provider: 'aws',
    defaultConfig: { performance_mode: 'generalPurpose' } },
  { keywords: ['glacier','archive storage','cold storage','long term storage'],
    terraformType: 'aws_glacier_vault', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['vpc','virtual private cloud','private network','isolated network'],
    terraformType: 'aws_vpc', provider: 'aws',
    defaultConfig: { cidr_block: '10.0.0.0/16', enable_dns_hostnames: true } },
  { keywords: ['subnet','private subnet','public subnet','sub network','availability zone'],
    terraformType: 'aws_subnet', provider: 'aws',
    defaultConfig: { cidr_block: '10.0.1.0/24' } },
  { keywords: ['security group','sg','firewall rules','inbound rules','outbound rules','network acl'],
    terraformType: 'aws_security_group', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['internet gateway','igw','internet access','public gateway'],
    terraformType: 'aws_internet_gateway', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['load balancer','alb','nlb','elb','elastic load balancer','application load balancer','network load balancer','lb'],
    terraformType: 'aws_lb', provider: 'aws',
    defaultConfig: { load_balancer_type: 'application', internal: false } },
  { keywords: ['nat gateway','nat','network address translation','private internet'],
    terraformType: 'aws_nat_gateway', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['cloudfront','cdn','content delivery network','edge location','distribution'],
    terraformType: 'aws_cloudfront_distribution', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['route 53','route53','dns','hosted zone','domain name','dns resolution'],
    terraformType: 'aws_route53_zone', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['api gateway','apigw','rest api','http api','api management','api endpoint'],
    terraformType: 'aws_api_gateway_rest_api', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['vpn gateway','vpn','virtual private network','site to site'],
    terraformType: 'aws_vpn_gateway', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['rds','relational database','amazon rds','mysql','postgres','postgresql','aurora','mariadb','sql database','database server','db instance'],
    terraformType: 'aws_rds_instance', provider: 'aws',
    defaultConfig: { engine: 'mysql', engine_version: '8.0', instance_class: 'db.t3.micro', allocated_storage: 20 } },
  { keywords: ['dynamodb','dynamo db','nosql','key value store','document database','amazon dynamodb'],
    terraformType: 'aws_dynamodb_table', provider: 'aws',
    defaultConfig: { billing_mode: 'PAY_PER_REQUEST' } },
  { keywords: ['elasticache','redis','memcached','cache','in memory','amazon elasticache'],
    terraformType: 'aws_elasticache_cluster', provider: 'aws',
    defaultConfig: { engine: 'redis', node_type: 'cache.t3.micro', num_cache_nodes: 1 } },
  { keywords: ['redshift','data warehouse','amazon redshift','analytics database','olap'],
    terraformType: 'aws_redshift_cluster', provider: 'aws',
    defaultConfig: { node_type: 'dc2.large', cluster_type: 'single-node' } },
  { keywords: ['sns','simple notification service','notification','pub sub','topic','amazon sns'],
    terraformType: 'aws_sns_topic', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['sqs','simple queue service','message queue','queue','amazon sqs'],
    terraformType: 'aws_sqs_queue', provider: 'aws',
    defaultConfig: { visibility_timeout_seconds: 30 } },
  { keywords: ['kinesis','data stream','streaming','amazon kinesis','real time stream'],
    terraformType: 'aws_kinesis_stream', provider: 'aws',
    defaultConfig: { shard_count: 1 } },
  { keywords: ['eventbridge','event bus','event driven','amazon eventbridge','events'],
    terraformType: 'aws_eventbridge_rule', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['iam role','iam','identity access management','service role','execution role','role'],
    terraformType: 'aws_iam_role', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['kms','key management service','encryption key','customer managed key','cmk'],
    terraformType: 'aws_kms_key', provider: 'aws',
    defaultConfig: { deletion_window_in_days: 30 } },
  { keywords: ['secrets manager','aws secrets','secret store','credentials store'],
    terraformType: 'aws_secretsmanager_secret', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['cognito','user pool','identity pool','authentication','user authentication','login'],
    terraformType: 'aws_cognito_user_pool', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['waf','web application firewall','wafv2','ddos protection'],
    terraformType: 'aws_wafv2_web_acl', provider: 'aws',
    defaultConfig: { scope: 'REGIONAL' } },
  { keywords: ['cloudwatch','cloud watch','monitoring','log group','metrics','alarms','aws logs'],
    terraformType: 'aws_cloudwatch_log_group', provider: 'aws',
    defaultConfig: { retention_in_days: 30 } },
  { keywords: ['cloudtrail','audit log','cloud trail','api audit'],
    terraformType: 'aws_cloudtrail', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['ecr','elastic container registry','container registry','docker registry','image registry'],
    terraformType: 'aws_ecr_repository', provider: 'aws',
    defaultConfig: { image_tag_mutability: 'MUTABLE' } },
  { keywords: ['codepipeline','code pipeline','ci cd','cicd','pipeline','continuous integration','continuous deployment'],
    terraformType: 'aws_codepipeline', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['sagemaker','machine learning','ml','artificial intelligence','ai model','amazon sagemaker'],
    terraformType: 'aws_sagemaker_endpoint', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['azure vm','azure virtual machine','windows vm','linux vm','azure compute'],
    terraformType: 'azurerm_linux_virtual_machine', provider: 'azure',
    defaultConfig: { size: 'Standard_B2s', admin_username: 'azureuser' } },
  { keywords: ['aks','azure kubernetes service','azure k8s','azure container'],
    terraformType: 'azurerm_kubernetes_cluster', provider: 'azure',
    defaultConfig: { node_count: 3, node_vm_size: 'Standard_D2s_v3' } },
  { keywords: ['azure storage','storage account','blob storage','azure blob','azure files'],
    terraformType: 'azurerm_storage_account', provider: 'azure',
    defaultConfig: { account_tier: 'Standard', account_replication_type: 'LRS' } },
  { keywords: ['vnet','azure vnet','virtual network','azure virtual network'],
    terraformType: 'azurerm_virtual_network', provider: 'azure',
    defaultConfig: { address_space: '10.0.0.0/16' } },
  { keywords: ['azure sql','sql database','azure database','mssql','azure db'],
    terraformType: 'azurerm_mssql_database', provider: 'azure',
    defaultConfig: { sku_name: 'S1' } },
  { keywords: ['cosmos db','cosmosdb','azure cosmos','cosmos','globally distributed'],
    terraformType: 'azurerm_cosmosdb_account', provider: 'azure',
    defaultConfig: { offer_type: 'Standard', kind: 'GlobalDocumentDB' } },
  { keywords: ['azure function','function app','azure functions','serverless azure'],
    terraformType: 'azurerm_linux_function_app', provider: 'azure',
    defaultConfig: {} },
  { keywords: ['key vault','azure key vault','azure secrets','azure encryption'],
    terraformType: 'azurerm_key_vault', provider: 'azure',
    defaultConfig: { sku_name: 'standard' } },
  { keywords: ['azure load balancer','azure lb','azure alb','azure traffic'],
    terraformType: 'azurerm_lb', provider: 'azure',
    defaultConfig: { sku: 'Standard' } },
  { keywords: ['acr','azure container registry','azure docker','azure images'],
    terraformType: 'azurerm_container_registry', provider: 'azure',
    defaultConfig: { sku: 'Standard' } },
  { keywords: ['compute engine','gce','google compute','gcp vm','google vm'],
    terraformType: 'google_compute_instance', provider: 'gcp',
    defaultConfig: { machine_type: 'e2-medium' } },
  { keywords: ['gke','google kubernetes engine','google k8s','gcp kubernetes'],
    terraformType: 'google_container_cluster', provider: 'gcp',
    defaultConfig: { node_count: 3, machine_type: 'e2-medium' } },
  { keywords: ['cloud run','google cloud run','gcp serverless','run service'],
    terraformType: 'google_cloud_run_v2_service', provider: 'gcp',
    defaultConfig: { min_instances: 0, max_instances: 10 } },
  { keywords: ['cloud storage','gcs','google storage','gcp bucket','google bucket'],
    terraformType: 'google_storage_bucket', provider: 'gcp',
    defaultConfig: { storage_class: 'STANDARD' } },
  { keywords: ['cloud sql','gcp sql','google sql','gcp database','google database'],
    terraformType: 'google_sql_database_instance', provider: 'gcp',
    defaultConfig: { database_version: 'MYSQL_8_0', tier: 'db-f1-micro' } },
  { keywords: ['firestore','google firestore','gcp nosql','cloud firestore'],
    terraformType: 'google_firestore_database', provider: 'gcp',
    defaultConfig: {} },
  { keywords: ['cloud functions','google cloud functions','gcp function','cloud function'],
    terraformType: 'google_cloudfunctions2_function', provider: 'gcp',
    defaultConfig: { runtime: 'nodejs18' } },
  { keywords: ['google vpc','gcp vpc','google network','compute network','gcp network'],
    terraformType: 'google_compute_network', provider: 'gcp',
    defaultConfig: { auto_create_subnetworks: false } },
  { keywords: ['artifact registry','google artifact','gcp registry','google container registry'],
    terraformType: 'google_artifact_registry_repository', provider: 'gcp',
    defaultConfig: { format: 'DOCKER' } },
  { keywords: ['bigquery','big query','gcp analytics','google analytics','data warehouse gcp'],
    terraformType: 'google_bigquery_dataset', provider: 'gcp',
    defaultConfig: { location: 'US' } },
  { keywords: ['pub sub','pubsub','google pubsub','gcp messaging','cloud pub sub'],
    terraformType: 'google_pubsub_topic', provider: 'gcp',
    defaultConfig: {} },
];

function detectProvider(text) {
  const t = text.toLowerCase();
  const awsScore = (t.match(/\b(aws|amazon|ec2|s3|rds|lambda|vpc|iam|eks|ecs|sqs|sns|cloudwatch|cloudfront|route\s*53|dynamodb|elasticache|redshift|kinesis|fargate|beanstalk|cognito|kms|waf|cloudtrail|sagemaker|glue|athena|emr|ecr|codepipeline|aurora|elastic)\b/g) || []).length;
  const azureScore = (t.match(/\b(azure|azurerm|microsoft|aks|vnet|blob|cosmos|keyvault|mssql|acr|function\s*app|logic\s*app|service\s*bus|azure\s*sql|azure\s*storage|azure\s*vm)\b/g) || []).length;
  const gcpScore = (t.match(/\b(gcp|google|gke|gce|gcs|bigquery|pubsub|cloud\s*run|cloud\s*sql|firestore|spanner|dataflow|artifact\s*registry|cloud\s*function|compute\s*engine)\b/g) || []).length;

  const max = Math.max(awsScore, azureScore, gcpScore);
  if (max === 0) return 'unknown';
  if (awsScore === max) return 'aws';
  if (azureScore === max) return 'azure';
  return 'gcp';
}

function matchLabel(label) {
  const lower = label.toLowerCase().trim();
  if (!lower || lower.length < 2) return null;

  let best = null;

  for (const mapping of RESOURCE_MAPPINGS) {
    for (const kw of mapping.keywords) {
      if (lower.includes(kw) || kw.includes(lower)) {
        const score = kw.length + (lower === kw ? 100 : 0);
        if (!best || score > best.score) best = { mapping, score };
      }
    }
  }
  return best?.mapping ?? null;
}

function toSafeName(label, index) {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30) || `resource_${index}`;
  return `${base}_${index + 1}`;
}

function buildDetectedResource(
  label,
  mapping,
  index,
  confidence,
) {
  return {
    id: `detected_${index}`,
    label,
    terraformType: mapping.terraformType,
    provider: mapping.provider,
    confidence,
    suggestedName: toSafeName(label, index),
    config: { ...mapping.defaultConfig, tags_name: toSafeName(label, index) },
  };
}

function extractResourcesFromText(
  text,
  fileType,
) {
  const rawCandidates = text
    .split(/[\n\r,;|/\\]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 120);

  const words = text.toLowerCase().split(/\s+/);
  const windowCandidates = [];
  for (let i = 0; i < words.length; i++) {
    for (let len = 1; len <= 4; len++) {
      if (i + len <= words.length) {
        windowCandidates.push(words.slice(i, i + len).join(' '));
      }
    }
  }

  const allCandidates = [...rawCandidates, ...windowCandidates];
  const rawLabels = [...new Set(rawCandidates)];

  const seen = new Set();
  const resources = [];
  let idx = 0;

  for (const candidate of allCandidates) {
    const mapping = matchLabel(candidate);
    if (!mapping) continue;

    const key = mapping.terraformType;
    if (seen.has(key)) continue;
    seen.add(key);

    const lower = candidate.toLowerCase();
    const isHighConf = mapping.keywords.some(
      (kw) => lower === kw || lower.startsWith(kw + ' ') || lower.endsWith(' ' + kw),
    );
    const confidence =
      isHighConf ? (fileType === 'drawio' ? 'high' : 'medium')
      : fileType === 'drawio' ? 'medium'
      : 'low';

    resources.push(buildDetectedResource(candidate, mapping, idx++, confidence));
  }

  return { resources, rawLabels };
}

function parseDrawio(xmlText) {
  const labels = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    doc.querySelectorAll('mxCell').forEach((cell) => {
      const value = cell.getAttribute('value') ?? '';
      const style = cell.getAttribute('style') ?? '';
      const clean = value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      if (clean.length > 1) labels.push(clean);

      const shapeMatch = style.match(/shape=([^;]+)/);
      if (shapeMatch) {
        const shapeName = shapeMatch[1]
          .replace(/mxgraph\.[^.]+\./g, '')
          .replace(/[._]/g, ' ')
          .trim();
        if (shapeName.length > 1) labels.push(shapeName);
      }
    });

    doc.querySelectorAll('UserObject').forEach((obj) => {
      const label = obj.getAttribute('label') ?? '';
      const clean = label.replace(/<[^>]+>/g, ' ').trim();
      if (clean.length > 1) labels.push(clean);
    });
  } catch { /* ignore */ }

  return [...new Set(labels)].join('\n');
}

async function ocrImage(file) {
  const Tesseract = await import('tesseract.js');

  const worker = await Tesseract.createWorker('eng', 1, {
    logger: () => {},
  });

  try {
    const url = URL.createObjectURL(file);
    const result = await worker.recognize(url);
    URL.revokeObjectURL(url);
    return result.data.text ?? '';
  } finally {
    await worker.terminate();
  }
}

async function extractPdfText(file) {
  const pdfjsLib = await import('pdfjs-dist');

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n');
}

export function generateTerraformFromDetected(
  resources,
  provider,
  region,
) {
  if (resources.length === 0) {
    return [
      '# No cloud resources were detected in the diagram.',
      '# Tips:',
      '#  - For images: make sure service names are clearly visible as text',
      '#  - For PDFs: ensure the PDF contains selectable text (not a scanned image)',
      '#  - For Draw.io: label each shape with the service name',
    ].join('\n') + '\n';
  }

  const lines = [];
  lines.push('# ================================================================');
  lines.push('# Terraform — generated from architecture diagram scan');
  lines.push(`# Provider  : ${provider.toUpperCase()}`);
  lines.push(`# Resources : ${resources.length}`);
  lines.push('# ⚠  Review all placeholder values before applying');
  lines.push('# ================================================================');
  lines.push('');

  if (provider === 'aws') {
    lines.push(`terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${region}"
}
`);
  } else if (provider === 'azure') {
    lines.push(`terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}
`);
  } else if (provider === 'gcp') {
    lines.push(`terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "YOUR_PROJECT_ID"
  region  = "${region}"
}
`);
  } else {
    lines.push(`# Provider could not be determined — defaulting to AWS
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${region}"
}
`);
  }

  for (const res of resources) {
    lines.push(`# Detected: "${res.label}" (confidence: ${res.confidence})`);
    lines.push(`resource "${res.terraformType}" "${res.suggestedName}" {`);
    for (const [key, val] of Object.entries(res.config)) {
      if (key === 'tags_name') continue;
      if (typeof val === 'string') lines.push(`  ${key} = "${val}"`);
      else if (typeof val === 'boolean') lines.push(`  ${key} = ${val}`);
      else lines.push(`  ${key} = ${val}`);
    }
    if (provider === 'aws' || provider === 'unknown') {
      lines.push(`  tags = {`);
      lines.push(`    Name      = "${res.suggestedName}"`);
      lines.push(`    ManagedBy = "Terraform"`);
      lines.push(`    Source    = "diagram-scan"`);
      lines.push(`  }`);
    }
    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n');
}

export async function scanDiagram(file) {
  const fileName = file.name;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const warnings = [];
  let extractedText = '';
  let fileType = 'image';

  if (ext === 'drawio' || ext === 'xml') {
    fileType = 'drawio';
    const xmlText = await file.text();
    extractedText = parseDrawio(xmlText);
    if (!extractedText.trim()) {
      warnings.push('No labelled shapes found in the Draw.io file. Make sure shapes have text labels.');
    }

  } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
    fileType = 'image';
    try {
      extractedText = await ocrImage(file);
      if (!extractedText.trim()) {
        warnings.push('OCR found no readable text. The image may be too low-resolution or contain only icons without labels.');
      }
    } catch (err) {
      warnings.push(`OCR failed: ${err instanceof Error ? err.message : String(err)}. Falling back to filename analysis.`);
      extractedText = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    }

  } else if (ext === 'pdf') {
    fileType = 'pdf';
    try {
      extractedText = await extractPdfText(file);
      if (!extractedText.trim()) {
        warnings.push('No text found in PDF. It may be a scanned image PDF — try exporting as PNG first.');
      }
    } catch (err) {
      warnings.push(`PDF extraction failed: ${err instanceof Error ? err.message : String(err)}.`);
      extractedText = '';
    }

  } else {
    warnings.push(`Unsupported file type ".${ext}". Please upload PNG, JPEG, PDF, or .drawio files.`);
    return { provider: 'unknown', resources: [], rawLabels: [], warnings, fileName, fileType: 'image' };
  }

  const provider = detectProvider(extractedText);

  const { resources, rawLabels } = extractResourcesFromText(extractedText, fileType);

  if (resources.length === 0) {
    if (fileType === 'image' || fileType === 'pdf') {
      warnings.push(
        'Could not detect specific services from the extracted text. ' +
        'Generating a standard 3-tier AWS architecture as a starting template.',
      );
      const fallback = ['vpc', 'public subnet', 'private subnet', 'load balancer', 'ec2', 'rds', 'security group', 'internet gateway'];
      let idx = 0;
      for (const lbl of fallback) {
        const mapping = matchLabel(lbl);
        if (mapping) resources.push(buildDetectedResource(lbl, mapping, idx++, 'low'));
      }
    } else {
      warnings.push('No recognisable cloud resources detected. Make sure shapes are labelled with service names.');
    }
  }

  return { provider, resources, rawLabels, warnings, fileName, fileType, extractedText };
}
