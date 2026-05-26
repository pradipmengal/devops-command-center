import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

const FIELDS = [
  { name: 'minute',  label: 'Minute',  hint: '0–59 or *', placeholder: '*' },
  { name: 'hour',    label: 'Hour',    hint: '0–23 or *', placeholder: '*' },
  { name: 'day',     label: 'Day',     hint: '1–31 or *', placeholder: '*' },
  { name: 'month',   label: 'Month',   hint: '1–12 or *', placeholder: '*' },
  { name: 'weekday', label: 'Weekday', hint: '0–6 or *',  placeholder: '*' },
]

const PRESETS = [
  { label: 'Every minute',    values: { minute: '*', hour: '*', day: '*', month: '*', weekday: '*' } },
  { label: 'Every hour',      values: { minute: '0', hour: '*', day: '*', month: '*', weekday: '*' } },
  { label: 'Daily at 9am',    values: { minute: '0', hour: '9', day: '*', month: '*', weekday: '*' } },
  { label: 'Every Monday',    values: { minute: '0', hour: '9', day: '*', month: '*', weekday: '1' } },
  { label: 'Monthly 1st',     values: { minute: '0', hour: '0', day: '1', month: '*', weekday: '*' } },
]

export default function CronPage() {
  const [fields, setFields] = useState({ minute: '*', hour: '*', day: '*', month: '*', weekday: '*' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleChange = (name, value) => setFields(prev => ({ ...prev, [name]: value }))
  const applyPreset = (values) => setFields(values)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/cron/build', fields)
      if (data.status === 'success') {
        setResult(`Expression:  ${data.data.expression}\n\nDescription: ${data.data.description}`)
      } else {
        setError(data.data?.message ?? 'Unknown error')
      }
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="⏰" title="Cron Expression Builder" description="Build valid cron expressions from individual time fields with a human-readable description." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Presets */}
          <div>
            <label className="label">Quick Presets</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(({ label, values }) => (
                <button key={label} type="button" onClick={() => applyPreset(values)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800/60 text-gray-400 border border-gray-700/40 hover:bg-gray-700/60 hover:text-gray-200 hover:border-gray-600/60 transition-all">
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-5 gap-3">
            {FIELDS.map(({ name, label, hint }) => (
              <div key={name}>
                <label htmlFor={`cron-${name}`} className="block text-xs font-medium text-gray-400 mb-1.5">
                  {label}
                  <span className="block text-gray-600 font-normal text-[10px]">{hint}</span>
                </label>
                <input id={`cron-${name}`} type="text" value={fields[name]}
                  onChange={e => handleChange(name, e.target.value)}
                  className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-100 rounded-xl px-3 py-2.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/60 transition-all" />
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-700/40">
            <span className="text-xs text-gray-500 font-medium">Preview:</span>
            <code className="text-indigo-300 font-mono text-sm font-semibold tracking-widest">
              {Object.values(fields).join(' ')}
            </code>
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Building...' : 'Build Expression'}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
