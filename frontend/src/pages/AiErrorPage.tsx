import React, { useState } from 'react'
import AILoadingPanel from '../components/AILoadingPanel'
import PageHeader from '../components/PageHeader'
import AIGate from '../components/AIGate'
import CopyButton from '../components/CopyButton'
import { useAISettings } from '../context/AISettingsContext'
import { useAIStream } from '../hooks/useAIStream'

const EXAMPLES = [
  {
    label: 'Docker build error',
    text: `Step 5/8 : RUN npm ci
npm ERR! code ENOENT
npm ERR! syscall open
npm ERR! path /app/package.json
npm ERR! enoent ENOENT: no such file or directory, open '/app/package.json'`,
  },
  {
    label: 'K8s CrashLoopBackOff',
    text: `Back-off restarting failed container
Last State: Terminated
  Reason: OOMKilled
  Exit Code: 137`,
  },
  {
    label: 'Terraform error',
    text: `Error: Error creating S3 bucket: BucketAlreadyOwnedByYou
  status code: 409, request id: EXAMPLE123`,
  },
]

export default function AiErrorPage() {
  const { getAIConfig, settings } = useAISettings()
  const { streaming, streamedText, elapsed, statusMsg, streamError, firstTokenTime, stream, cancel, reset } = useAIStream()
  const [errorText, setErrorText] = useState('')
  const [finalResult, setFinalResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!errorText.trim()) { setError('Please paste an error message.'); return }
    setError(null); setFinalResult(null); reset()

    const { text, error: err, cancelled } = await stream('/api/ai/explain-error', {
      ...getAIConfig(),
      error_text: errorText,
    })

    if (cancelled) return
    if (err) setError(err)
    else setFinalResult(text)
  }

  const displayText = streaming ? streamedText : finalResult

  return (
    <div className="max-w-3xl animate-fade-in">
      <PageHeader icon="🔎" title="AI Error Explainer"
        description="Paste any error message and get a plain-English explanation with fix steps."
        badge="AI" />

      <AIGate>
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Quick Examples</label>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map(({ label, text }) => (
                  <button key={label} type="button" onClick={() => setErrorText(text)}
                    disabled={streaming}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800/60 text-gray-400 border border-gray-700/40 hover:bg-gray-700/60 hover:text-gray-200 disabled:opacity-40 transition-all">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="error-text" className="label">Error Message / Stack Trace</label>
              <textarea id="error-text" value={errorText} onChange={e => setErrorText(e.target.value)}
                placeholder="Paste your error message, stack trace, or log output here..."
                rows={8} disabled={streaming}
                className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-100 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/60 placeholder-gray-600 transition-all resize-y disabled:opacity-60" />
            </div>

            <button type="submit" disabled={streaming}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl text-sm transition-all shadow-lg shadow-violet-900/30 hover:-translate-y-px">
              {streaming
                ? <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing... ({elapsed}s)
                  </span>
                : '🔎 Explain This Error'}
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
                  {streaming ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      Streaming...
                    </span>
                  ) : 'Output'}
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
              {streaming && <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />}
            </pre>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/30 p-5 animate-fade-in">
            <p className="text-sm font-semibold text-red-400 mb-1">Error</p>
            <p className="text-sm text-red-300/80">{error || streamError}</p>
          </div>
        )}
      </AIGate>
    </div>
  )
}
