import React, { useState, useCallback, Suspense } from 'react'
import Editor from '@monaco-editor/react'
import { useAIStream } from '../../hooks/useAIStream'
import { useAISettings } from '../../context/AISettingsContext'

// Example Dockerfile with multiple intentional issues for demonstration
const EXAMPLE_DOCKERFILE = `# Example Dockerfile with common issues — click Analyze to see findings
FROM ubuntu:latest

# Running as root (security issue)
USER root

# No .dockerignore — all files will be copied
COPY . /app

WORKDIR /app

# apt cache not cleaned, multiple RUN layers
RUN apt-get update
RUN apt-get install -y curl wget git vim nodejs npm python3 python3-pip
RUN pip3 install flask requests boto3 pandas numpy

# Using ADD instead of COPY for local files
ADD config.json /app/config.json

# Hardcoded secret (security issue)
ENV DATABASE_PASSWORD=supersecret123
ENV API_KEY=sk-1234567890abcdef

RUN npm install

# No HEALTHCHECK
EXPOSE 3000 8080 22

CMD ["node", "server.js"]
`

const TOOLBAR_ACTIONS = [
  { id: 'optimize',      label: 'Optimize',        icon: '⚡', endpoint: '/api/docker-intelligence/optimize',       payload: (df) => ({ dockerfile: df }) },
  { id: 'secure',        label: 'Secure',           icon: '🔒', endpoint: '/api/docker-intelligence/security-scan',  payload: (df) => ({ dockerfile: df }) },
  { id: 'multistage',    label: 'Multi-stage',      icon: '🏗️', endpoint: '/api/docker-intelligence/optimize',       payload: (df) => ({ dockerfile: df, mode: 'multistage' }) },
  { id: 'reduce-size',   label: 'Reduce Size',      icon: '📦', endpoint: '/api/docker-intelligence/optimize',       payload: (df) => ({ dockerfile: df, mode: 'reduce-size' }) },
  { id: 'explain',       label: 'Explain',          icon: '💡', endpoint: '/api/docker-intelligence/explain',        payload: (df) => ({ question: 'Explain this Dockerfile in detail', dockerfile: df }) },
  { id: 'troubleshoot',  label: 'Troubleshoot',     icon: '🔧', endpoint: '/api/docker-intelligence/troubleshoot',   payload: (df) => ({ dockerfile: df }) },
  { id: 'compose',       label: 'Gen Compose',      icon: '🐙', endpoint: '/api/docker-intelligence/compose',        payload: () => ({ services: ['nginx', 'postgresql', 'redis'] }) },
  { id: 'scan-security', label: 'Scan Security',    icon: '🛡️', endpoint: '/api/docker-intelligence/security-scan',  payload: (df) => ({ dockerfile: df }) },
]

/**
 * DockerfileWorkspace — Monaco Editor with AI-powered toolbar actions.
 *
 * Props:
 *   value: string           — current dockerfile content (from store)
 *   onChange: (s) => void   — calls store.setDockerfileContent
 *   onActionResult: (action, result) => void  — called when an AI action completes
 */
export default function DockerfileWorkspace({ value, onChange, onActionResult }) {
  const { getAIConfig } = useAISettings()
  const { streaming, streamedText, streamError, elapsed, statusMsg, stream, cancel, reset } = useAIStream()

  const [activeAction, setActiveAction] = useState(null)
  const [showDiff, setShowDiff] = useState(false)
  const [optimizedContent, setOptimizedContent] = useState('')
  const [validationMsg, setValidationMsg] = useState('')
  const [monacoFailed, setMonacoFailed] = useState(false)

  const handleAction = useCallback(async (action) => {
    // Validate non-empty content
    if (!value || !value.trim()) {
      setValidationMsg('Please enter a Dockerfile before running an action.')
      setTimeout(() => setValidationMsg(''), 3000)
      return
    }
    setValidationMsg('')
    setActiveAction(action.id)
    reset()

    const aiConfig = getAIConfig()
    const payload = {
      ...aiConfig,
      ...action.payload(value),
    }

    const result = await stream(action.endpoint, payload)

    if (result.text && !result.error && !result.cancelled) {
      // For optimize actions, enable diff view
      if (['optimize', 'multistage', 'reduce-size'].includes(action.id)) {
        // Extract the Dockerfile block from the AI response
        const dfMatch = result.text.match(/```dockerfile\n([\s\S]*?)```/)
        if (dfMatch) {
          setOptimizedContent(dfMatch[1].trim())
          setShowDiff(true)
        }
      }
      onActionResult?.(action.id, result.text)
    }

    setActiveAction(null)
  }, [value, getAIConfig, stream, reset, onActionResult])

  const handleApplyOptimized = useCallback(() => {
    if (optimizedContent) {
      onChange(optimizedContent)
      setShowDiff(false)
      setOptimizedContent('')
    }
  }, [optimizedContent, onChange])

  return (
    <div className="flex flex-col h-full bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700/40 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-gray-700/40 bg-gray-900/80 flex-wrap">
        <span className="text-xs font-semibold text-gray-400 mr-1">Actions:</span>
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            disabled={streaming}
            title={action.label}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
              ${streaming
                ? 'opacity-40 cursor-not-allowed bg-gray-800/40 text-gray-500'
                : activeAction === action.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/60 hover:text-white border border-gray-700/40 hover:border-gray-600/60'
              }`}
          >
            <span>{action.icon}</span>
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        ))}

        <div className="flex-1" />

        {/* Load Example */}
        <button
          onClick={() => onChange(EXAMPLE_DOCKERFILE)}
          disabled={streaming}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>📋</span>
          <span>Load Example</span>
        </button>

        {streaming && (
          <button
            onClick={cancel}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
          >
            <span>⏹</span>
            <span>Stop</span>
          </button>
        )}
      </div>

      {/* Validation message */}
      {validationMsg && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs">
          ⚠️ {validationMsg}
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 flex min-h-0">
        {/* Main editor */}
        <div className={`flex flex-col ${showDiff ? 'w-1/2 border-r border-gray-700/40' : 'w-full'}`}>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-950/60 border-b border-gray-800/40">
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
            </div>
            <span className="text-xs text-gray-500 font-mono">Dockerfile</span>
            <div className="flex-1" />
            <span className="text-xs text-gray-600">{value ? `${value.split('\n').length} lines` : 'empty'}</span>
          </div>

          {monacoFailed ? (
            // Fallback textarea if Monaco fails to load
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="# Paste your Dockerfile here..."
              className="flex-1 w-full bg-gray-950 text-gray-200 font-mono text-sm p-4 resize-none outline-none border-0 placeholder-gray-700"
              spellCheck={false}
            />
          ) : (
            <Suspense fallback={<div className="flex-1 bg-gray-950 flex items-center justify-center text-gray-600 text-sm">Loading editor...</div>}>
              <Editor
                height="100%"
                language="dockerfile"
                theme="vs-dark"
                value={value}
                onChange={(v) => onChange(v || '')}
                onMount={(editor, monaco) => {
                  // Configure Dockerfile language basics
                  monaco.editor.defineTheme('docker-dark', {
                    base: 'vs-dark',
                    inherit: true,
                    rules: [],
                    colors: {
                      'editor.background': '#030712',
                      'editor.lineHighlightBackground': '#ffffff08',
                    },
                  })
                  monaco.editor.setTheme('docker-dark')
                }}
                onError={() => setMonacoFailed(true)}
                options={{
                  fontSize: 13,
                  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                  fontLigatures: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  renderLineHighlight: 'line',
                  padding: { top: 12, bottom: 12 },
                  wordWrap: 'on',
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  bracketPairColorization: { enabled: true },
                  guides: { bracketPairs: true },
                }}
              />
            </Suspense>
          )}
        </div>

        {/* Diff / result panel */}
        {showDiff && (
          <div className="w-1/2 flex flex-col">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-950/60 border-b border-gray-800/40">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-xs text-emerald-400 font-mono">Optimized</span>
              <div className="flex-1" />
              <button
                onClick={handleApplyOptimized}
                className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
              >
                Apply ✓
              </button>
              <button
                onClick={() => { setShowDiff(false); setOptimizedContent('') }}
                className="text-xs px-2 py-0.5 rounded bg-gray-700/40 text-gray-400 hover:bg-gray-700/60 transition-all"
              >
                Dismiss
              </button>
            </div>
            <Suspense fallback={<div className="flex-1 bg-gray-950" />}>
              <Editor
                height="100%"
                language="dockerfile"
                theme="vs-dark"
                value={optimizedContent}
                options={{
                  readOnly: true,
                  fontSize: 13,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  padding: { top: 12, bottom: 12 },
                  wordWrap: 'on',
                }}
              />
            </Suspense>
          </div>
        )}
      </div>

      {/* Streaming result panel */}
      {(streaming || streamedText) && (
        <div className="border-t border-gray-700/40 bg-gray-950/80 max-h-48 overflow-y-auto">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/40">
            {streaming && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs text-cyan-400 font-medium">{statusMsg || 'Streaming...'}</span>
                {elapsed > 0 && <span className="text-xs text-gray-600">{elapsed}s</span>}
              </>
            )}
            {!streaming && streamedText && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">Complete</span>
              </>
            )}
          </div>
          <div className="px-4 py-3 font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
            {streamedText}
            {streaming && <span className="inline-block w-1.5 h-3.5 bg-cyan-400 ml-0.5 animate-pulse align-middle" />}
          </div>
        </div>
      )}

      {/* Stream error */}
      {streamError && (
        <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs text-red-400">
          ⚠️ {streamError}
        </div>
      )}
    </div>
  )
}
