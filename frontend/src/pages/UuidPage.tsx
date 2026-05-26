import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

export default function UuidPage() {
  const [tab, setTab] = useState('generate')
  const [version, setVersion] = useState(4)
  const [count, setCount] = useState(1)
  const [validateValue, setValidateValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const reset = () => { setResult(null); setError(null) }

  const handleGenerate = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/uuid/generate', { version, count })
      if (data.status === 'success') setResult(data.data.uuids.join('\n'))
      else setError(data.data?.message ?? 'Generation failed')
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleValidate = async (e) => {
    e.preventDefault()
    if (!validateValue.trim()) { setError('Please enter a UUID to validate.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/uuid/validate', { value: validateValue })
      if (data.status === 'success') {
        const d = data.data
        setResult(d.is_valid ? `✅ Valid UUID v${d.version}\nValue: ${d.value}` : `❌ Invalid UUID\nValue: ${d.value}`)
      } else {
        setError(data.data?.message ?? 'Validation failed')
      }
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  const UUID_VERSIONS = [
    { v: 1, label: 'v1', desc: 'Time-based' },
    { v: 4, label: 'v4', desc: 'Random' },
    { v: 5, label: 'v5', desc: 'Name-based' },
  ]

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🆔" title="UUID Generator & Validator" description="Generate v1, v4, or v5 UUIDs in bulk, or validate an existing UUID string." />
      <div className="card p-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-900/60 rounded-xl w-fit mb-5">
          {['generate', 'validate'].map(t => (
            <button key={t} type="button" onClick={() => { setTab(t); reset() }}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-gray-400 hover:text-gray-200'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'generate' ? (
          <form onSubmit={handleGenerate} className="space-y-5">
            <div>
              <label className="label">Version</label>
              <div className="flex gap-2">
                {UUID_VERSIONS.map(({ v, label, desc }) => (
                  <button key={v} type="button" onClick={() => setVersion(v)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                      version === v
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-gray-800/40 text-gray-400 border border-gray-700/40 hover:text-gray-200'
                    }`}>
                    <p className="font-bold">{label}</p>
                    <p className="text-xs opacity-60">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Count (1–20)</label>
              <input type="number" min={1} max={20} value={count} onChange={e => setCount(Number(e.target.value))}
                className="input-field w-32" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Generating...' : `Generate ${count} UUID${count > 1 ? 's' : ''}`}
            </button>
          </form>
        ) : (
          <form onSubmit={handleValidate} className="space-y-5">
            <div>
              <label className="label">UUID to Validate</label>
              <input type="text" value={validateValue} onChange={e => setValidateValue(e.target.value)}
                placeholder="550e8400-e29b-41d4-a716-446655440000"
                className="input-field font-mono" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Validating...' : 'Validate UUID'}
            </button>
          </form>
        )}
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
