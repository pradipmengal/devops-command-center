import React, { useState, useCallback, useEffect } from 'react'
import { useAIStream } from '../../hooks/useAIStream'
import { useAISettings } from '../../context/AISettingsContext'
import useDockerIntelligenceStore from '../../store/useDockerIntelligenceStore'

const LOG_TAIL_OPTIONS = [50, 100, 200, 500]

interface LogEntry {
  line: string
  level: 'error' | 'warn' | 'info' | 'debug' | 'other'
}

function classifyLogLevel(line: string): LogEntry['level'] {
  const lower = line.toLowerCase()
  if (/\b(error|err|fatal|critical|exception|traceback)\b/.test(lower)) return 'error'
  if (/\b(warn|warning)\b/.test(lower)) return 'warn'
  if (/\b(info|notice)\b/.test(lower)) return 'info'
  if (/\b(debug|trace)\b/.test(lower)) return 'debug'
  return 'other'
}

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  error: 'text-red-400',
  warn: 'text-amber-400',
  info: 'text-gray-400',
  debug: 'text-gray-600',
  other: 'text-gray-500',
}

const LEVEL_BADGE: Record<LogEntry['level'], { bg: string; text: string }> = {
  error: { bg: 'bg-red-500/15', text: 'text-red-400' },
  warn: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  info: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  debug: { bg: 'bg-gray-700/40', text: 'text-gray-500' },
  other: { bg: 'bg-gray-700/40', text: 'text-gray-500' },
}

interface AILogAnalysisProps {
  containerId: string
  containerName: string
  image: string
  containerStatus: string
  initialLogs?: string[]
}

export default function AILogAnalysis({ containerId, containerName, image, containerStatus, initialLogs }: AILogAnalysisProps) {
  const { getAIConfig } = useAISettings()
  const { streaming, streamedText, streamError, stream, cancel, reset } = useAIStream()
  const setLogAnalysisResult = useDockerIntelligenceStore(s => s.setLogAnalysisResult)
  const savedResults = useDockerIntelligenceStore(s => s.logAnalysisResults)

  const [logs, setLogs] = useState<string[]>(initialLogs ?? [])
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)
  const [tailCount, setTailCount] = useState(100)
  const [showLogs, setShowLogs] = useState(false)
  const [logFilter, setLogFilter] = useState<LogEntry['level'] | 'all'>('all')

  const savedResult = savedResults[containerId]
  const hasAnalysis = !!savedResult && !streaming

  const fetchLogs = useCallback(async (tail: number, signal?: AbortSignal): Promise<string[]> => {
    setLogLoading(true)
    setLogError(null)
    try {
      const res = await fetch(`/api/docker-intelligence/containers?container_id=${containerId}&tail=${tail}`, { signal })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const fetchedLogs = data.data?.logs || []
      if (!signal?.aborted) {
        // Only overwrite if API returned actual logs; keep initial/preview logs otherwise
        if (fetchedLogs.length > 0) {
          setLogs(fetchedLogs)
        }
        setLogLoading(false)
      }
      return fetchedLogs
    } catch (err: any) {
      if (err.name === 'AbortError') return []
      if (!signal?.aborted) {
        setLogError(err.message)
        setLogLoading(false)
      }
      return []
    }
  }, [containerId])

  // Auto-fetch logs when the component mounts (container row expanded)
  // Aborts stale requests when containerId changes before previous fetch completes
  useEffect(() => {
    const abort = new AbortController()
    fetchLogs(tailCount, abort.signal)
    return () => abort.abort()
  }, [containerId, tailCount, fetchLogs])

  const handleAnalyze = async () => {
    // Fetch logs: use current, try API, then try docker CLI
    let logsToAnalyze = logs
    if (logsToAnalyze.length === 0) {
      logsToAnalyze = await fetchLogs(tailCount)
    }
    if (logsToAnalyze.length === 0) {
      // Fallback: run docker logs CLI command via backend
      setLogLoading(true)
      setLogError(null)
      try {
        const res = await fetch('/api/docker-intelligence/container-logs-cli', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ container_id: containerId, tail: tailCount }),
        })
        if (res.ok) {
          const data = await res.json()
          const cliLogs = data.data || []
          if (cliLogs.length > 0) {
            logsToAnalyze = cliLogs
            setLogs(cliLogs)
          }
        }
      } catch {
        // ignore — will show "No logs available" below
      } finally {
        setLogLoading(false)
      }
    }
    if (logsToAnalyze.length === 0) {
      setLogError('No logs available to analyze')
      return
    }

    const aiConfig = getAIConfig()
    if (!aiConfig.api_key && aiConfig.provider !== 'ollama' && aiConfig.provider !== 'opencode') {
      setLogError('AI provider not configured. Set your API key in AI settings.')
      return
    }

    reset()

    // Format logs into an analysis prompt, then use the working /explain endpoint
    const logLines = logsToAnalyze.slice(-500)
    const logText = logLines.join('\n')
    const question = [
      `Analyze the logs for container "${containerName || containerId}" (image: ${image || '?'}, status: ${containerStatus || '?'}).`,
      '',
      'Give a thorough diagnostic report including:',
      '- Log Summary (lines analyzed, overall health)',
      '- Error Patterns Detected (with frequency, severity, examples)',
      '- Root Cause Analysis',
      '- Recommendations (prioritized fixes)',
      '- Quick Fixes (specific commands)',
      '',
      'Logs:',
      '```',
      logText,
      '```',
    ].join('\n')

    const result = await stream('/api/docker-intelligence/explain', {
      ...aiConfig,
      question,
      dockerfile: '',
      history: [],
    })

    if (result.text) {
      setLogAnalysisResult(containerId, result.text)
    } else if (result.error) {
      setLogError(result.error)
    }
  }

  const classifiedLogs: LogEntry[] = logs.map(line => ({
    line,
    level: classifyLogLevel(line),
  }))

  const filteredLogs = logFilter === 'all'
    ? classifiedLogs
    : classifiedLogs.filter(l => l.level === logFilter)

  const errorCount = classifiedLogs.filter(l => l.level === 'error').length
  const warnCount = classifiedLogs.filter(l => l.level === 'warn').length

  return (
    <div className="bg-gray-950/60 rounded-xl border border-gray-700/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/60 bg-gray-900/40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-300">AI Log Analysis</span>
          {logLoading && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold">
              Loading...
            </span>
          )}
          {!logLoading && logs.length > 0 && (
            <span className="text-[9px] text-gray-500">{logs.length} lines</span>
          )}
          {errorCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-bold">
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">
              {warnCount} warn{warnCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={tailCount}
            onChange={(e) => setTailCount(Number(e.target.value))}
            className="text-[10px] bg-gray-800/60 text-gray-400 border border-gray-700/40 rounded px-1.5 py-0.5 outline-none"
          >
            {LOG_TAIL_OPTIONS.map(n => (
              <option key={n} value={n}>{n} lines</option>
            ))}
          </select>
          <button
            onClick={() => fetchLogs(tailCount)}
            disabled={logLoading}
            className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-800/60 text-gray-400 border border-gray-700/40 hover:text-gray-200 transition-all disabled:opacity-40"
          >
            {logLoading ? '...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowLogs(p => !p)}
            className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-800/60 text-gray-400 border border-gray-700/40 hover:text-gray-200 transition-all"
          >
            {showLogs ? 'Hide Logs' : 'Show Logs'}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={streaming || logLoading || logs.length === 0}
            className="text-[10px] px-2.5 py-0.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all disabled:opacity-40"
          >
            {streaming ? 'Analyzing...' : 'Analyze with AI'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {logError && (
        <div className="px-4 py-2 text-[10px] text-red-400 bg-red-500/5 border-b border-red-500/10">
          {logError}
        </div>
      )}

      {/* Log viewer */}
      {showLogs && logs.length > 0 && (
        <div className="border-b border-gray-800/40">
          {/* Filter bar */}
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900/30">
            <span className="text-[9px] text-gray-600 mr-1">Filter:</span>
            {(['all', 'error', 'warn', 'info', 'debug'] as const).map(level => {
              const count = level === 'all' ? logs.length : classifiedLogs.filter(l => l.level === level).length
              if (count === 0 && level !== 'all') return null
              return (
                <button
                  key={level}
                  onClick={() => setLogFilter(level)}
                  className={`text-[9px] px-1.5 py-0.5 rounded transition-all ${
                    logFilter === level
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {level} ({count})
                </button>
              )
            })}
          </div>
          {/* Log lines */}
          <div className="max-h-48 overflow-y-auto font-mono text-[10px] px-4 py-2 space-y-0.5">
            {filteredLogs.map((entry, i) => (
              <div key={i} className={`leading-relaxed flex gap-2 ${LEVEL_COLORS[entry.level]}`}>
                {entry.level !== 'other' && entry.level !== 'info' && (
                  <span className={`inline-block px-1 rounded text-[8px] font-bold uppercase shrink-0 ${LEVEL_BADGE[entry.level].bg} ${LEVEL_BADGE[entry.level].text}`}>
                    {entry.level}
                  </span>
                )}
                <span className="break-all">{entry.line}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI analysis output (streaming) */}
      {(streaming || streamedText) && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            {streaming && <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />}
            <span className="text-[10px] font-semibold text-violet-400">AI Analysis</span>
            {streaming && (
              <button onClick={cancel} className="ml-auto text-[10px] text-red-400 hover:text-red-300">Stop</button>
            )}
          </div>
          <div className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {streamedText}
            {streaming && <span className="inline-block w-1.5 h-3 bg-violet-400 ml-0.5 animate-pulse align-middle" />}
          </div>
        </div>
      )}

      {/* Saved analysis result (not streaming) */}
      {hasAnalysis && !streamedText && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold text-emerald-400">Previous Analysis</span>
            <button
              onClick={handleAnalyze}
              className="text-[10px] text-gray-500 hover:text-gray-300 underline"
            >
              Re-analyze
            </button>
          </div>
          <div className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {savedResult}
          </div>
        </div>
      )}

      {/* Stream error */}
      {streamError && (
        <div className="px-4 py-2 text-[10px] text-red-400 bg-red-500/5 border-t border-red-500/10">
          {streamError}
        </div>
      )}

      {/* Loading state */}
      {logLoading && logs.length === 0 && (
        <div className="px-4 py-6 text-center text-[10px] text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-cyan-400 rounded-full animate-spin mx-auto mb-2" />
          Fetching container logs...
        </div>
      )}

      {/* Empty state */}
      {!logLoading && logs.length === 0 && !streaming && !hasAnalysis && !logError && (
        <div className="px-4 py-6 text-center text-[10px] text-gray-600">
          No logs available for this container.
        </div>
      )}
    </div>
  )
}
