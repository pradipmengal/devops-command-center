import React, { useMemo, useState } from 'react'

const MARGIN = { top: 20, right: 20, bottom: 40, left: 60 }
const CHART_W = 700
const CHART_H = 260

/**
 * TrendLineChart — native SVG line chart with historical + forecast + budget threshold.
 */
export default function TrendLineChart({
  trendData = [],
  forecastData = [],
  budgetThreshold = 0,
  onBudgetThresholdChange,
  granularity = 'monthly',
  compact = false,
}) {
  const allPoints = [...trendData, ...forecastData]
  const chartH = compact ? 180 : CHART_H

  const { plotW, plotH, maxVal, minVal, xScale, yScale } = useMemo(() => {
    const plotW = CHART_W - MARGIN.left - MARGIN.right
    const plotH = chartH - MARGIN.top - MARGIN.bottom
    const values = allPoints.map((p) => p.value)
    const maxVal = Math.max(...values, budgetThreshold, 0.001) * 1.1
    const minVal = 0
    const xScale = (i) => (i / Math.max(allPoints.length - 1, 1)) * plotW
    const yScale = (v) => plotH - ((v - minVal) / (maxVal - minVal)) * plotH
    return { plotW, plotH, maxVal, minVal, xScale, yScale }
  }, [allPoints, budgetThreshold, chartH])

  const toPath = (points, startIdx = 0) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(startIdx + i)} ${yScale(p.value)}`).join(' ')

  const histPath = toPath(trendData)
  const forecastPath = trendData.length > 0
    ? `M ${xScale(trendData.length - 1)} ${yScale(trendData[trendData.length - 1]?.value ?? 0)} ` +
      forecastData.map((p, i) => `L ${xScale(trendData.length + i)} ${yScale(p.value)}`).join(' ')
    : toPath(forecastData, trendData.length)

  const budgetY = yScale(budgetThreshold)

  // Find first forecast point that crosses budget
  const crossingIdx = forecastData.findIndex((p) => p.value >= budgetThreshold)

  const NUM_TICKS = 5
  const ticks = Array.from({ length: NUM_TICKS + 1 }, (_, i) => (maxVal / NUM_TICKS) * i)

  const formatVal = (v) => {
    if (v === 0) return '0'
    if (v < 1) return `$${v.toFixed(3)}`
    if (v < 1000) return `$${v.toFixed(1)}`
    return `$${(v / 1000).toFixed(1)}k`
  }

  const [hoveredIdx, setHoveredIdx] = useState(null)

  return (
    <div className="card p-4 space-y-3">
      <svg
        viewBox={`0 0 ${CHART_W} ${chartH}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ minWidth: 400 }}
      >
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Grid lines */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={0} y1={yScale(tick)} x2={plotW} y2={yScale(tick)} stroke="#1f2937" strokeWidth={1} strokeDasharray="4 4" />
              <text x={-8} y={yScale(tick) + 4} textAnchor="end" fontSize={9} fill="#6b7280" fontFamily="monospace">
                {formatVal(tick)}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={0} y1={0} x2={0} y2={plotH} stroke="#374151" strokeWidth={1} />
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="#374151" strokeWidth={1} />

          {/* Budget threshold line */}
          {budgetThreshold > 0 && (
            <g>
              <line x1={0} y1={budgetY} x2={plotW} y2={budgetY} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" />
              <text x={plotW + 4} y={budgetY + 4} fontSize={9} fill="#f59e0b" fontFamily="sans-serif">Budget</text>
            </g>
          )}

          {/* Historical area fill */}
          {trendData.length > 1 && (
            <path
              d={`${histPath} L ${xScale(trendData.length - 1)} ${plotH} L 0 ${plotH} Z`}
              fill="rgba(99,102,241,0.08)"
            />
          )}

          {/* Historical line */}
          {trendData.length > 1 && (
            <path d={histPath} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Forecast line (dashed) */}
          {forecastData.length > 0 && (
            <path d={forecastPath} fill="none" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" opacity={0.7} strokeLinecap="round" />
          )}

          {/* Budget crossing marker */}
          {crossingIdx >= 0 && (
            <circle
              cx={xScale(trendData.length + crossingIdx)}
              cy={yScale(forecastData[crossingIdx].value)}
              r={5}
              fill="#f59e0b"
              stroke="#0f172a"
              strokeWidth={2}
            >
              <title>Budget exceeded at {forecastData[crossingIdx].label}</title>
            </circle>
          )}

          {/* Data point dots */}
          {allPoints.map((p, i) => (
            <circle
              key={i}
              cx={xScale(i)}
              cy={yScale(p.value)}
              r={hoveredIdx === i ? 5 : 3}
              fill={p.isForecast ? '#8b5cf6' : '#6366f1'}
              opacity={p.isForecast ? 0.7 : 1}
              className="cursor-pointer transition-all duration-100"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <title>{p.label}: {formatVal(p.value)}{p.isForecast ? ' (forecast)' : ''}</title>
            </circle>
          ))}

          {/* X-axis labels */}
          {allPoints.map((p, i) => {
            if (allPoints.length > 16 && i % 3 !== 0) return null
            return (
              <text
                key={i}
                x={xScale(i)}
                y={plotH + 16}
                textAnchor="middle"
                fontSize={8}
                fill={p.isForecast ? '#7c3aed' : '#6b7280'}
                fontFamily="sans-serif"
              >
                {p.label}
              </text>
            )
          })}
        </g>

        {/* Legend */}
        <g transform={`translate(${MARGIN.left}, ${chartH - 12})`}>
          <rect x={0} y={-6} width={10} height={3} rx={1} fill="#6366f1" />
          <text x={14} y={0} fontSize={9} fill="#9ca3af" fontFamily="sans-serif">Historical</text>
          <rect x={80} y={-6} width={10} height={3} rx={1} fill="#8b5cf6" opacity={0.7} />
          <text x={94} y={0} fontSize={9} fill="#9ca3af" fontFamily="sans-serif">Forecast</text>
          {budgetThreshold > 0 && (
            <>
              <line x1={160} y1={-3} x2={170} y2={-3} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" />
              <text x={174} y={0} fontSize={9} fill="#9ca3af" fontFamily="sans-serif">Budget</text>
            </>
          )}
        </g>
      </svg>

      {/* Budget threshold control */}
      <div className="flex items-center gap-3 px-1">
        <label className="text-[10px] text-gray-500 whitespace-nowrap">Budget threshold:</label>
        <input
          type="range"
          min={0}
          max={Math.max(maxVal * 1.5, 1)}
          step={maxVal / 100}
          value={budgetThreshold}
          onChange={(e) => onBudgetThresholdChange?.(parseFloat(e.target.value))}
          className="flex-1 accent-amber-500 h-1.5"
        />
        <span className="text-[10px] text-amber-400 font-mono w-20 text-right">{formatVal(budgetThreshold)}</span>
      </div>
    </div>
  )
}
