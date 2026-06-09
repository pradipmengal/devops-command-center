import React, { useState, useEffect } from 'react'
import axios from 'axios'
import NetworkTopologyMap from './NetworkTopologyMap'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortEntry {
  container: string; containerId: string
  containerPort: string; protocol: string
  hostIp: string | null; hostPort: string | null
  published: boolean; risks: string[]
}

interface DnsResult {
  from_container: string; target: string
  resolved: boolean; resolved_ip: string | null
  output: string; command_used: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_LABELS: Record<string, { label: string; color: string }> = {
  exposed_all_interfaces:  { label: '0.0.0.0 — all interfaces', color: 'text-red-400' },
  privileged_host_port:    { label: 'privileged host port (<1024)', color: 'text-amber-400' },
  privileged_container_port: { label: 'privileged container port', color: 'text-amber-400' },
  duplicate_host_port:     { label: 'duplicate host port', color: 'text-orange-400' },
}

function SectionCard({ title, icon, children, onRefresh, loading }: {
  title: string; icon: string; children: React.ReactNode
  onRefresh?: () => void; loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-gray-700/40 bg-gray-900/60 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold text-gray-200">{title}</span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700/40 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-40"
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  )
}

function Badge({ text, variant = 'gray' }: { text: string; variant?: 'gray'|'cyan'|'red'|'green'|'amber' }) {
  const colors = {
    gray:  'bg-gray-700/40 text-gray-400 border-gray-600/30',
    cyan:  'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
    red:   'bg-red-500/15 text-red-400 border-red-500/25',
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  }
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${colors[variant]}`}>
      {text}
    </span>
  )
}

// ── Port Exposure Auditor ─────────────────────────────────────────────────────

function PortAuditSection() {
  const [entries, setEntries] = useState<PortEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'risks'>('all')

  const fetch = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await axios.get('/api/docker-networking/port-audit')
      if (data.status === 'success') setEntries(data.data)
      else setError(data.message)
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  const displayed = filter === 'risks' ? entries.filter(e => e.risks.length > 0) : entries
  const riskCount = entries.filter(e => e.risks.length > 0).length

  return (
    <SectionCard title="Port Exposure Auditor" icon="🔌" onRefresh={fetch} loading={loading}>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setFilter('all')}
          className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${filter === 'all' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-gray-800 text-gray-500 border-gray-700/40 hover:text-gray-300'}`}
        >
          All ({entries.length})
        </button>
        <button
          onClick={() => setFilter('risks')}
          className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${filter === 'risks' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-gray-800 text-gray-500 border-gray-700/40 hover:text-gray-300'}`}
        >
          ⚠ Risks ({riskCount})
        </button>
      </div>

      {displayed.length === 0 && !loading && (
        <p className="text-xs text-gray-500">{filter === 'risks' ? 'No risky ports found.' : 'No ports found.'}</p>
      )}

      <div className="space-y-2">
        {displayed.map((entry, i) => (
          <div
            key={i}
            className={`rounded-lg border px-3 py-2.5 ${
              entry.risks.length > 0
                ? 'border-red-500/20 bg-red-500/5'
                : 'border-gray-700/30 bg-gray-800/30'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">{entry.risks.length > 0 ? '⚠️' : '✅'}</span>
                <span className="text-xs font-semibold text-gray-200 truncate">{entry.container}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!entry.published && <Badge text="not published" variant="gray" />}
                <Badge text={entry.protocol} variant="gray" />
              </div>
            </div>

            <div className="mt-1.5 flex items-center gap-1 text-[11px] font-mono">
              {entry.published ? (
                <>
                  <span className={entry.hostIp === '0.0.0.0' ? 'text-red-400' : 'text-emerald-400'}>
                    {entry.hostIp}:{entry.hostPort}
                  </span>
                  <span className="text-gray-600">→</span>
                  <span className="text-gray-300">{entry.containerPort}</span>
                </>
              ) : (
                <span className="text-gray-500">container port {entry.containerPort} (not bound to host)</span>
              )}
            </div>

            {entry.risks.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {entry.risks.map(r => (
                  <span key={r} className={`text-[10px] ${RISK_LABELS[r]?.color ?? 'text-gray-400'}`}>
                    • {RISK_LABELS[r]?.label ?? r}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ── DNS Resolution Checker ────────────────────────────────────────────────────

function DnsCheckSection() {
  const [fromContainer, setFromContainer] = useState('')
  const [target, setTarget] = useState('')
  const [result, setResult] = useState<DnsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!fromContainer.trim() || !target.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const { data } = await axios.post('/api/docker-networking/dns-check', {
        from_container: fromContainer.trim(),
        target: target.trim(),
      })
      if (data.status === 'success') setResult(data.data)
      else setError(data.message)
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message)
    } finally { setLoading(false) }
  }

  return (
    <SectionCard title="DNS Resolution Checker" icon="🔍">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">From container</label>
            <input
              value={fromContainer}
              onChange={e => setFromContainer(e.target.value)}
              placeholder="e.g. api-service"
              className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Resolve target</label>
            <input
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="e.g. postgres-db"
              className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              onKeyDown={e => e.key === 'Enter' && run()}
            />
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading || !fromContainer.trim() || !target.trim()}
          className="w-full py-2 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all disabled:opacity-40"
        >
          {loading ? 'Checking…' : 'Check DNS Resolution'}
        </button>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className={`rounded-lg border px-3 py-3 space-y-2 ${result.resolved ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{result.resolved ? '✅' : '❌'}</span>
              <div>
                <p className="text-xs font-semibold text-gray-200">
                  {result.resolved ? 'Resolved successfully' : 'Resolution failed'}
                </p>
                <p className="text-[11px] text-gray-500">
                  <span className="text-gray-300">{result.from_container}</span>
                  {' → '}
                  <span className="text-gray-300">{result.target}</span>
                </p>
              </div>
              {result.resolved_ip && (
                <span className="ml-auto font-mono text-xs text-cyan-400">{result.resolved_ip}</span>
              )}
            </div>

            {result.output && (
              <pre className="text-[10px] text-gray-400 bg-gray-900/60 rounded p-2 overflow-auto max-h-32 font-mono whitespace-pre-wrap">
                {result.output}
              </pre>
            )}

            <p className="text-[10px] text-gray-600">via <code className="text-gray-500">{result.command_used}</code></p>
          </div>
        )}

        <p className="text-[10px] text-gray-600">
          Runs <code className="text-gray-500">nslookup</code> inside the source container via <code className="text-gray-500">docker exec</code>.
          Both containers must share a network for DNS to resolve.
        </p>
      </div>
    </SectionCard>
  )
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function NetworkingPanel() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
      <div className="xl:col-span-2">
        <NetworkTopologyMap />
      </div>
      <PortAuditSection />
      <DnsCheckSection />
    </div>
  )
}
