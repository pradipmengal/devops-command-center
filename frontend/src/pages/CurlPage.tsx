import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const METHOD_COLORS = { GET: 'text-emerald-400', POST: 'text-blue-400', PUT: 'text-amber-400', PATCH: 'text-orange-400', DELETE: 'text-red-400', HEAD: 'text-violet-400', OPTIONS: 'text-gray-400' }

export default function CurlPage() {
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState([{ key: '', value: '' }])
  const [body, setBody] = useState('')
  const [authType, setAuthType] = useState('none')
  const [authValue, setAuthValue] = useState('')
  const [followRedirects, setFollowRedirects] = useState(true)
  const [verbose, setVerbose] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const addHeader = () => setHeaders(prev => [...prev, { key: '', value: '' }])
  const removeHeader = i => setHeaders(prev => prev.filter((_, idx) => idx !== i))
  const updateHeader = (i, field, val) => setHeaders(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: val } : h))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) { setError('Please enter a URL.'); return }
    setLoading(true); setError(null); setResult(null)
    const headersObj = {}
    headers.forEach(({ key, value }) => { if (key.trim()) headersObj[key.trim()] = value.trim() })
    try {
      const { data } = await axios.post('/api/curl/build', {
        method, url, headers: headersObj, body: body || null,
        auth_type: authType === 'none' ? null : authType,
        auth_value: authValue || null,
        follow_redirects: followRedirects, verbose,
      })
      if (data.status === 'success') setResult(data.data.command)
      else setError(data.data?.message ?? 'Build failed')
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="📡" title="curl Command Builder" description="Build a complete curl command from form inputs — ready to copy and run in your terminal." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Method + URL */}
          <div className="flex gap-3">
            <div>
              <label className="label">Method</label>
              <select value={method} onChange={e => setMethod(e.target.value)}
                className={`select-field w-28 font-semibold ${METHOD_COLORS[method] ?? 'text-gray-100'}`}>
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="label">URL</label>
              <input type="text" value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://api.example.com/endpoint"
                className="input-field" />
            </div>
          </div>

          {/* Auth */}
          <div>
            <label className="label">Authentication</label>
            <div className="flex gap-2 mb-3">
              {['none', 'bearer', 'basic'].map(a => (
                <button key={a} type="button" onClick={() => setAuthType(a)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                    authType === a
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-gray-800/40 text-gray-500 border border-gray-700/40 hover:text-gray-300'
                  }`}>
                  {a}
                </button>
              ))}
            </div>
            {authType !== 'none' && (
              <input type="text" value={authValue} onChange={e => setAuthValue(e.target.value)}
                placeholder={authType === 'bearer' ? 'your-token-here' : 'username:password'}
                className="input-field font-mono" />
            )}
          </div>

          {/* Headers */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="label mb-0">Headers</label>
              <button type="button" onClick={addHeader} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Add Header</button>
            </div>
            <div className="space-y-2">
              {headers.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)}
                    placeholder="Header name" className="input-field flex-1" />
                  <input type="text" value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)}
                    placeholder="Value" className="input-field flex-1" />
                  {headers.length > 1 && (
                    <button type="button" onClick={() => removeHeader(i)}
                      className="px-3 text-gray-600 hover:text-red-400 transition-colors rounded-xl border border-gray-700/40 hover:border-red-500/30">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          {['POST', 'PUT', 'PATCH'].includes(method) && (
            <div>
              <label className="label">Request Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)}
                placeholder='{"key": "value"}' rows={4}
                className="input-field font-mono resize-y" />
            </div>
          )}

          {/* Options */}
          <div className="flex gap-6 pt-1">
            {[
              { label: 'Follow Redirects (-L)', checked: followRedirects, onChange: e => setFollowRedirects(e.target.checked) },
              { label: 'Verbose (-v)',           checked: verbose,          onChange: e => setVerbose(e.target.checked) },
            ].map(({ label, checked, onChange }) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${checked ? 'bg-indigo-600 border-indigo-500' : 'border-gray-600 group-hover:border-gray-500'}`}>
                  {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                  <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
                </div>
                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">{label}</span>
              </label>
            ))}
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Building...' : 'Build curl Command'}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
