import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

export default function Base64Page() {
  const [text, setText] = useState('')
  const [mode, setMode] = useState('encode')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) { setError('Please enter text to encode or decode.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/utils/base64', { text, mode })
      if (data.status === 'success') setResult(data.data.result)
      else setError(data.data?.message ?? 'Unknown error')
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🔐" title="Base64 Encoder / Decoder" description="Encode text to Base64 or decode Base64 back to plain text. Handles UTF-8 and emoji." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Mode</label>
            <div className="flex gap-1 p-1 bg-gray-900/60 rounded-xl w-fit">
              {['encode', 'decode'].map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 capitalize ${
                    mode === m
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="b64-text" className="label">
              {mode === 'encode' ? 'Text to Encode' : 'Base64 to Decode'}
            </label>
            <input id="b64-text" type="text" value={text} onChange={e => setText(e.target.value)}
              placeholder={mode === 'encode' ? 'Enter text to encode...' : 'Enter Base64 string to decode...'}
              className="input-field" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Processing...' : mode === 'encode' ? 'Encode to Base64' : 'Decode from Base64'}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
