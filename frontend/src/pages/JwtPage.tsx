import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

export default function JwtPage() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token.trim()) { setError('Please enter a JWT token.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/jwt/decode', { token })
      if (data.status === 'success') {
        const d = data.data
        let out = '── HEADER ──────────────────────────\n'
        out += JSON.stringify(d.header, null, 2)
        out += '\n\n── PAYLOAD ─────────────────────────\n'
        out += JSON.stringify(d.payload, null, 2)
        out += '\n\n── SIGNATURE ───────────────────────\n'
        out += d.signature
        if (d.is_expired !== null) {
          out += '\n\n── STATUS ──────────────────────────\n'
          out += d.is_expired ? '⚠️  TOKEN IS EXPIRED' : `✅ Valid — expires in ${d.expires_in_seconds}s`
        }
        setResult(out)
      } else {
        setError(data.data?.message ?? 'Decode failed')
      }
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🪙" title="JWT Decoder" description="Decode any JWT token to inspect its header, payload, and expiry status. No secret required." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="jwt-token" className="label">JWT Token</label>
            <textarea id="jwt-token" value={token} onChange={e => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." rows={4}
              className="input-field font-mono resize-y" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Decoding...' : 'Decode JWT'}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
