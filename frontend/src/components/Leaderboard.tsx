import React from 'react'
import { AlertTriangle, Trophy } from 'lucide-react'
import { PROVIDER_COLORS } from '../data/cloudCostData'

const RANK_STYLES = [
  { ring: 'ring-1 ring-yellow-400/60', text: 'text-yellow-400', bg: 'bg-yellow-400/10', label: '🥇' },
  { ring: 'ring-1 ring-gray-400/60',   text: 'text-gray-300',   bg: 'bg-gray-400/10',   label: '🥈' },
  { ring: 'ring-1 ring-amber-600/60',  text: 'text-amber-600',  bg: 'bg-amber-600/10',  label: '🥉' },
]

/**
 * Leaderboard — top-10 most expensive services with rank badges and bar indicators.
 */
export default function Leaderboard({ entries = [], anomalySet = new Set(), compact = false, onSelectCategory }) {
  const maxPrice = entries.length > 0 ? entries[0].price_usd : 1

  const formatPrice = (p) => {
    if (p === 0) return '$0.00'
    if (p < 0.001) return `$${p.toFixed(6)}`
    if (p < 0.01) return `$${p.toFixed(4)}`
    return `$${p.toFixed(2)}`
  }

  return (
    <div className="card p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-gray-200">Top Expensive Services</h3>
        {entries.length > 0 && (
          <span className="ml-auto text-[10px] text-gray-600">{entries.length} shown</span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-gray-500">No data available.</p>
        </div>
      ) : (
        <div className="flex-1 space-y-1.5 overflow-y-auto">
          {entries.map((entry, i) => {
            const rankStyle = RANK_STYLES[i] ?? null
            const providerColors = PROVIDER_COLORS[entry.provider] ?? { text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30' }
            const barWidth = (entry.price_usd / maxPrice) * 100
            const isAnomaly = anomalySet.has(entry)

            return (
              <div
                key={`${entry.provider}-${entry.category}-${i}`}
                onClick={() => onSelectCategory?.(entry.category)}
                className={`relative rounded-xl border border-gray-700/30 bg-gray-800/30 overflow-hidden
                  hover:border-indigo-500/40 hover:bg-gray-800/50 transition-all duration-150
                  ${onSelectCategory ? 'cursor-pointer' : ''}
                  ${compact ? 'p-2' : 'p-2.5'}`}
              >
                {/* Bar indicator */}
                <div
                  className="absolute inset-y-0 left-0 bg-indigo-500/15 transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />

                <div className="relative flex items-center gap-2">
                  {/* Rank badge */}
                  <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold
                    ${rankStyle ? `${rankStyle.bg} ${rankStyle.ring}` : 'bg-gray-700/40'}`}
                  >
                    {rankStyle ? rankStyle.label : <span className="text-gray-500">{i + 1}</span>}
                  </div>

                  {/* Service info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`font-semibold truncate ${compact ? 'text-[10px]' : 'text-xs'} text-gray-200`}>
                        {entry.service_name}
                      </p>
                      {isAnomaly && (
                        <AlertTriangle
                          className="w-3 h-3 text-amber-400 flex-shrink-0"
                          aria-label="Statistical anomaly — price is >2σ above category mean"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-flex px-1 py-0.5 rounded text-[9px] font-bold border ${providerColors.text} ${providerColors.bg} ${providerColors.border}`}>
                        {entry.provider}
                      </span>
                      <span className="text-[9px] text-gray-600 truncate">{entry.category}</span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex-shrink-0 text-right">
                    <div className={`font-bold font-mono ${compact ? 'text-[10px]' : 'text-xs'} text-gray-200`}>
                      {formatPrice(entry.price_usd)}
                    </div>
                    <div className="text-[9px] text-gray-600">{entry.unit}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
