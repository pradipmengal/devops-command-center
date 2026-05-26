import React from 'react'
import { TrendingDown, Users } from 'lucide-react'
import { PROVIDER_COLORS } from '../data/cloudCostData'

/**
 * SavingsWidget — top-5 provider-switch savings opportunities.
 */
export default function SavingsWidget({ savings = [], totalSavings = 0, compact = false }) {
  const formatPrice = (p) => {
    if (p === 0) return '$0.00'
    if (p < 0.001) return `$${p.toFixed(6)}`
    if (p < 0.01) return `$${p.toFixed(4)}`
    return `$${p.toFixed(2)}`
  }

  const providerBadge = (provider) => {
    const c = PROVIDER_COLORS[provider] ?? { text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30' }
    return (
      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${c.text} ${c.bg} ${c.border}`}>
        {provider}
      </span>
    )
  }

  return (
    <div className="card p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-gray-200">Savings Opportunities</h3>
        </div>
        {savings.length > 0 && (
          <div className="text-right">
            <div className="text-xs font-bold text-emerald-400 font-mono">{formatPrice(totalSavings)}</div>
            <div className="text-[9px] text-gray-600">total potential</div>
          </div>
        )}
      </div>

      {/* Content */}
      {savings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
          <Users className="w-8 h-8 text-gray-700 mb-2" />
          <p className="text-xs text-gray-500">
            {savings === null
              ? 'Select at least two providers to calculate savings.'
              : 'No savings opportunities found.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto">
          {savings.map((opp, i) => (
            <div
              key={opp.category}
              className="rounded-xl border border-gray-700/40 bg-gray-800/30 p-3 hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all duration-150"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-xs font-semibold text-gray-200 leading-tight flex-1 min-w-0 truncate">
                  {opp.category}
                </p>
                <span className="text-xs font-bold text-emerald-400 font-mono flex-shrink-0">
                  -{formatPrice(opp.savingsAmount)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                {providerBadge(opp.expensiveProvider)}
                <span className="font-mono text-red-400">{formatPrice(opp.expensivePrice)}</span>
                <span>→</span>
                {providerBadge(opp.cheapProvider)}
                <span className="font-mono text-emerald-400">{formatPrice(opp.cheapPrice)}</span>
                <span className="ml-auto text-emerald-500 font-semibold">
                  {opp.savingsPercent.toFixed(0)}% off
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
