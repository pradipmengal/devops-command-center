import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

const PLACEHOLDER = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: my-app:latest`

export default function K8sPage() {
  const [yamlContent, setYamlContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!yamlContent.trim()) { setError('Please enter YAML content to validate.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/k8s/validate', { yaml_content: yamlContent })
      if (data.status === 'success') {
        const { valid, suggestions } = data.data
        let out = valid ? '✅ Valid Kubernetes YAML\n' : '❌ Invalid YAML\n'
        if (suggestions?.length) {
          out += '\n💡 Best Practice Suggestions:\n'
          suggestions.forEach((s, i) => { out += `  ${i + 1}. ${s}\n` })
        } else if (valid) {
          out += '\n✓ No suggestions — looks great!'
        }
        setResult(out)
      } else {
        setError(`❌ Invalid YAML\n\n${data.data?.error ?? data.data?.message ?? 'Validation failed'}`)
      }
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="☸️" title="Kubernetes YAML Validator" description="Validate your K8s manifests and get actionable best-practice suggestions before applying to a cluster." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="yaml-content" className="label">Kubernetes YAML</label>
            <textarea id="yaml-content" value={yamlContent} onChange={e => setYamlContent(e.target.value)}
              placeholder={PLACEHOLDER} rows={14}
              className="input-field font-mono resize-y" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Validating...' : 'Validate YAML'}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
