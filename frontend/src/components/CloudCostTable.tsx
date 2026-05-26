import React, { useMemo } from 'react'
import { sortEntries, findLowestInGroup } from '../data/cloudCostUtils'
import { PROVIDER_COLORS } from '../data/cloudCostData'
import { AlertTriangle } from 'lucide-react'
import DrillDownPanel from './DrillDownPanel'

/**
 * Format a price_usd value for display.
 */
function formatPrice(price) {
  if (price === 0) return '0.00'
  if (price < 0.000001) return price.toFixed(8)
  if (price < 0.0001) return price.toFixed(6)
  if (price < 0.01) return price.toFixed(4)
  return price.toFixed(2)
}

const COLUMNS = [
  { key: 'category',     label: 'Category' },
  { key: 'service_name', label: 'Service Name' },
  { key: 'provider',     label: 'Provider' },
  { key: 'price_usd',    label: 'Price (USD)' },
  { key: 'unit',         label: 'Unit' },
  { key: 'tier_label',   label: 'Tier' },
]

/**
 * CloudCostTable — sortable comparison table with optional anomaly badges and drill-down.
 *
 * New optional props (backward-compatible, all default to no-op):
 *   anomalySet?: Set<ServiceEntry>
 *   openDrillDown?: string | null
 *   onDrillDownToggle?: (category: string) => void
 */
interface CloudCostTableProps {
  filteredEntries: any[];
  sortConfig: { key: string; dir: string };
  onSort: (key: string) => void;
  anomalySet?: Set<any>;
  openDrillDown?: string | null;
  onDrillDownToggle?: (category: string) => void;
}

export default function CloudCostTable({
  filteredEntries,
  sortConfig,
  onSort,
  anomalySet = new Set(),
  openDrillDown = null,
  onDrillDownToggle = () => {},
}: CloudCostTableProps) {
  // Sort entries using the utility function
  const sortedEntries = useMemo(
    () => sortEntries(filteredEntries, sortConfig.key, sortConfig.dir),
    [filteredEntries, sortConfig]
  )

  // Build a Set of lowest-price entries per category for O(1) lookup
  const lowestSet = useMemo(() => {
    const byCategory = {}
    for (const entry of filteredEntries) {
      if (!byCategory[entry.category]) byCategory[entry.category] = []
      byCategory[entry.category].push(entry)
    }
    const set = new Set()
    for (const entries of Object.values(byCategory)) {
      if (entries.length > 0) {
        const lowest = findLowestInGroup(entries)
        set.add(lowest)
      }
    }
    return set
  }, [filteredEntries])

  // Sort arrow indicator
  const sortArrow = (key) => {
    if (sortConfig.key !== key) return <span className="text-gray-600 ml-1">↕</span>
    return (
      <span className="text-indigo-400 ml-1">
        {sortConfig.dir === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (filteredEntries.length === 0) {
    return (
      <div className="card p-6 flex items-center justify-center min-h-[160px]">
        <p className="text-gray-500 text-sm text-center">
          No services match the current filters.
        </p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '520px' }}>
        <table className="w-full text-sm border-collapse">
          {/* ── Header ─────────────────────────────────────────────────── */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-700/50">
              {COLUMNS.map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => onSort(key)}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-gray-200 transition-colors"
                >
                  {label}
                  {sortArrow(key)}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ───────────────────────────────────────────────────── */}
          <tbody>
            {sortedEntries.map((entry, idx) => {
              const isLowest = lowestSet.has(entry)
              const providerColors = PROVIDER_COLORS[entry.provider] ?? {
                text: 'text-gray-400',
                bg: 'bg-gray-500/15',
                border: 'border-gray-500/30',
              }

              // Only render the DrillDownPanel after the LAST row of a category
              // to avoid duplicate panels and React key conflicts
              const isLastInCategory =
                idx === sortedEntries.length - 1 ||
                sortedEntries[idx + 1]?.category !== entry.category

              return (
                <React.Fragment key={`${entry.provider}-${entry.category}-${idx}`}>
                  <tr
                    className={`border-b border-gray-800/50 transition-colors hover:bg-gray-800/30 ${
                      isLowest ? 'bg-emerald-500/10 border-l-2 border-emerald-400' : ''
                    }`}
                  >
                    {/* Category — clickable for drill-down */}
                    <td
                      className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap cursor-pointer hover:text-indigo-300 transition-colors"
                      onClick={() => onDrillDownToggle(entry.category)}
                      aria-label="Click to expand category details"
                    >
                      {entry.category}
                      {openDrillDown === entry.category && (
                        <span className="ml-1 text-indigo-400">▾</span>
                      )}
                    </td>

                    {/* Service Name */}
                    <td className="px-4 py-3 text-gray-200 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{entry.service_name}</span>
                        {isLowest && (
                          <span className="text-[10px] text-emerald-400 font-semibold" aria-label="Lowest price in this category">
                            ★ Best
                          </span>
                        )}
                        {anomalySet.has(entry) && (
                          <AlertTriangle
                            className="w-3 h-3 text-amber-400 flex-shrink-0"
                            aria-label="Price anomaly — this service is >2σ above the category mean"
                          />
                        )}
                      </div>
                    </td>

                    {/* Provider badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${providerColors.text} ${providerColors.bg} ${providerColors.border}`}>
                        {entry.provider}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 text-right font-mono text-xs whitespace-nowrap">
                      <span className={isLowest ? 'text-emerald-400 font-semibold' : 'text-gray-200'}>
                        ${formatPrice(entry.price_usd)}
                      </span>
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{entry.unit}</td>

                    {/* Tier */}
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{entry.tier_label}</td>
                  </tr>

                  {/* Drill-down panel — rendered ONCE after the last row of the category */}
                  {openDrillDown === entry.category && isLastInCategory && (
                    <tr key={`drilldown-${entry.category}`}>
                      <td colSpan={6} className="p-0">
                        <DrillDownPanel
                          category={entry.category}
                          entries={filteredEntries.filter((e) => e.category === entry.category)}
                          anomalySet={anomalySet}
                          onClose={() => onDrillDownToggle(entry.category)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Row count footer */}
      <div className="px-4 py-2 border-t border-gray-800/50 text-[11px] text-gray-600">
        {sortedEntries.length} {sortedEntries.length === 1 ? 'entry' : 'entries'}
      </div>
    </div>
  )
}
