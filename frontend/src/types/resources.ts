/**
 * @typedef {'aws_instance'|'aws_autoscaling_group'|'aws_launch_template'|'aws_eks_cluster'|'aws_eks_node_group'|'aws_ecs_cluster'|'aws_ecs_task_definition'|'aws_ecs_service'|'aws_elastic_beanstalk_environment'|'aws_s3_bucket'|'aws_ebs_volume'|'aws_efs_file_system'|'aws_fsx_lustre_file_system'|'aws_glacier_vault'|'aws_vpc'|'aws_subnet'|'aws_security_group'|'aws_internet_gateway'|'aws_lb'|'aws_route_table'|'aws_nat_gateway'|'aws_eip'|'aws_vpc_peering_connection'|'aws_cloudfront_distribution'|'aws_route53_zone'|'aws_route53_record'|'aws_api_gateway_rest_api'|'aws_apigatewayv2_api'|'aws_vpn_gateway'|'aws_dx_connection'|'aws_rds_instance'|'aws_rds_cluster'|'aws_dynamodb_table'|'aws_elasticache_cluster'|'aws_elasticache_replication_group'|'aws_redshift_cluster'|'aws_neptune_cluster'|'aws_docdb_cluster'|'aws_timestream_database'|'aws_lambda_function'|'aws_sns_topic'|'aws_sqs_queue'|'aws_kinesis_stream'|'aws_kinesis_firehose_delivery_stream'|'aws_eventbridge_rule'|'aws_sfn_state_machine'|'aws_mq_broker'|'aws_iam_role'|'aws_iam_policy'|'aws_iam_user'|'aws_iam_group'|'aws_kms_key'|'aws_secretsmanager_secret'|'aws_ssm_parameter'|'aws_wafv2_web_acl'|'aws_shield_protection'|'aws_cognito_user_pool'|'aws_acm_certificate'|'aws_cloudwatch_log_group'|'aws_cloudwatch_metric_alarm'|'aws_cloudtrail'|'aws_config_configuration_recorder'|'aws_codepipeline'|'aws_codebuild_project'|'aws_codecommit_repository'|'aws_ecr_repository'|'aws_sagemaker_endpoint'|'aws_sagemaker_model'|'aws_athena_workgroup'|'aws_glue_job'|'aws_emr_cluster'|'azurerm_linux_virtual_machine'|'azurerm_kubernetes_cluster'|'azurerm_storage_account'|'azurerm_virtual_network'|'azurerm_subnet'|'azurerm_network_security_group'|'azurerm_lb'|'azurerm_mssql_database'|'azurerm_cosmosdb_account'|'azurerm_linux_function_app'|'azurerm_key_vault'|'azurerm_container_registry'|'azurerm_log_analytics_workspace'|'google_compute_instance'|'google_container_cluster'|'google_cloud_run_v2_service'|'google_storage_bucket'|'google_compute_network'|'google_compute_subnetwork'|'google_compute_firewall'|'google_compute_forwarding_rule'|'google_sql_database_instance'|'google_firestore_database'|'google_cloudfunctions2_function'|'google_service_account'|'google_logging_project_sink'|'google_artifact_registry_repository'} ResourceType
 */

/**
 * @typedef {Object} ResourceField
 * @property {string} key
 * @property {string} label
 * @property {'text'|'select'|'number'|'boolean'|'textarea'} type
 * @property {string|number|boolean} [default]
 * @property {string[]} [options]
 * @property {boolean} [required]
 * @property {string} [placeholder]
 */

/**
 * @typedef {Object} ResourcePort
 * @property {string} id
 * @property {string} label
 * @property {'left'|'right'} side
 * @property {'target'|'source'} type
 * @property {string} color
 * @property {ResourceType[]} [accepts]
 */

/**
 * @typedef {Object} ResourceDefinition
 * @property {ResourceType} type
 * @property {string} label
 * @property {string} icon
 * @property {string} color
 * @property {string} bgColor
 * @property {string} borderColor
 * @property {'Compute'|'Storage'|'Network'|'Database'|'Serverless'|'Messaging'|'Security'|'IAM'|'Monitoring'|'DevOps'|'Analytics'|'AI/ML'|'Containers'|'Integration'} category
 * @property {ResourceField[]} fields
 * @property {string} description
 * @property {ResourcePort[]} ports
 */

/**
 * @typedef {Object} ResourceNodeData
 * @property {ResourceType} resourceType
 * @property {string} resourceName
 * @property {Object.<string, string|number|boolean>} config
 * @property {ResourceDefinition} definition
 */

export const ResourceTypes = {}

export function isAWS(type) {
  return typeof type === 'string' && type.startsWith('aws_')
}

export function isAzure(type) {
  return typeof type === 'string' && type.startsWith('azurerm_')
}

export function isGCP(type) {
  return typeof type === 'string' && type.startsWith('google_')
}

export function isAnsible(type) {
  return typeof type === 'string' && type.startsWith('ansible_')
}

export function isCrossplane(type) {
  return typeof type === 'string' && type.includes('crossplane')
}

export function categorizeResource(resourceType) {
  if (isAWS(resourceType)) return 'aws'
  if (isAzure(resourceType)) return 'azure'
  if (isGCP(resourceType)) return 'gcp'
  if (isAnsible(resourceType)) return 'ansible'
  if (isCrossplane(resourceType)) return 'crossplane'
  return 'unknown'
}
