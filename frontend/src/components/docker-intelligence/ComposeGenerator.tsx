import React, { useState, useRef, Suspense } from 'react'
import Editor from '@monaco-editor/react'
import { useAIStream } from '../../hooks/useAIStream'
import { useAISettings } from '../../context/AISettingsContext'

const AVAILABLE_SERVICES = [
  { id: 'postgresql', label: 'PostgreSQL', icon: '🐘', description: 'Relational database' },
  { id: 'mysql',      label: 'MySQL',      icon: '🐬', description: 'Relational database' },
  { id: 'redis',      label: 'Redis',      icon: '🔴', description: 'In-memory cache/store' },
  { id: 'mongodb',    label: 'MongoDB',    icon: '🍃', description: 'Document database' },
  { id: 'nginx',      label: 'Nginx',      icon: '🌐', description: 'Web server / proxy' },
  { id: 'rabbitmq',   label: 'RabbitMQ',   icon: '🐰', description: 'Message broker' },
  { id: 'elasticsearch', label: 'Elasticsearch', icon: '🔍', description: 'Search engine' },
  { id: 'kafka',      label: 'Kafka',      icon: '📨', description: 'Event streaming' },
]

/**
 * ComposeGenerator — generates production-ready docker-compose.yml files.
 */
export default function ComposeGenerator() {
  const { getAIConfig } = useAISettings()
  const { streaming, streamedText, streamError, elapsed, statusMsg, stream, cancel, reset } = useAIStream()

  const [selectedServices, setSelectedServices] = useState(new Set())
  const [composeOutput, setComposeOutput] = useState('')
  const [validationMsg, setValidationMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const toggleService = (id) => {
    setSelectedServices(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleGenerate = async () => {
    if (selectedServices.size === 0) {
      setValidationMsg('Please select at least one service.')
      setTimeout(() => setValidationMsg(''), 3000)
      return
    }
    setValidationMsg('')
    setComposeOutput('')
    reset()

    const aiConfig = getAIConfig()
    const result = await stream('/api/docker-intelligence/compose', {
      ...aiConfig,
      services: Array.from(selectedServices),
    })

    if (result.text && !result.error && !result.cancelled) {
      // Extract YAML from code block if present
      const yamlMatch = result.text.match(/```(?:yaml|yml)?\n([\s\S]*?)```/)
      setComposeOutput(yamlMatch ? yamlMatch[1].trim() : result.text)
    }
  }

  const handleCopy = async () => {
    if (!composeOutput) return
    await navigator.clipboard.writeText(composeOutput)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!composeOutput) return
    const blob = new Blob([composeOutput], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'docker-compose.yml'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Service selector */}
      <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">🐙 Compose Generator</h3>
          {selectedServices.size > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {selectedServices.size} selected
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {AVAILABLE_SERVICES.map((svc) => {
            const isSelected = selectedServices.has(svc.id)
            return (
              <button
                key={svc.id}
                onClick={() => toggleService(svc.id)}
                disabled={streaming}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all
                  ${isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                    : 'bg-gray-800/40 border-gray-700/30 text-gray-400 hover:border-gray-600/50 hover:text-gray-200'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span className="text-base flex-shrink-0">{svc.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight">{svc.label}</p>
                  <p className="text-[9px] text-gray-600 leading-tight">{svc.description}</p>
                </div>
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-cyan-400 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        {validationMsg && (
          <p className="text-xs text-amber-400 mb-3">⚠️ {validationMsg}</p>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={streaming || selectedServices.size === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/20"
          >
            {streaming ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>🐙 Generate Compose</>
            )}
          </button>

          {streaming && (
            <button onClick={cancel} className="text-xs px-3 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all">
              Stop
            </button>
          )}

          {streaming && (
            <span className="text-xs text-gray-500">{statusMsg} {elapsed > 0 && `(${elapsed}s)`}</span>
          )}
        </div>
      </div>

      {/* Output editor */}
      {(composeOutput || (streaming && streamedText)) && (
        <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/40 bg-gray-900/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-300">docker-compose.yml</span>
              {streaming && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!composeOutput}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-gray-800/60 text-gray-400 border border-gray-700/40 hover:text-gray-200 transition-all disabled:opacity-40"
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
              <button
                onClick={handleDownload}
                disabled={!composeOutput}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-40"
              >
                ⬇ Download
              </button>
            </div>
          </div>

          <div style={{ height: '400px' }}>
            <Suspense fallback={<div className="h-full bg-gray-950 flex items-center justify-center text-gray-600 text-xs">Loading editor...</div>}>
              <Editor
                height="100%"
                language="yaml"
                theme="vs-dark"
                value={composeOutput || streamedText}
                options={{
                  readOnly: true,
                  fontSize: 12,
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
        </div>
      )}

      {streamError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
          ⚠️ {streamError}
        </div>
      )}
    </div>
  )
}
