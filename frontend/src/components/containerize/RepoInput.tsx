import React from 'react'

const EXAMPLES = [
  { label: 'FastAPI + React', url: 'https://github.com/tiangolo/full-stack-fastapi-template' },
  { label: 'Node.js Express', url: 'https://github.com/gothinkster/node-express-realworld-example-app' },
  { label: 'Django Blog', url: 'https://github.com/sibtc/django-blog' },
  { label: 'Go API', url: 'https://github.com/gothinkster/go-gin-realworld-example-app' },
]

export default function RepoInput({ repoUrl, branch, onChange, onBranchChange, onSubmit, loading }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="repo-url" className="label">
          Repository URL
          <span className="ml-2 text-xs text-gray-600 font-normal">(public GitHub, GitLab, etc.)</span>
        </label>
        <div className="flex gap-2">
          <input
            id="repo-url"
            type="url"
            value={repoUrl}
            onChange={e => onChange(e.target.value)}
            placeholder="https://github.com/user/repository"
            disabled={loading}
            required
            className="flex-1 bg-gray-900/80 border border-gray-700/60 text-gray-100 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/60 placeholder-gray-600 transition-all disabled:opacity-60"
          />
          <input
            type="text"
            value={branch}
            onChange={e => onBranchChange(e.target.value)}
            placeholder="main"
            disabled={loading}
            className="w-28 bg-gray-900/80 border border-gray-700/60 text-gray-100 rounded-xl px-3 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/60 placeholder-gray-600 transition-all disabled:opacity-60"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map(ex => (
            <button
              key={ex.label}
              type="button"
              onClick={() => onChange(ex.url)}
              disabled={loading}
              className="text-[11px] px-2 py-1 rounded-lg bg-gray-800/50 border border-gray-700/40 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all disabled:opacity-40"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input type="checkbox" defaultChecked className="rounded bg-gray-800 border-gray-600 text-indigo-500 focus:ring-indigo-500/40" />
          Generate K8s manifests
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input type="checkbox" defaultChecked className="rounded bg-gray-800 border-gray-600 text-indigo-500 focus:ring-indigo-500/40" />
          Generate Helm chart
        </label>
      </div>

      <button
        type="submit"
        disabled={loading || !repoUrl.trim()}
        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl text-sm transition-all shadow-lg shadow-indigo-900/30 hover:-translate-y-px disabled:translate-y-0"
      >
        {loading
          ? <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing Repository...
            </span>
          : <span className="flex items-center justify-center gap-2">🚀 Analyze & Generate</span>
        }
      </button>
    </form>
  )
}
