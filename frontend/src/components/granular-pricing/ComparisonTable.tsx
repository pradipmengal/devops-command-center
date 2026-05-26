import React, { useState, useMemo } from 'react'
import { X, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { findEquivalentInstances, computePriceEfficiency } from '../../data/granularCatalogUtils'
import { PROVIDER_COLORS } from '../../data/cloudCostData'

const COLUMNS = [
  { key: 'instance_type', label: 'Instance Type' },
  { key: 'provider',      label: 'Provider' },
  { key: 'vcpu',          label: 'vCPU' },
  { key: 'memory_gb',     label: 'Memory (GB)' },
  { key: 'price_usd',     label: 'Price/hr' },
  { key: 'monthly',       label: 'Price/month' },
]

/**
 * ComparisonTable — side-by-side comparison of selected instance types.
 */
export default function ComparisonTable({
  basket = [],
  catalog = [],
  onRemoveFromBasket,
  onClearBasket,
  onSelectForCalculator,
  sortKey = 'price_usd',
  sortDir = 'asc',
  onSort,
}) {
  const [expandedEquiv, setExpandedEquiv] = useState(null)

  const formatPrice = (p) => {
    if (!p && p !== 0) return '—'
    if (p === 0) return '$0.00'
    if (p < 0.001) return `$${p.toFixed(6)}`
    if (p < 0.01) return `$${p.toFixed(4)}`
    return `$${p.toFixed(4)}`
  }

  const formatMonthly = (p) => {
    const m = p * 730
    if (m < 1) return `$${m.toFixed(2)}`
    if (m < 1000) return `$${m.toFixed(2)}`
    return `$${(m / 1000).toFixed(2)}k`
  }

  // Group basket entries by (vcpu, memory_gb) to find cheapest per group
  const cheapestInGroup = useMemo(() => {
    const groups = {}
    for (const e of basket) {
      const key = `${e.vcpu}-${e.memory_gb}`
      if (!groups[key] || e.price_usd < groups[key].price_usd) {
        groups[key] = e
      }
    }
    return new Set(Object.values(groups))
  }, [basket])

  const sortArrow = (key) => {
    if (sortKey !== key) return <span className="text-gray-700 ml-1">↕</span>
    return <span className="text-indigo-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40 bg-gray-900/60">
        <h3 className="text-sm font-semibold text-gray-200">
          Comparison
          {basket.length > 0 && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {basket.length}
            </span>
          )}
        </h3>
        {basket.length > 0 && (
          <button
            onClick={onClearBasket}
            className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
          >
            <Trash2 className="w-3 h-3" />
            Clear All
          </button>
        )}
      </div>

      {basket.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-xs text-gray-500">
            Select instances from the Service Configurator to compare them side-by-side.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-900/95 border-b border-gray-700/50">
                {COLUMNS.map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => onSort?.(key)}
                    className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-gray-200 transition-colors"
                  >
                    {label}{sortArrow(key)}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Equiv.
                </th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {basket.map((entry, idx) => {
                const isCheapest = cheapestInGroup.has(entry)
                const providerColors = PROVIDER_COLORS[entry.provider] ?? { text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30' }
                const isExpanded = expandedEquiv === idx
                const equivalents = isExpanded ? findEquivalentInstances(entry, catalog) : {}

                return (
                  <React.Fragment key={`${entry.provider}-${entry.instance_type}-${idx}`}>
                    <tr
                      className={`border-b border-gray-800/40 cursor-pointer transition-colors
                        ${isCheapest ? 'bg-emerald-500/5' : 'hover:bg-gray-800/20'}`}
                      onClick={() => onSelectForCalculator?.(entry)}
                    >
                      <td className="px-3 py-2.5 font-mono text-gray-200 whitespace-nowrap">
                        {entry.instance_type}
                        {isCheapest && (
                          <span className="ml-1.5 text-[9px] bg-emerald-500/15 text-emerald-400 px-1 rounded border border-emerald-500/20">
                            ★ cheapest
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${providerColors.text} ${providerColors.bg} ${providerColors.border}`}>
                          {entry.provider}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-gray-300">{entry.vcpu}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-300">{entry.memory_gb}</td>
                      <td className={`px-3 py-2.5 font-mono font-semibold ${isCheapest ? 'text-emerald-400' : 'text-gray-200'}`}>
                        {formatPrice(entry.price_usd)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-gray-400">
                        {formatMonthly(entry.price_usd)}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedEquiv(isExpanded ? null : idx) }}
                          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          Equiv
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveFromBasket?.(entry) }}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    {/* Equivalent instances sub-row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="px-4 py-3 bg-gray-900/40 border-b border-gray-700/30">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Closest equivalent instances
                          </p>
                          {Object.keys(equivalents).length === 0 ? (
                            <p className="text-[10px] text-gray-600">No equivalents found in catalog.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(equivalents).map(([provider, equiv]) => {
                                const ec = PROVIDER_COLORS[provider] ?? { text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30' }
                                return (
                                  <div key={provider} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${ec.bg} ${ec.border}`}>
                                    <span className={`text-[9px] font-bold ${ec.text}`}>{provider}</span>
                                    <span className="font-mono text-[10px] text-gray-200">{equiv.instance_type}</span>
                                    <span className="text-[10px] text-gray-500">{equiv.vcpu}vCPU · {equiv.memory_gb}GB</span>
                                    <span className={`font-mono text-[10px] font-semibold ${ec.text}`}>{formatPrice(equiv.price_usd)}/hr</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
