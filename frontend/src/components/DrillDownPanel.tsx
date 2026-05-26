import React from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { PROVIDER_COLORS } from '../data/cloudCostData'

/**
 * DrillDownPanel — expandable inline panel showing all entries for a category.
 * Animates open/close with max-height CSS transition.
 */
export default function DrillDownPanel({ category, entries = [], anomalySet = new Set(), onClose }) {
  const isOpen = Boolean(category)

  if (!entries.length && !isOpen) return null

  const sorted = [...entries].sort((a, b) => a.price_usd - b.price_usd)
  const cheapest = sorted[0]
  const mostExpensive = sorted[sorted.length - 1]

  const formatPrice = (p) => {
    if (p === 0) return '$0.00'
    if (p < 0.001) return `$${p.toFixed(6)}`
    if (p < 0.01) return `$${p.toFixed(4)}`
    return `$${p.toFixed(2)}`
  }

  return (
    <div
      className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      style={{ maxHeight: isOpen ? '600px' : '0px' }}
    >
      <div className="border-t border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold text-indigo-300">{category}</h4>
            <p className="text-[10px] text-gray-500">{entries.length} service{entries.length !== 1 ? 's' : ''} across providers</p>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700/60 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Entries grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {sorted.map((entry, i) => {
            const isCheapest = entry === cheapest
            const isMostExpensive = entry === mostExpensive && entries.length > 1
            const isAnomaly = anomalySet.has(entry)
            const providerColors = PROVIDER_COLORS[entry.provider] ?? { text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30' }

            return (
              <div
                key={`${entry.provider}-${i}`}
                className={`rounded-xl border p-3 transition-all duration-150
                  ${isCheapest ? 'border-emerald-500/40 bg-emerald-500/5' :
                    isMostExpensive ? 'border-red-500/40 bg-red-500/5' :
                    'border-gray-700/40 bg-gray-800/30'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${providerColors.text} ${providerColors.bg} ${providerColors.border}`}>
                    {entry.provider}
                  </span>
                  <div className="flex items-center gap-1">
                    {isCheapest && <span className="text-[9px] text-emerald-400 font-semibold">★ Best</span>}
                    {isMostExpensive && <span className="text-[9px] text-red-400 font-semibold">↑ Highest</span>}
                    {isAnomaly && <AlertTriangle className="w-3 h-3 text-amber-400" aria-label="Price anomaly" />}
                  </div>
                </div>
                <p className="text-xs text-gray-200 font-medium leading-tight mb-1">{entry.service_name}</p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-sm font-bold font-mono ${isCheapest ? 'text-emerald-400' : isMostExpensive ? 'text-red-400' : 'text-gray-200'}`}>
                    {formatPrice(entry.price_usd)}
                  </span>
                  <span className="text-[9px] text-gray-600">{entry.unit}</span>
                </div>
                <p className="text-[9px] text-gray-600 mt-0.5">{entry.tier_label}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
