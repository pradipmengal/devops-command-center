import React, { useMemo } from 'react'
import { X, TrendingDown, AlertTriangle } from 'lucide-react'
import { PROVIDER_COLORS } from '../data/cloudCostData'

/**
 * CategoryCompareCard — side-by-side provider comparison for a single category.
 *
 * Shows all three providers for the selected category in a compact card with:
 * - Price bars (relative width)
 * - Best/worst badges
 * - Savings opportunity callout
 * - Anomaly indicators
 *
 * Props:
 *   category: string
 *   allEntries: ServiceEntry[]   — full filtered dataset (not just this category)
 *   anomalySet: Set<ServiceEntry>
 *   onClose: () => void
 */
export default function CategoryCompareCard({ category, allEntries, anomalySet = new Set(), onClose }) {
  const entries = useMemo(
    () => allEntries.filter((e) => e.category === category),
    [allEntries, category]
  )

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.price_usd - b.price_usd),
    [entries]
  )

  const maxPrice = useMemo(
    () => Math.max(...entries.map((e) => e.price_usd), 0.000001),
    [entries]
  )

  const cheapest = sorted[0]
  const mostExpensive = sorted[sorted.length - 1]

  const savingsAmount = mostExpensive && cheapest && mostExpensive !== cheapest
    ? mostExpensive.price_usd - cheapest.price_usd
    : 0
  const savingsPct = mostExpensive?.price_usd > 0
    ? (savingsAmount / mostExpensive.price_usd) * 100
    : 0

  const formatPrice = (p) => {
    if (p === 0) return '0.00'
    if (p < 0.000001) return p.toFixed(8)
    if (p < 0.0001) return p.toFixed(6)
    if (p < 0.01) return p.toFixed(4)
    return p.toFixed(4)
  }

  if (entries.length === 0) return null

  return (
    <div className="card p-4 animate-fade-in border border-indigo-500/20 bg-gray-900/80">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white leading-tight">{category}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Provider comparison</p>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all flex-shrink-0"
          aria-label="Close comparison"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Provider rows */}
      <div className="space-y-2.5">
        {sorted.map((entry) => {
          const colors = PROVIDER_COLORS[entry.provider] ?? {
            bar: '#6b7280', text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30',
          }
          const barWidth = maxPrice > 0 ? (entry.price_usd / maxPrice) * 100 : 0
          const isCheapest = entry === cheapest
          const isMostExpensive = entry === mostExpensive && entries.length > 1
          const isAnomaly = anomalySet.has(entry)

          return (
            <div key={entry.provider} className="space-y-1">
              {/* Row header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border
                    ${colors.text} ${colors.bg} ${colors.border}`}>
                    {entry.provider}
                  </span>
                  <span className="text-[11px] text-gray-400 truncate max-w-[140px]" title={entry.service_name}>
                    {entry.service_name}
                  </span>
                  {isAnomaly && (
                    <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" aria-label="Price anomaly" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isCheapest && entries.length > 1 && (
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                      BEST
                    </span>
                  )}
                  {isMostExpensive && (
                    <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                      MOST
                    </span>
                  )}
                  <span className={`text-xs font-mono font-semibold ${isCheapest ? 'text-emerald-400' : 'text-gray-300'}`}>
                    ${formatPrice(entry.price_usd)}
                  </span>
                </div>
              </div>

              {/* Price bar */}
              <div className="h-1.5 bg-gray-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: colors.bar,
                    opacity: isCheapest ? 1 : 0.6,
                  }}
                />
              </div>

              {/* Unit */}
              <p className="text-[10px] text-gray-600">{entry.unit} · {entry.tier_label}</p>
            </div>
          )
        })}
      </div>

      {/* Savings callout */}
      {savingsAmount > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800/60">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-emerald-300 font-medium">
                Switch to {cheapest?.provider} → save {savingsPct.toFixed(0)}%
              </p>
              <p className="text-[10px] text-emerald-500/80">
                ${formatPrice(savingsAmount)} per {cheapest?.unit?.replace('per ', '') ?? 'unit'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
