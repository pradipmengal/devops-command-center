import React, { useMemo, useState } from 'react'
import TooltipPortal from './TooltipPortal'

/**
 * CostHeatmap — native SVG grid showing cost intensity per category × provider.
 */
export default function CostHeatmap({ filteredEntries = [], activeProviders = [], anomalySet = new Set(), compact = false }) {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, entry: null })

  const { categories, grid } = useMemo(() => {
    const cats = [...new Set(filteredEntries.map((e) => e.category))]
    const grid = cats.map((cat) => {
      const row = activeProviders.map((prov) => {
        const entry = filteredEntries.find((e) => e.category === cat && e.provider === prov)
        return { provider: prov, entry: entry || null, price: entry?.price_usd ?? 0 }
      })
      const rowMax = Math.max(...row.map((c) => c.price), 0.0001)
      return { category: cat, cells: row, rowMax }
    })
    return { categories: cats, grid }
  }, [filteredEntries, activeProviders])

  if (!categories.length || !activeProviders.length) {
    return (
      <div className="card p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-500 text-sm">No data to display.</p>
      </div>
    )
  }

  const CELL_W = compact ? 80 : 110
  const CELL_H = compact ? 28 : 36
  const LABEL_W = compact ? 130 : 180
  const HEADER_H = 32
  const svgW = LABEL_W + activeProviders.length * CELL_W + 16
  const svgH = HEADER_H + categories.length * CELL_H + 8

  const formatPrice = (p) => {
    if (!p) return 'N/A'
    if (p < 0.01) return `$${p.toFixed(4)}`
    return `$${p.toFixed(2)}`
  }

  return (
    <div className="card p-4 overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        style={{ minWidth: Math.max(400, svgW) }}
        aria-label="Cost heatmap"
      >
        {/* Provider headers */}
        {activeProviders.map((prov, pi) => (
          <text
            key={prov}
            x={LABEL_W + pi * CELL_W + CELL_W / 2}
            y={HEADER_H - 8}
            textAnchor="middle"
            fontSize={10}
            fontWeight="600"
            fill="#9ca3af"
            fontFamily="sans-serif"
          >
            {prov}
          </text>
        ))}

        {/* Rows */}
        {grid.map((row, ri) => (
          <g key={row.category}>
            {/* Category label */}
            <text
              x={LABEL_W - 8}
              y={HEADER_H + ri * CELL_H + CELL_H / 2 + 4}
              textAnchor="end"
              fontSize={compact ? 8 : 9}
              fill="#6b7280"
              fontFamily="sans-serif"
            >
              {row.category.length > 22 ? row.category.slice(0, 20) + '…' : row.category}
            </text>

            {/* Cells */}
            {row.cells.map((cell, ci) => {
              const opacity = cell.price > 0 ? 0.15 + (cell.price / row.rowMax) * 0.75 : 0.05
              const isAnomaly = cell.entry && anomalySet.has(cell.entry)
              const x = LABEL_W + ci * CELL_W
              const y = HEADER_H + ri * CELL_H

              return (
                <g key={cell.provider}>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={CELL_W - 4}
                    height={CELL_H - 4}
                    rx={4}
                    fill={`rgba(99,102,241,${opacity})`}
                    stroke={isAnomaly ? '#f59e0b' : 'transparent'}
                    strokeWidth={isAnomaly ? 1.5 : 0}
                    className="cursor-pointer transition-opacity duration-150 hover:opacity-80"
                    onMouseEnter={(e) => cell.entry && setTooltip({ visible: true, x: e.clientX, y: e.clientY, entry: cell.entry })}
                    onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, entry: null })}
                  />
                  <text
                    x={x + CELL_W / 2}
                    y={y + CELL_H / 2 + 4}
                    textAnchor="middle"
                    fontSize={compact ? 8 : 9}
                    fill={cell.price > 0 ? '#e5e7eb' : '#4b5563'}
                    fontFamily="monospace"
                    pointerEvents="none"
                  >
                    {formatPrice(cell.price)}
                  </text>
                  {isAnomaly && (
                    <text x={x + CELL_W - 8} y={y + 10} fontSize={8} fill="#f59e0b" pointerEvents="none">⚠</text>
                  )}
                </g>
              )
            })}
          </g>
        ))}
      </svg>

      <TooltipPortal {...tooltip} regionMultiplier={1} />
    </div>
  )
}
