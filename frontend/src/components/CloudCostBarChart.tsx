import React, { useMemo, useState } from 'react'
import { buildBarGroups, ALL_CATEGORIES } from '../data/cloudCostUtils'
import { PROVIDER_COLORS } from '../data/cloudCostData'
import TooltipPortal from './TooltipPortal'

/**
 * CloudCostBarChart
 *
 * Native SVG grouped bar chart — no external charting library.
 * Groups bars by service category, one bar per active provider per category.
 * Bar height is proportional to price_usd relative to the max value in the
 * visible dataset. Zero-height bars (hasData=false) get a dashed stroke
 * outline and an "N/A" label.
 *
 * @param {{
 *   filteredEntries: object[],
 *   activeProviders: string[],
 *   tooltipEnabled?: boolean,  // default: true
 * }} props
 */
export default function CloudCostBarChart({ filteredEntries, activeProviders, tooltipEnabled = true }) {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, entry: null })
  // ── Derived data ──────────────────────────────────────────────────────────

  // Only include categories that appear in filteredEntries
  const visibleCategories = useMemo(() => {
    const inFiltered = new Set(filteredEntries.map((e) => e.category))
    return ALL_CATEGORIES.filter((c) => inFiltered.has(c))
  }, [filteredEntries])

  const barGroups = useMemo(
    () => buildBarGroups(filteredEntries, visibleCategories, activeProviders),
    [filteredEntries, visibleCategories, activeProviders]
  )

  const maxPrice = useMemo(() => {
    if (filteredEntries.length === 0) return 1
    return Math.max(...filteredEntries.map((e) => e.price_usd))
  }, [filteredEntries])

  // ── Empty state ───────────────────────────────────────────────────────────
  if (filteredEntries.length === 0) {
    return (
      <div className="card p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-500 text-sm text-center">
          No data to display. Select at least one provider and category.
        </p>
      </div>
    )
  }

  // ── SVG layout constants ──────────────────────────────────────────────────
  const LEGEND_HEIGHT = 36
  const MARGIN_LEFT = 64
  const MARGIN_RIGHT = 16
  const MARGIN_TOP = LEGEND_HEIGHT + 16
  const MARGIN_BOTTOM = 90
  const CHART_WIDTH = 800
  const CHART_HEIGHT = 400
  const PLOT_WIDTH = CHART_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
  const PLOT_HEIGHT = CHART_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM

  const numCategories = visibleCategories.length
  const numProviders = activeProviders.length

  const groupWidth = PLOT_WIDTH / numCategories
  // Leave some padding between groups; bars fill 80% of the group
  const totalBarWidth = groupWidth * 0.8
  const barWidth = numProviders > 0 ? totalBarWidth / numProviders : totalBarWidth
  const groupPadding = (groupWidth - totalBarWidth) / 2

  // ── Y-axis ticks ──────────────────────────────────────────────────────────
  const NUM_TICKS = 5
  const ticks = useMemo(() => {
    const step = maxPrice / NUM_TICKS
    return Array.from({ length: NUM_TICKS + 1 }, (_, i) => i * step)
  }, [maxPrice])

  // ── Price → Y coordinate (SVG y grows downward) ───────────────────────────
  const priceToY = (price) => PLOT_HEIGHT - (price / maxPrice) * PLOT_HEIGHT

  // ── Price label formatter ─────────────────────────────────────────────────
  const formatPrice = (price) => {
    if (price === 0) return '0'
    if (price < 0.01) return price.toFixed(6)
    if (price < 1) return price.toFixed(4)
    if (price < 100) return price.toFixed(2)
    return price.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }

  // ── Total viewBox height accounts for legend ──────────────────────────────
  const viewBoxHeight = CHART_HEIGHT

  return (
    <div className="card p-4 overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${viewBoxHeight}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        aria-label="Cloud cost comparison bar chart"
        role="img"
        style={{ minWidth: Math.max(600, numCategories * 28) }}
      >
        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <g transform={`translate(${MARGIN_LEFT}, 10)`}>
          {activeProviders.map((provider, i) => {
            const color = PROVIDER_COLORS[provider]?.bar ?? '#6b7280'
            const legendItemWidth = 90
            return (
              <g key={provider} transform={`translate(${i * legendItemWidth}, 0)`}>
                <rect x={0} y={4} width={12} height={12} rx={2} fill={color} />
                <text
                  x={16}
                  y={14}
                  fontSize={11}
                  fill="#9ca3af"
                  fontFamily="sans-serif"
                >
                  {provider}
                </text>
              </g>
            )
          })}
        </g>

        {/* ── Plot area ──────────────────────────────────────────────────── */}
        <g transform={`translate(${MARGIN_LEFT}, ${MARGIN_TOP})`}>

          {/* Y-axis line */}
          <line x1={0} y1={0} x2={0} y2={PLOT_HEIGHT} stroke="#374151" strokeWidth={1} />

          {/* Y-axis ticks and grid lines */}
          {ticks.map((tickVal) => {
            const y = priceToY(tickVal)
            return (
              <g key={tickVal}>
                {/* Grid line */}
                <line
                  x1={0}
                  y1={y}
                  x2={PLOT_WIDTH}
                  y2={y}
                  stroke="#1f2937"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                {/* Tick mark */}
                <line x1={-4} y1={y} x2={0} y2={y} stroke="#4b5563" strokeWidth={1} />
                {/* Tick label */}
                <text
                  x={-8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={9}
                  fill="#6b7280"
                  fontFamily="sans-serif"
                >
                  ${formatPrice(tickVal)}
                </text>
              </g>
            )
          })}

          {/* Y-axis label */}
          <text
            x={-(PLOT_HEIGHT / 2)}
            y={-50}
            textAnchor="middle"
            fontSize={10}
            fill="#6b7280"
            fontFamily="sans-serif"
            transform="rotate(-90)"
          >
            Price (USD)
          </text>

          {/* X-axis baseline */}
          <line
            x1={0}
            y1={PLOT_HEIGHT}
            x2={PLOT_WIDTH}
            y2={PLOT_HEIGHT}
            stroke="#374151"
            strokeWidth={1}
          />

          {/* ── Bar groups ───────────────────────────────────────────────── */}
          {barGroups.map((group, groupIdx) => {
            const groupX = groupIdx * groupWidth + groupPadding

            return (
              <g key={group.category}>
                {/* X-axis category label (rotated 45°) */}
                <text
                  x={groupX + totalBarWidth / 2}
                  y={PLOT_HEIGHT + 8}
                  textAnchor="end"
                  fontSize={9}
                  fill="#9ca3af"
                  fontFamily="sans-serif"
                  transform={`rotate(-45, ${groupX + totalBarWidth / 2}, ${PLOT_HEIGHT + 8})`}
                >
                  {group.category}
                </text>

                {/* Bars */}
                {group.bars.map((bar, barIdx) => {
                  const barX = groupX + barIdx * barWidth
                  const barColor = PROVIDER_COLORS[bar.provider]?.bar ?? '#6b7280'

                  if (!bar.hasData) {
                    // Zero-height placeholder with dashed outline
                    const placeholderH = 12
                    const placeholderY = PLOT_HEIGHT - placeholderH
                    return (
                      <g key={bar.provider}>
                        <rect
                          x={barX}
                          y={placeholderY}
                          width={barWidth}
                          height={placeholderH}
                          fill="none"
                          stroke={barColor}
                          strokeWidth={1}
                          strokeDasharray="3 2"
                          opacity={0.5}
                          rx={1}
                        />
                        <text
                          x={barX + barWidth / 2}
                          y={placeholderY - 2}
                          textAnchor="middle"
                          fontSize={7}
                          fill="#6b7280"
                          fontFamily="sans-serif"
                        >
                          N/A
                        </text>
                      </g>
                    )
                  }

                  const barH = Math.max(1, (bar.price_usd / maxPrice) * PLOT_HEIGHT)
                  const barY = PLOT_HEIGHT - barH

                  // Find the matching entry for tooltip
                  const entry = filteredEntries.find(
                    (e) => e.category === group.category && e.provider === bar.provider
                  )

                  return (
                    <g key={bar.provider}>
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={barH}
                        fill={barColor}
                        opacity={0.85}
                        rx={1}
                        className="cursor-pointer hover:opacity-100 transition-opacity duration-100"
                        onMouseEnter={(e) => {
                          if (tooltipEnabled && entry) {
                            setTooltip({ visible: true, x: e.clientX, y: e.clientY, entry })
                          }
                        }}
                        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, entry: null })}
                      >
                        <title>
                          {bar.provider}: ${formatPrice(bar.price_usd)}
                        </title>
                      </rect>
                    </g>
                  )
                })}
              </g>
            )
          })}
        </g>
      </svg>
      {tooltipEnabled && <TooltipPortal {...tooltip} regionMultiplier={1} />}
    </div>
  )
}