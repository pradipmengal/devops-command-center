import React, { useMemo } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { computePriceEfficiency } from '../../data/granularCatalogUtils'
import { PROVIDER_COLORS } from '../../data/cloudCostData'
import { SkeletonChart } from '../SkeletonCard'

const COLUMNS = [
  { key: 'instance_type', label: 'Instance Type' },
  { key: 'vcpu',          label: 'vCPU' },
  { key: 'memory_gb',     label: 'Memory (GB)' },
  { key: 'price_usd',     label: 'Price/hr' },
  { key: 'pricePerVcpu',  label: '$/vCPU' },
  { key: 'pricePerGbRam', label: '$/GB RAM' },
  { key: 'tier_label',    label: 'Tier' },
]

/**
 * InstanceFamilyBrowser — full-width sortable table of instance types.
 */
export default function InstanceFamilyBrowser({
  entries = [],
  totalCount = 0,
  sortKey = 'price_usd',
  sortDir = 'asc',
  onSort,
  onAddToBasket,
  onSelectForCalculator,
  loading = false,
}) {
  if (loading) return <SkeletonChart height={320} />

  // Compute efficiency for all entries
  const enriched = useMemo(() =>
    entries.map((e) => ({ ...e, ...computePriceEfficiency(e) })),
    [entries]
  )

  // Detect if this is a compute category (has vCPU/memory data)
  const isComputeCategory = enriched.some((e) => e.vcpu > 0)

  const COLUMNS = [
    { key: 'instance_type', label: 'SKU / Tier' },
    ...(isComputeCategory ? [
      { key: 'vcpu',          label: 'vCPU' },
      { key: 'memory_gb',     label: 'Memory (GB)' },
    ] : []),
    { key: 'price_usd',     label: 'Price/hr' },
    ...(isComputeCategory ? [
      { key: 'pricePerVcpu',  label: '$/vCPU' },
      { key: 'pricePerGbRam', label: '$/GB RAM' },
    ] : []),
    { key: 'tier_label',    label: 'Tier' },
  ]

  const formatPrice = (p) => {
    if (!p && p !== 0) return '—'
    if (p === 0) return '$0.00'
    if (p < 0.0001) return `$${p.toFixed(6)}`
    if (p < 0.01) return `$${p.toFixed(4)}`
    return `$${p.toFixed(4)}`
  }

  // Find best efficiency rows
  const bestPricePerVcpu = isComputeCategory && enriched.length > 0
    ? Math.min(...enriched.map((e) => e.pricePerVcpu).filter((v) => v > 0))
    : null
  const bestPricePerGbRam = isComputeCategory && enriched.length > 0
    ? Math.min(...enriched.map((e) => e.pricePerGbRam).filter((v) => v > 0))
    : null

  const sortArrow = (key) => {
    if (sortKey !== key) return <span className="text-gray-700 ml-1">↕</span>
    return <span className="text-indigo-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40 bg-gray-900/60">
        <h3 className="text-sm font-semibold text-gray-200">Instance Browser</h3>
        <span className="text-[10px] text-gray-500">
          Showing {entries.length} of {totalCount} instances
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="py-12 text-center">
          <AlertTriangle className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-gray-500">
            No instances match the current filters. Try adjusting the vCPU range, memory range, or family prefix.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '480px' }}>
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-900/95 backdrop-blur border-b border-gray-700/50">
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((entry, idx) => {
                const providerColors = PROVIDER_COLORS[entry.provider] ?? { text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30' }
                const isBestVcpu = bestPricePerVcpu !== null && Math.abs(entry.pricePerVcpu - bestPricePerVcpu) < 1e-9
                const isBestRam = bestPricePerGbRam !== null && Math.abs(entry.pricePerGbRam - bestPricePerGbRam) < 1e-9

                return (
                  <tr
                    key={`${entry.provider}-${entry.instance_type}-${idx}`}
                    className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => onSelectForCalculator?.(entry)}
                  >
                    <td className="px-3 py-2.5 font-mono text-gray-200 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex px-1 py-0.5 rounded text-[9px] font-bold border ${providerColors.text} ${providerColors.bg} ${providerColors.border}`}>
                          {entry.provider}
                        </span>
                        {entry.instance_type}
                      </div>
                    </td>
                    {isComputeCategory && (
                      <>
                        <td className="px-3 py-2.5 text-gray-300 font-mono">{entry.vcpu}</td>
                        <td className="px-3 py-2.5 text-gray-300 font-mono">{entry.memory_gb}</td>
                      </>
                    )}
                    <td className="px-3 py-2.5 text-gray-200 font-mono font-semibold">{formatPrice(entry.price_usd)}</td>
                    {isComputeCategory && (
                      <>
                        <td className="px-3 py-2.5 font-mono">
                          <span className={`${isBestVcpu ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>
                            {formatPrice(entry.pricePerVcpu)}
                            {isBestVcpu && <span className="ml-1 text-[9px] bg-emerald-500/15 text-emerald-400 px-1 rounded">best</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          <span className={`${isBestRam ? 'text-blue-400 font-bold' : 'text-gray-400'}`}>
                            {formatPrice(entry.pricePerGbRam)}
                            {isBestRam && <span className="ml-1 text-[9px] bg-blue-500/15 text-blue-400 px-1 rounded">best</span>}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2.5 text-gray-500 text-[10px]">{entry.tier_label}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddToBasket?.(entry) }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                        title="Add to comparison"
                      >
                        <Plus className="w-3 h-3" />
                        Compare
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
