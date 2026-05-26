import React, { useState } from 'react'
import AILoadingPanel from '../components/AILoadingPanel'
import PageHeader from '../components/PageHeader'
import AIGate from '../components/AIGate'
import CopyButton from '../components/CopyButton'
import { useAISettings } from '../context/AISettingsContext'
import { useAIStream } from '../hooks/useAIStream'

const EXAMPLE_DOCKERFILE = `FROM node:latest

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 3000

CMD ["node", "server.js"]`

export default function AiDockerPage() {
  const { getAIConfig, settings } = useAISettings()
  const { streaming, streamedText, elapsed, statusMsg, streamError, firstTokenTime, stream, cancel, reset } = useAIStream()
  const [dockerfile, setDockerfile] = useState('')
  const [finalResult, setFinalResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!dockerfile.trim()) { setError('Please paste a Dockerfile.'); return }
    setError(null); setFinalResult(null); reset()

    const { text, error: err, cancelled } = await stream('/api/ai/optimize-dockerfile', {
      ...getAIConfig(),
      dockerfile,
    })

    if (cancelled) return
    if (err) setError(err)
    else setFinalResult(text)
  }

  const displayText = streaming ? streamedText : finalResult

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🐳" title="AI Dockerfile Optimizer"
        description="Paste any Dockerfile and get AI-powered analysis — security issues, performance improvements, and an optimized version."
        badge="AI" />

      <AIGate>
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: '🔴', label: 'Security issues', desc: 'Root user, exposed secrets' },
                { icon: '📦', label: 'Image size',       desc: 'Alpine, multi-stage builds' },
                { icon: '⚡', label: 'Layer caching',    desc: 'Dependency ordering' },
                { icon: '✅', label: 'Best practices',   desc: 'HEALTHCHECK, versions' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gray-800/40 border border-gray-700/30">
                  <span className="text-sm">{icon}</span>
                  <div>
                    <p className="text-xs font-medium text-gray-300">{label}</p>
                    <p className="text-[10px] text-gray-600">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="dockerfile-input" className="label mb-0">Your Dockerfile</label>
                <button type="button" onClick={() => setDockerfile(EXAMPLE_DOCKERFILE)}
                  disabled={streaming}
                  className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors">
                  Load example
                </button>
              </div>
              <textarea id="dockerfile-input" value={dockerfile} onChange={e => setDockerfile(e.target.value)}
                placeholder="FROM node:latest&#10;WORKDIR /app&#10;COPY . .&#10;RUN npm install&#10;..."
                rows={12} disabled={streaming}
                className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-100 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/60 placeholder-gray-600 transition-all resize-y disabled:opacity-60" />
            </div>

            <button type="submit" disabled={streaming}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30 hover:-translate-y-px">
              {streaming
                ? <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing... ({elapsed}s)
                  </span>
                : '🐳 Analyze & Optimize Dockerfile'}
            </button>
          </form>
        </div>

        {streaming && !streamedText && (
          <AILoadingPanel elapsed={elapsed} statusMsg={statusMsg} onCancel={cancel} modelName={settings.model} firstTokenTime={firstTokenTime} />
        )}

        {(streamedText || finalResult) && (
          <div className="mt-5 rounded-2xl bg-gray-900/80 border border-gray-700/40 overflow-hidden animate-fade-in shadow-xl shadow-black/20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40 bg-gray-800/40">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-gray-500 font-medium ml-1">
                  {streaming
                    ? <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />Streaming...</span>
                    : 'Output'}
                </span>
              </div>
              {!streaming && finalResult && (
                <div className="flex items-center gap-2">
                  {firstTokenTime != null && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      first token: {(firstTokenTime / 1000).toFixed(1)}s
                    </span>
                  )}
                  <CopyButton text={finalResult} />
                </div>
              )}
            </div>
            <pre className="p-5 text-sm text-gray-200 whitespace-pre-wrap break-words font-sans leading-relaxed max-h-[500px] overflow-y-auto">
              {displayText}
              {streaming && <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />}
            </pre>
          </div>
        )}

        {(error || streamError) && (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/30 p-5 animate-fade-in">
            <p className="text-sm font-semibold text-red-400 mb-1">Error</p>
            <p className="text-sm text-red-300/80">{error || streamError}</p>
          </div>
        )}
      </AIGate>
    </div>
  )
}
