import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

export default function TimestampPage() {
  const [value, setValue] = useState('')
  const [mode, setMode] = useState('to_date')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const useNow = () => setValue(String(Math.floor(Date.now() / 1000)))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!value.trim()) { setError('Please enter a value.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/timestamp/convert', { value, mode })
      if (data.status === 'success') {
        const d = data.data
        let out = ''
        if (mode === 'to_date') {
          out += `Unix Timestamp: ${d.unix_timestamp}\n`
          out += `UTC:            ${d.utc}\n`
          out += `ISO 8601:       ${d.iso8601}\n`
          out += `Relative:       ${d.relative}\n`
          out += '\n── TIMEZONES ───────────────────────\n'
          Object.entries(d.timezones).forEach(([tz, val]) => {
            out += `${tz.padEnd(22)} ${val}\n`
          })
        } else {
          out += `Unix Timestamp: ${d.unix_timestamp}\n`
          out += `UTC:            ${d.utc}\n`
          out += `ISO 8601:       ${d.iso8601}\n`
        }
        setResult(out)
      } else {
        setError(data.data?.message ?? 'Conversion failed')
      }
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🕐" title="Unix Timestamp Converter" description="Convert between Unix timestamps and human-readable dates across 8 timezones." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Mode</label>
            <div className="flex gap-1 p-1 bg-gray-900/60 rounded-xl w-fit">
              {[
                { value: 'to_date',      label: 'Timestamp → Date' },
                { value: 'to_timestamp', label: 'Date → Timestamp' },
              ].map(({ value: v, label }) => (
                <button key={v} type="button" onClick={() => setMode(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    mode === v ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-gray-400 hover:text-gray-200'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="ts-value" className="label">
              {mode === 'to_date' ? 'Unix Timestamp' : 'Date String'}
            </label>
            <div className="flex gap-2">
              <input id="ts-value" type="text" value={value} onChange={e => setValue(e.target.value)}
                placeholder={mode === 'to_date' ? '1700000000' : '2024-01-15 14:30:00'}
                className="input-field font-mono flex-1" />
              {mode === 'to_date' && (
                <button type="button" onClick={useNow}
                  className="px-4 py-2.5 bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-200 text-xs font-medium rounded-xl border border-gray-700/40 transition-all whitespace-nowrap">
                  Now
                </button>
              )}
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Converting...' : 'Convert'}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
