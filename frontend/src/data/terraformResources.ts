export const SUPPORTED_PROVIDERS = [
  { id: 'aws',        label: 'AWS Terraform',   icon: '🟠' },
  { id: 'azure',      label: 'Azure Terraform',  icon: '🔵' },
  { id: 'gcp',        label: 'GCP Terraform',    icon: '🔴' },
  { id: 'ansible',    label: 'Ansible',          icon: '⚙️' },
  { id: 'crossplane', label: 'Crossplane',       icon: '⎈' },
]

export function getProviderLabel(providerId) {
  const p = SUPPORTED_PROVIDERS.find(p => p.id === providerId)
  return p ? p.label : providerId
}
