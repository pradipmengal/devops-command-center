import React, { useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import OutputPanel from '../components/OutputPanel'

function format_name_parts(parts) {
  return parts.map(p => `${p.label}=${p.value}`).join(', ')
}

function build_output(data) {
  const lines = []

  const status_icon = data.expired ? '❌' : data.days_remaining < 30 ? '⚠️' : '✅'
  const status_text = data.expired
    ? `EXPIRED (${Math.abs(data.days_remaining)} days ago)`
    : `Valid (${data.days_remaining} days remaining)`

  lines.push(`  Host         ${data.host}:${data.port}`)
  lines.push(`  Status       ${status_icon} ${status_text}`)
  lines.push(`  TLS          ${data.tls_version}`)
  lines.push(`  Verified     ${data.verified ? '✅ Yes' : '⚠️ No (self-signed or untrusted)'}`)
  lines.push('')
  lines.push('  Subject')
  data.subject.forEach(p => lines.push(`    ${p.label.padEnd(18)} ${p.value}`))
  lines.push('')
  lines.push('  Issuer')
  data.issuer.forEach(p => lines.push(`    ${p.label.padEnd(18)} ${p.value}`))
  lines.push('')
  lines.push(`  Valid From   ${data.issued_at.replace('T', ' ').replace(/[+Z].*/, '')} UTC`)
  lines.push(`  Expires      ${data.expires_at.replace('T', ' ').replace(/[+Z].*/, '')} UTC`)
  lines.push(`  Serial       ${data.serial_number} (${data.serial_bytes} bytes)`)
  lines.push(`  Algorithm    ${data.signature_algorithm}`)
  lines.push(`  Key Size     ${data.public_key_bits} bits`)
  lines.push(`  SHA-256      ${data.fingerprint_sha256}`)
  lines.push(`  Self-Signed  ${data.self_signed ? 'Yes' : 'No'}`)
  lines.push(`  CA Cert      ${data.is_ca ? 'Yes' : 'No'}`)

  if (data.sans && data.sans.length > 0) {
    lines.push('')
    lines.push(`  Subject Alternative Names (${data.sans.length})`)
    data.sans.forEach(san => lines.push(`    • ${san}`))
  }

  if (data.chain && data.chain.length > 0) {
    lines.push('')
    lines.push(`  Certificate Chain (${data.chain_length})`)
    data.chain.forEach((c, i) => {
      const prefix = i === data.chain.length - 1 ? '    └─' : '    ├─'
      const subject_str = format_name_parts(c.subject)
      const suffix = c.self_signed ? ' (self-signed)' : ''
      lines.push(`  ${prefix} ${subject_str}${suffix}`)
    })
  }

  return lines.join('\n')
}

export default function SslPage() {
  const [host, setHost] = useState('')
  const [port, setPort] = useState('443')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [raw, setRaw] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()

    const trimmed = host.trim()
    if (!trimmed) {
      setError('Please enter a hostname or IP address')
      return
    }

    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError('Port must be a number between 1 and 65535')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setRaw(null)

    try {
      const { data } = await axios.post('/api/ssl/inspect', {
        host: trimmed,
        port: portNum,
      })

      if (data.status === 'success') {
        setRaw(data.data)
        setResult(build_output(data.data))
      } else {
        setError(data.data?.message ?? 'Inspection failed')
      }
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader
        icon="🔒"
        title="SSL/TLS Certificate Inspector"
        description="Inspect SSL/TLS certificates — check expiry, SANs, issuer chain, and security details for any host"
      />

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Host</label>
            <input
              type="text"
              value={host}
              onChange={e => setHost(e.target.value)}
              placeholder="google.com"
              className="input-field font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Domain name or IP address</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Port</label>
            <input
              type="number"
              value={port}
              onChange={e => setPort(e.target.value)}
              placeholder="443"
              min={1}
              max={65535}
              className="input-field font-mono w-32"
            />
            <p className="text-xs text-gray-500 mt-1">Default: 443 (standard HTTPS)</p>
          </div>

          {raw && !loading && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium"
              style={{
                backgroundColor: raw.expired
                  ? 'rgba(239,68,68,0.1)'
                  : raw.days_remaining < 30
                    ? 'rgba(234,179,8,0.1)'
                    : 'rgba(34,197,94,0.1)',
                borderColor: raw.expired
                  ? 'rgba(239,68,68,0.2)'
                  : raw.days_remaining < 30
                    ? 'rgba(234,179,8,0.2)'
                    : 'rgba(34,197,94,0.2)',
                borderWidth: 1,
                color: raw.expired
                  ? '#fca5a5'
                  : raw.days_remaining < 30
                    ? '#fde047'
                    : '#86efac',
              }}
            >
              <span>
                {raw.expired ? '❌' : raw.days_remaining < 30 ? '⚠️' : '✅'}
              </span>
              <span>
                {raw.expired
                  ? `Certificate expired ${Math.abs(raw.days_remaining)} days ago`
                  : raw.days_remaining < 30
                    ? `Certificate expires in ${raw.days_remaining} days — renew soon`
                    : `Certificate valid — ${raw.days_remaining} days remaining`
                }
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Inspecting...' : '🔍 Inspect Certificate'}
          </button>
        </form>
      </div>

      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
