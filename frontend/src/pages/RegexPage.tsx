import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

const FLAGS = [
  { value: 'i', label: 'Case Insensitive', short: 'i' },
  { value: 'm', label: 'Multiline',        short: 'm' },
  { value: 's', label: 'Dot All',          short: 's' },
]

export default function RegexPage() {
  const [pattern, setPattern] = useState('')
  const [testString, setTestString] = useState('')
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const toggleFlag = f => setFlags(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!pattern.trim()) { setError('Please enter a regex pattern.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/regex/test', { pattern, test_string: testString, flags })
      if (data.status === 'success') {
        const d = data.data
        let out = `Match: ${d.is_match ? '✅ YES' : '❌ NO'}   Total: ${d.match_count} match${d.match_count !== 1 ? 'es' : ''}\n`
        if (d.flags_applied.length) out += `Flags: ${d.flags_applied.join(', ')}\n`
        if (d.matches.length > 0) {
          out += '\n── MATCHES ─────────────────────────\n'
          d.matches.forEach((m, i) => {
            out += `\n[${i + 1}] "${m.match}"  (pos ${m.start}–${m.end})`
            if (m.groups.length) out += `\n    Groups: ${JSON.stringify(m.groups)}`
            if (Object.keys(m.named_groups).length) out += `\n    Named:  ${JSON.stringify(m.named_groups)}`
          })
        }
        setResult(out)
      } else {
        setError(data.data?.message ?? 'Regex test failed')
      }
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🔍" title="Regex Tester" description="Test regular expressions, view all matches, capture groups, and named groups with flag support." />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="regex-pattern" className="label">Pattern</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-mono text-sm select-none">/</span>
              <input id="regex-pattern" type="text" value={pattern} onChange={e => setPattern(e.target.value)}
                placeholder="(\d{4})-(\d{2})-(\d{2})"
                className="input-field font-mono pl-7 pr-7" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 font-mono text-sm select-none">/{flags.join('')}</span>
            </div>
          </div>
          <div>
            <label className="label">Flags</label>
            <div className="flex gap-2">
              {FLAGS.map(({ value, label, short }) => (
                <button key={value} type="button" onClick={() => toggleFlag(value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                    flags.includes(value)
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-gray-800/40 text-gray-500 border border-gray-700/40 hover:text-gray-300'
                  }`}>
                  <code className="font-mono font-bold">{short}</code>
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="test-string" className="label">Test String</label>
            <textarea id="test-string" value={testString} onChange={e => setTestString(e.target.value)}
              placeholder="Enter text to test against the pattern..." rows={5}
              className="input-field font-mono resize-y" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Testing...' : 'Test Regex'}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
