import React, { useState } from 'react'
import axios from 'axios'
import OutputPanel from '../components/OutputPanel'
import PageHeader from '../components/PageHeader'

const TYPE_GROUPS = [
  { group: 'Languages',  color: 'text-blue-400',    types: ['node', 'python', 'java', 'go', 'rust', 'dotnet'] },
  { group: 'Frameworks', color: 'text-violet-400',  types: ['react', 'terraform'] },
  { group: 'OS',         color: 'text-emerald-400', types: ['macos', 'windows', 'linux'] },
  { group: 'Tools',      color: 'text-orange-400',  types: ['jetbrains', 'vscode', 'docker'] },
]

const ALL_TYPES = TYPE_GROUPS.flatMap(g => g.types)

export default function GitignorePage() {
  const [selected, setSelected] = useState(['node'])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const toggle = t => setSelected(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selected.length) { setError('Select at least one type.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/gitignore/generate', { types: selected })
      if (data.status === 'success') setResult(data.data.gitignore)
      else setError(data.data?.message ?? 'Generation failed')
    } catch (err) {
      setError(err.response?.data?.data?.message ?? err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="📄" title=".gitignore Generator" description="Select project types to generate a merged, deduplicated .gitignore file." badge="14 templates" />
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="label mb-0">Project Types
                <span className="ml-2 text-xs text-gray-600 font-normal">({selected.length} selected)</span>
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setSelected([...ALL_TYPES])} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Select All</button>
                <button type="button" onClick={() => setSelected([])} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Clear</button>
              </div>
            </div>
            <div className="space-y-4">
              {TYPE_GROUPS.map(({ group, color, types }) => (
                <div key={group}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${color}`}>{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {types.map(t => (
                      <button key={t} type="button" onClick={() => toggle(t)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                          selected.includes(t)
                            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                            : 'bg-gray-800/40 text-gray-400 border border-gray-700/40 hover:bg-gray-700/40 hover:text-gray-200'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading || !selected.length} className="btn-primary">
            {loading ? 'Generating...' : `Generate .gitignore (${selected.length} types)`}
          </button>
        </form>
      </div>
      <OutputPanel content={result} error={error} loading={loading} />
    </div>
  )
}
