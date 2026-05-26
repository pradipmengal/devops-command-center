import React, { useState, useCallback, useRef, useEffect } from 'react'
import { RepoInput, ProgressStream, FilePreview, StackSummary } from '../components/containerize'

export default function ContainerizePage() {
  const [repoUrl, setRepoUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState([])
  const [files, setFiles] = useState(null)
  const [stack, setStack] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)
  const [progressMsg, setProgressMsg] = useState('')

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!repoUrl.trim()) return

    setLoading(true)
    setFiles(null)
    setStack(null)
    setError(null)
    setSteps([])
    setProgressMsg('')

    abortRef.current = new AbortController()

    const payload = {
      repo_url: repoUrl.trim(),
      branch,
      generate_k8s: true,
      generate_helm: true,
    }

    try {
      const response = await fetch('/api/containerize/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.data?.message ?? `HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let collectedFiles = {}
      let collectedStack = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const parsed = JSON.parse(jsonStr)

            if (parsed.type === 'progress') {
              const prevSteps = steps
              const newStep = {
                phase: parsed.phase,
                message: parsed.message,
                data: parsed.data,
                type: 'progress',
                isLatest: true,
              }
              const updated = (prevSteps || []).map(s => ({ ...s, isLatest: false }))
              updated.push(newStep)
              setSteps(updated)
              setProgressMsg(parsed.message)

              if (parsed.phase === 'detecting' && parsed.data?.languages) {
                setStack(parsed.data)
                collectedStack = parsed.data
              }
            } else if (parsed.type === 'artifact') {
              collectedFiles[parsed.artifact] = parsed.content
              setFiles({ ...collectedFiles })
            } else if (parsed.type === 'done') {
              if (parsed.stack) {
                setStack(parsed.stack)
                collectedStack = parsed.stack
              }
              if (parsed.files) {
                setFiles(parsed.files)
                collectedFiles = parsed.files
              }
              setSteps(prev => [
                ...prev.map(s => ({ ...s, isLatest: false })),
                { type: 'done', phase: 'done', message: 'All artifacts generated successfully!', isLatest: false },
              ])
              setProgressMsg('')
            } else if (parsed.type === 'error') {
              setError(parsed.message)
              setSteps(prev => [
                ...prev.map(s => ({ ...s, isLatest: false })),
                { type: 'error', phase: 'error', message: parsed.message, isLatest: false },
              ])
              setProgressMsg('')
            }
          } catch {
            // Ignore malformed SSE
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message || 'Request failed')
      setProgressMsg('')
    } finally {
      setLoading(false)
    }
  }, [repoUrl, branch])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    setLoading(false)
    setProgressMsg('')
  }, [])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const hasResults = files && Object.keys(files).length > 0

  return (
    <div className="max-w-5xl animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-indigo-500/20 flex items-center justify-center text-2xl flex-shrink-0">
          🚀
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white tracking-tight">Application Containerization Suite</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Paste a repository URL — clones, analyzes, and generates Dockerfile, docker-compose, Kubernetes manifests, and Helm charts
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">Multi-Artifact</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Auto-Detect</span>
          </div>
        </div>
        {loading && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
        )}
      </div>

        {/* Input */}
        <div className="card p-6 mb-5">
          <RepoInput
            repoUrl={repoUrl}
            branch={branch}
            onChange={setRepoUrl}
            onBranchChange={setBranch}
            onSubmit={handleSubmit}
            loading={loading}
          />
        </div>

        {/* Progress */}
        {steps.length > 0 && (
          <div className="mb-5">
            <ProgressStream steps={steps} />
          </div>
        )}

        {/* AI Loading indicator */}
        {loading && !hasResults && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1">
                {[0, 0.2, 0.4].map((d, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
              <p className="text-sm text-gray-500">{progressMsg || 'Processing...'}</p>
              <p className="text-xs text-gray-600">This can take 10-30 seconds depending on repo size</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/30 p-5 animate-fade-in">
            <div className="flex items-start gap-3">
              <span className="text-lg">❌</span>
              <div>
                <p className="text-sm font-semibold text-red-400 mb-1">Generation Failed</p>
                <p className="text-sm text-red-300/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {hasResults && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            <div className="space-y-5">
              {/* Stack summary compact */}
              {stack && (
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-2xl bg-gray-900/60 border border-gray-700/30">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stack:</span>
                  {stack.languages?.map(l => (
                    <span key={l} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">{l}</span>
                  ))}
                  {stack.frameworks?.map(f => (
                    <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">{f}</span>
                  ))}
                  {stack.databases?.map(d => (
                    <span key={d} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">{d}</span>
                  ))}
                  <span className="text-xs text-gray-600">· Port {stack.port}</span>
                </div>
              )}

              {/* File previews */}
              <FilePreview files={files} />
            </div>

            {/* Sidebar: Stack Details */}
            <div className="space-y-5">
              <StackSummary stack={stack} />

              <div className="rounded-2xl bg-gray-900/80 border border-gray-700/40 overflow-hidden shadow-xl shadow-black/20">
                <div className="px-4 py-3 border-b border-gray-700/40 bg-gray-800/40">
                  <span className="text-xs text-gray-500 font-medium">Next Steps</span>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    { step: '1', title: 'Review generated files', desc: 'Check each artifact for correctness' },
                    { step: '2', title: 'Build & test locally', desc: 'docker compose build && docker compose up' },
                    { step: '3', title: 'Deploy to Kubernetes', desc: 'kubectl apply -f k8s/ or helm install ./helm' },
                    { step: '4', title: 'Customize for production', desc: 'Update values.yaml, secrets, and ingress' },
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-gray-800/30 border border-gray-700/20">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{step}</span>
                      <div>
                        <p className="text-xs font-medium text-gray-300">{title}</p>
                        <p className="text-[10px] text-gray-600">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
