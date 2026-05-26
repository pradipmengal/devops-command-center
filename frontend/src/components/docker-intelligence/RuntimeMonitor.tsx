import React, { useState, useEffect, useCallback } from 'react'
import { useAIStream } from '../../hooks/useAIStream'
import { useAISettings } from '../../context/AISettingsContext'
import useDockerIntelligenceStore from '../../store/useDockerIntelligenceStore'

const POLL_INTERVAL_MS = 10000

function getRowHighlight(container) {
  if (container.healthStatus === 'unhealthy') {
    return 'bg-red-500/10 border-l-2 border-red-500/60'
  }
  if (container.restartCount > 3) {
    return 'bg-amber-500/10 border-l-2 border-amber-500/60'
  }
  return 'hover:bg-gray-800/30'
}

function HealthBadge({ status }) {
  const styles = {
    healthy:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    unhealthy: 'bg-red-500/15 text-red-400 border-red-500/25',
    starting:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
    none:      'bg-gray-700/40 text-gray-500 border-gray-600/30',
  }
  const icons = { healthy: '✓', unhealthy: '✗', starting: '…', none: '—' }
  const cls = styles[status] || styles.none
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${cls}`}>
      {icons[status] || '—'} {status}
    </span>
  )
}

/**
 * RuntimeMonitor — live container status table with AI anomaly detection.
 *
 * Props:
 *   containers: Container[]
 *   onRefresh: () => void
 */
export default function RuntimeMonitor({ containers = [], onRefresh }) {
  const { getAIConfig } = useAISettings()
  const { streaming, streamedText, streamError, stream, cancel, reset } = useAIStream()
  const setContainers = useDockerIntelligenceStore(s => s.setContainers)

  const [selectedContainer, setSelectedContainer] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [isPolling, setIsPolling] = useState(true)

  const fetchContainers = useCallback(async () => {
    try {
      const res = await fetch('/api/docker-intelligence/containers')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setContainers(data.data || [])
      setFetchError(null)
    } catch (err) {
      setFetchError(err.message)
    }
  }, [setContainers])

  // Initial fetch + polling
  useEffect(() => {
    fetchContainers()
    if (!isPolling) return
    const interval = setInterval(fetchContainers, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchContainers, isPolling])

  const handleAnomalyDetection = async () => {
    const aiConfig = getAIConfig()
    reset()
    const summary = containers.map(c =>
      `${c.name}: CPU=${c.cpuPercent}%, MEM=${c.memoryUsage}, restarts=${c.restartCount}, health=${c.healthStatus}`
    ).join('\n')

    await stream('/api/docker-intelligence/explain', {
      ...aiConfig,
      question: `Analyze these container metrics and identify anomalies, potential issues, and corrective actions:\n\n${summary}`,
      dockerfile: '',
      history: [],
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-300">🖥️ Container Runtime</h3>
          <div className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-[10px] text-gray-600">{isPolling ? 'Live' : 'Paused'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPolling(p => !p)}
            className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all
              ${isPolling
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'bg-gray-800/60 text-gray-400 border-gray-700/40 hover:text-gray-200'
              }`}
          >
            {isPolling ? '⏸ Pause' : '▶ Resume'}
          </button>
          <button
            onClick={fetchContainers}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-gray-800/60 text-gray-400 border border-gray-700/40 hover:text-gray-200 transition-all"
          >
            ↻ Refresh
          </button>
          <button
            onClick={handleAnomalyDetection}
            disabled={streaming}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all disabled:opacity-40"
          >
            🤖 AI Analyze
          </button>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <span>⚠️ Failed to fetch containers: {fetchError}</span>
          <button onClick={fetchContainers} className="underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Container table */}
      <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700/40 overflow-hidden">
        {containers.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500">
            {fetchError ? 'Could not load containers' : 'No running containers'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/40 bg-gray-900/40">
                  {['Name', 'Image', 'CPU', 'Memory', 'Restarts', 'Health', 'Ports'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {containers.map((container) => {
                  const isSelected = selectedContainer?.id === container.id
                  const rowClass = getRowHighlight(container)
                  return (
                    <React.Fragment key={container.id}>
                      <tr
                        onClick={() => setSelectedContainer(isSelected ? null : container)}
                        className={`border-b border-gray-800/40 cursor-pointer transition-all ${rowClass}`}
                      >
                        <td className="px-3 py-2.5 font-mono text-cyan-400 font-medium whitespace-nowrap">{container.name}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-400 whitespace-nowrap">{container.image}</td>
                        <td className="px-3 py-2.5">
                          <span className={`font-mono font-semibold ${container.cpuPercent > 80 ? 'text-red-400' : container.cpuPercent > 50 ? 'text-amber-400' : 'text-gray-300'}`}>
                            {container.cpuPercent}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-gray-400 whitespace-nowrap">{container.memoryUsage}</td>
                        <td className="px-3 py-2.5">
                          <span className={`font-mono font-bold ${container.restartCount > 3 ? 'text-amber-400' : 'text-gray-400'}`}>
                            {container.restartCount}
                            {container.restartCount > 3 && ' ⚠️'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <HealthBadge status={container.healthStatus} />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-gray-500 text-[10px]">
                          {container.ports?.join(', ') || '—'}
                        </td>
                      </tr>

                      {/* Expanded log viewer */}
                      {isSelected && (
                        <tr>
                          <td colSpan={7} className="px-4 py-3 bg-gray-950/60 border-b border-gray-700/40">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                <span>Networks: <span className="text-gray-400">{container.networks?.join(', ') || '—'}</span></span>
                                <span>Volumes: <span className="text-gray-400">{container.volumes?.join(', ') || '—'}</span></span>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Recent Logs</p>
                                <div className="bg-gray-950 rounded-lg p-3 max-h-32 overflow-y-auto font-mono text-[10px] text-gray-400 space-y-0.5">
                                  {(container.logs || []).map((log, i) => (
                                    <div key={i} className="leading-relaxed">{log}</div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI anomaly analysis output */}
      {(streaming || streamedText) && (
        <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-violet-500/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-violet-500/10 bg-violet-500/5">
            {streaming && <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />}
            <span className="text-xs font-semibold text-violet-400">AI Anomaly Analysis</span>
            {streaming && (
              <button onClick={cancel} className="ml-auto text-[10px] text-red-400 hover:text-red-300">Stop</button>
            )}
          </div>
          <div className="px-4 py-3 text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {streamedText}
            {streaming && <span className="inline-block w-1.5 h-3 bg-violet-400 ml-0.5 animate-pulse align-middle" />}
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
