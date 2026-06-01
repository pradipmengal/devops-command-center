import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAIStream } from '../../hooks/useAIStream'
import { useAISettings } from '../../context/AISettingsContext'
import useDockerIntelligenceStore from '../../store/useDockerIntelligenceStore'

const POLL_INTERVAL_MS = 10000
const MAX_HISTORY = 30

function parseMemoryMB(memoryUsage) {
  if (!memoryUsage) return 0
  const match = memoryUsage.match(/([\d.]+)\s*MB/)
  return match ? parseFloat(match[1]) : 0
}

function Sparkline({ data, color, width = 60, height = 24 }) {
  if (!data || data.length < 2) {
    return <div className="w-[60px] h-[24px]" />
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 2) + 1
    const y = height - 2 - ((v - min) / range) * (height - 4)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

function getRowHighlight(container) {
  if (container.status === 'exited' || container.status === 'stopped') {
    return 'opacity-50 hover:bg-gray-800/30'
  }
  if (container.healthStatus === 'unhealthy') {
    return 'bg-red-500/10 border-l-2 border-red-500/60'
  }
  if (container.restartCount > 3) {
    return 'bg-amber-500/10 border-l-2 border-amber-500/60'
  }
  return 'hover:bg-gray-800/30'
}

function StatusBadge({ status, healthStatus }) {
  if (status === 'exited' || status === 'stopped') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-gray-700/40 text-gray-500 border-gray-600/30">
        ⏹ {status}
      </span>
    )
  }
  const styles = {
    healthy:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    unhealthy: 'bg-red-500/15 text-red-400 border-red-500/25',
    starting:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
    none:      'bg-gray-700/40 text-gray-500 border-gray-600/30',
  }
  const icons = { healthy: '✓', unhealthy: '✗', starting: '…', none: '—' }
  const cls = styles[healthStatus] || styles.none
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${cls}`}>
      {icons[healthStatus] || '—'} {healthStatus}
    </span>
  )
}

export default function RuntimeMonitor({ containers = [], onRefresh }) {
  const { getAIConfig } = useAISettings()
  const { streaming, streamedText, streamError, stream, cancel, reset } = useAIStream()
  const setContainers = useDockerIntelligenceStore(s => s.setContainers)

  const [selectedContainer, setSelectedContainer] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [isPolling, setIsPolling] = useState(true)
  const [metricsHistory, setMetricsHistory] = useState({})
  const [actionLoading, setActionLoading] = useState({})
  const prevContainersRef = useRef()

  const performAction = useCallback(async (containerId, action) => {
    const key = `${containerId}-${action}`
    setActionLoading(l => ({ ...l, [key]: true }))
    try {
      const res = await fetch(`/api/docker-intelligence/containers/${containerId}/${action}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || `HTTP ${res.status}`)
      }
      await fetchContainers()
    } catch (err) {
      setFetchError(`${action} failed: ${err.message}`)
    } finally {
      setActionLoading(l => ({ ...l, [key]: false }))
    }
  }, [])

  const fetchContainers = useCallback(async () => {
    try {
      const res = await fetch('/api/docker-intelligence/containers')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const list = data.data || []
      setContainers(list)
      setFetchError(null)

      setMetricsHistory(prev => {
        const next = { ...prev }
        for (const c of list) {
          const point = {
            cpu: c.cpuPercent ?? 0,
            mem: parseMemoryMB(c.memoryUsage),
            ts: Date.now(),
          }
          const arr = prev[c.id] ? [...prev[c.id], point] : [point]
          next[c.id] = arr.slice(-MAX_HISTORY)
        }
        return next
      })
    } catch (err) {
      setFetchError(err.message)
    }
  }, [setContainers])

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

  const isLoading = (containerId, action) => {
    return actionLoading[`${containerId}-${action}`] || false
  }

  const ActionButton = ({ action, label, container, color }) => {
    const loading = isLoading(container.fullId || container.id, action)
    return (
      <button
        onClick={(e) => { e.stopPropagation(); performAction(container.fullId || container.id, action) }}
        disabled={loading}
        className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${color} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {loading ? '…' : label}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-300">🖥️ Container Runtime</h3>
          <div className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-[10px] text-gray-600">{isPolling ? 'Live' : 'Paused'}</span>
          <span className="text-[10px] text-gray-600 ml-2">{containers.length} container{containers.length !== 1 ? 's' : ''}</span>
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
          <span>⚠️ {fetchError}</span>
          <button onClick={fetchContainers} className="underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Container table */}
      <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700/40 overflow-hidden">
        {containers.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500">
            {fetchError ? 'Could not load containers' : 'No containers found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/40 bg-gray-900/40">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Image</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">CPU</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">CPU Trend</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Memory</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">MEM Trend</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Restarts</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                  {containers.map((container) => {
                  const isSelected = selectedContainer?.id === container.id
                  const rowClass = getRowHighlight(container)
                  const hist = metricsHistory[container.id] || []
                  const cpuData = hist.map(p => p.cpu)
                  const memData = hist.map(p => p.mem)
                  const isStopped = container.status === 'exited' || container.status === 'stopped'
                  return (
                    <React.Fragment key={container.id}>
                      <tr
                        onClick={() => setSelectedContainer(isSelected ? null : container)}
                        className={`border-b border-gray-800/40 cursor-pointer transition-all ${rowClass}`}
                      >
                        <td className="px-3 py-2.5 font-mono text-cyan-400 font-medium whitespace-nowrap">{container.name}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-400 whitespace-nowrap max-w-[120px] truncate">{container.image}</td>
                        <td className="px-3 py-2.5">
                          {isStopped ? (
                            <span className="font-mono text-gray-600">—</span>
                          ) : (
                          <span className={`font-mono font-semibold ${container.cpuPercent > 80 ? 'text-red-400' : container.cpuPercent > 50 ? 'text-amber-400' : 'text-gray-300'}`}>
                            {container.cpuPercent}%
                          </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">{!isStopped && hist.length >= 2 && <Sparkline data={cpuData} color="#22d3ee" />}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-400 whitespace-nowrap">{isStopped ? <span className="text-gray-600">—</span> : container.memoryUsage}</td>
                        <td className="px-3 py-2.5">{!isStopped && hist.length >= 2 && <Sparkline data={memData} color="#34d399" />}</td>
                        <td className="px-3 py-2.5">
                          <span className={`font-mono font-bold ${container.restartCount > 3 ? 'text-amber-400' : isStopped ? 'text-gray-600' : 'text-gray-400'}`}>
                            {container.restartCount}
                            {!isStopped && container.restartCount > 3 && ' ⚠️'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={container.status} healthStatus={container.healthStatus} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <ActionButton action="start" label="▶" container={container} color="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" />
                            {!isStopped && <ActionButton action="stop" label="⏹" container={container} color="bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20" />}
                            {!isStopped && <ActionButton action="restart" label="↻" container={container} color="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20" />}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row: ports, networks, volumes, logs */}
                      {isSelected && (
                        <tr>
                          <td colSpan={9} className="px-4 py-3 bg-gray-950/60 border-b border-gray-700/40">
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-4 text-[10px] text-gray-500">
                                <span>Ports: <span className="text-gray-400">{container.ports?.join(', ') || '—'}</span></span>
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