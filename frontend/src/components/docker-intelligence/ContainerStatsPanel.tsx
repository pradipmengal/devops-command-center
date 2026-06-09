import React, { useState, useEffect, useRef } from 'react'

interface StatsPoint {
  cpu: number
  mem_used_mb: number
  mem_limit_mb: number
  net_rx_bytes: number
  net_tx_bytes: number
  blk_read_bytes: number
  blk_write_bytes: number
  timestamp: string
}

interface Props {
  containerId: string
}

const MAX_POINTS = 30
const CHART_W = 160
const CHART_H = 48

function formatBytes(v: number): string {
  if (v >= 1048576) return `${(v / 1048576).toFixed(1)}MB/s`
  if (v >= 1024) return `${(v / 1024).toFixed(1)}KB/s`
  return `${v}B/s`
}

function ChartLine({
  data,
  color,
  fixedMax,
  formatValue,
  label,
}: {
  data: number[]
  color: string
  fixedMax?: number
  formatValue: (v: number) => string
  label: string
}) {
  if (data.length < 2) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
        <div className="text-[10px] text-gray-600 italic">waiting...</div>
      </div>
    )
  }

  const vals = data.slice(-MAX_POINTS)
  const min = Math.min(...vals)
  const max = fixedMax ?? Math.max(...vals)
  const range = Math.max(max - min, 1)

  const points = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * (CHART_W - 4) + 2
      const y = CHART_H - 2 - ((v - min) / range) * (CHART_H - 4)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const latest = vals[vals.length - 1]

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[11px] font-semibold font-mono" style={{ color }}>
          {formatValue(latest)}
        </span>
      </div>
      <svg
        width={CHART_W}
        height={CHART_H}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="bg-gray-950/60 rounded overflow-visible"
      >
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  )
}

export default function ContainerStatsPanel({ containerId }: Props) {
  const [points, setPoints] = useState<StatsPoint[]>([])
  const aborterRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!containerId) return

    const abort = new AbortController()
    aborterRef.current = abort
    setPoints([])

    const connect = async () => {
      try {
        const res = await fetch(
          `/api/docker-intelligence/container-stats/${containerId}`,
          { signal: abort.signal },
        )
        if (!res.ok || !res.body) return

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const payload = JSON.parse(line.slice(6))
                if (payload.error) continue
                setPoints((prev) => {
                  const next = [...prev, payload]
                  if (next.length > MAX_POINTS) return next.slice(-MAX_POINTS)
                  return next
                })
              } catch {
                // skip malformed lines
              }
            }
          }
        }
      } catch {
        // aborted or network error
      }
    }

    connect()

    return () => {
      abort.abort()
      aborterRef.current = null
    }
  }, [containerId])

  if (points.length === 0) {
    return (
      <div className="bg-gray-900/60 rounded-xl border border-gray-700/40 p-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] text-gray-500">
            Connecting to live metrics...
          </span>
        </div>
      </div>
    )
  }

  const cpuVals = points.map((p) => p.cpu)
  const memVals = points.map((p) => p.mem_used_mb)
  const memLimit = points[points.length - 1]?.mem_limit_mb || 512
  const netRxVals = points.map((p) => p.net_rx_bytes)
  const netTxVals = points.map((p) => p.net_tx_bytes)
  const blkReadVals = points.map((p) => p.blk_read_bytes)

  return (
    <div className="bg-gray-900/60 rounded-xl border border-gray-700/40 p-3">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
        Live Metrics &mdash; 60s window
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ChartLine
          data={cpuVals}
          color="#22d3ee"
          fixedMax={100}
          formatValue={(v) => `${v.toFixed(1)}%`}
          label="CPU"
        />
        <ChartLine
          data={memVals}
          color="#34d399"
          fixedMax={memLimit}
          formatValue={(v) => `${v}MB / ${memLimit}MB`}
          label="Memory"
        />
        <ChartLine
          data={netRxVals}
          color="#f59e0b"
          formatValue={(v) => formatBytes(v)}
          label="Net RX"
        />
        <ChartLine
          data={blkReadVals}
          color="#f472b6"
          formatValue={(v) => formatBytes(v)}
          label="Disk IO"
        />
      </div>
    </div>
  )
}
