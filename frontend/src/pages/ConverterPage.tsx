import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

export default function ConverterPage() {
  const [content, setContent] = useState('')
  const [fromFormat, setFromFormat] = useState('json')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) { setError('Please enter content to convert.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/converter/convert', { content, from_format: fromFormat })
      if (data.status === 'success') setResult(data.data.result)
      else setError(data.data?.message ?? 'Conversion failed')
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  const toFormat = fromFormat === 'json' ? 'YAML' : 'JSON'

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🔀" title="JSON ↔ YAML Converter" description="Bidirectional conversion between JSON and YAML with full syntax validation." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Convert From</label>
            <div className="flex gap-1 p-1 bg-gray-900/60 rounded-xl w-fit">
              {['json', 'yaml'].map(f => (
                <button key={f} type="button" onClick={() => setFromFormat(f)}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-150 uppercase tracking-wide ${
                    fromFormat === f
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="conv-content" className="label">Input ({fromFormat.toUpperCase()})</label>
            <textarea id="conv-content" value={content} onChange={e => setContent(e.target.value)}
              placeholder={fromFormat === 'json' ? '{\n  "name": "example",\n  "version": "1.0.0"\n}' : 'name: example\nversion: 1.0.0'}
              rows={10} className="input-field font-mono resize-y" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Converting...' : `Convert to ${toFormat} →`}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
