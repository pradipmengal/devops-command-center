import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

const ALGORITHMS = [
  { value: 'md5',    label: 'MD5',    bits: '128-bit' },
  { value: 'sha1',   label: 'SHA-1',  bits: '160-bit' },
  { value: 'sha224', label: 'SHA-224',bits: '224-bit' },
  { value: 'sha256', label: 'SHA-256',bits: '256-bit' },
  { value: 'sha384', label: 'SHA-384',bits: '384-bit' },
  { value: 'sha512', label: 'SHA-512',bits: '512-bit' },
]

export default function HashPage() {
  const [text, setText] = useState('')
  const [algorithm, setAlgorithm] = useState('sha256')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) { setError('Please enter text to hash.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/hash/generate', { text, algorithm })
      if (data.status === 'success') {
        setResult(`Algorithm:    ${data.data.algorithm.toUpperCase()}\nInput Length: ${data.data.input_length} bytes\n\nHash:\n${data.data.hash}`)
      } else {
        setError(data.data?.message ?? 'Hash generation failed')
      }
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🔑" title="Hash Generator" description="Generate cryptographic hashes for checksums, data integrity verification, and debugging." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Algorithm</label>
            <div className="grid grid-cols-3 gap-2">
              {ALGORITHMS.map(({ value, label, bits }) => (
                <button key={value} type="button" onClick={() => setAlgorithm(value)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${
                    algorithm === value
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-gray-800/40 text-gray-400 border border-gray-700/40 hover:bg-gray-700/40 hover:text-gray-200'
                  }`}>
                  <p className="font-semibold">{label}</p>
                  <p className="text-[10px] opacity-60">{bits}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="hash-text" className="label">Input Text</label>
            <textarea id="hash-text" value={text} onChange={e => setText(e.target.value)}
              placeholder="Enter text to hash..." rows={4}
              className="input-field resize-y" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Generating...' : `Generate ${algorithm.toUpperCase()} Hash`}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
