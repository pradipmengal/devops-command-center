import React, { useMemo, useState } from 'react'
import TooltipPortal from './TooltipPortal'

const COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#3b82f6',
  '#a855f7', '#22c55e', '#eab308', '#64748b', '#0ea5e9',
]

/**
 * BreakdownPieChart — native SVG donut chart showing cost distribution by category.
 */
export default function BreakdownPieChart({ filteredEntries = [], compact = false }) {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, entry: null })

  const slices = useMemo(() => {
    if (!filteredEntries.length) return []
    const totals = {}
    for (const e of filteredEntries) {
      totals[e.category] = (totals[e.category] || 0) + e.price_usd
    }
    const total = Object.values(totals).reduce((s, v) => s + v, 0)
    if (total === 0) return []

    let cumAngle = -Math.PI / 2
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([category, value], i) => {
        const angle = (value / total) * 2 * Math.PI
        const startAngle = cumAngle
        cumAngle += angle
        return { category, value, total, angle, startAngle, endAngle: cumAngle, color: COLORS[i % COLORS.length] }
      })
  }, [filteredEntries])

  const chartSize = compact ? 200 : 260
  const cx = chartSize / 2
  const cy = chartSize / 2
  const outerR = compact ? 80 : 105
  const innerR = compact ? 48 : 62

  const describeArc = (startAngle, endAngle, r) => {
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  const formatTotal = (v) => {
    if (v < 1) return `$${v.toFixed(4)}`
    if (v < 1000) return `$${v.toFixed(2)}`
    return `$${(v / 1000).toFixed(1)}k`
  }

  if (!slices.length) {
    return (
      <div className="card p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-500 text-sm">No data to display.</p>
      </div>
    )
  }

  const total = slices[0]?.total ?? 0

  return (
    <div className="card p-4">
      <div className="flex flex-col lg:flex-row items-center gap-4">
        {/* SVG donut */}
        <div className="flex-shrink-0">
          <svg width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`}>
            {slices.map((slice, i) => {
              const midAngle = (slice.startAngle + slice.endAngle) / 2
              const pathOuter = describeArc(slice.startAngle, slice.endAngle, outerR)
              const pathInner = describeArc(slice.endAngle, slice.startAngle, innerR)
              const d = `${pathOuter} L ${cx + innerR * Math.cos(slice.endAngle)} ${cy + innerR * Math.sin(slice.endAngle)} ${pathInner} Z`

              return (
                <path
                  key={slice.category}
                  d={d}
                  fill={slice.color}
                  opacity={0.85}
                  className="cursor-pointer transition-opacity duration-150 hover:opacity-100"
                  onMouseEnter={(e) => setTooltip({
                    visible: true, x: e.clientX, y: e.clientY,
                    entry: { service_name: slice.category, provider: 'All', price_usd: slice.value, unit: 'total', tier_label: `${((slice.value / total) * 100).toFixed(1)}% of total` },
                  })}
                  onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, entry: null })}
                >
                  <title>{slice.category}: {formatTotal(slice.value)}</title>
                </path>
              )
            })}
            {/* Center label */}
            <text x={cx} y={cy - 8} textAnchor="middle" fontSize={compact ? 11 : 13} fill="#9ca3af" fontFamily="sans-serif">Total</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize={compact ? 14 : 17} fill="#e5e7eb" fontFamily="monospace" fontWeight="bold">
              {formatTotal(total)}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
          {slices.slice(0, 12).map((slice) => (
            <div key={slice.category} className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: slice.color }} />
              <span className="text-gray-400 truncate flex-1 text-[11px]">{slice.category}</span>
              <span className="text-gray-300 font-mono text-[10px] flex-shrink-0">{formatTotal(slice.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <TooltipPortal {...tooltip} regionMultiplier={1} />
    </div>
  )
}
