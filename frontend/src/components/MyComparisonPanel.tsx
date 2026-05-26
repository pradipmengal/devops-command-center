import React from 'react'
import { GitCompare, X } from 'lucide-react'
import { PROVIDER_COLORS } from '../data/cloudCostData'

/**
 * MyComparisonPanel — displays the user's pinned services for comparison.
 *
 * Props:
 *   comparisonSet  {Array}    – list of pinned service entries
 *   onRemove       {Function} – called with the entry to remove
 *   onClearAll     {Function} – called when "Clear All" is clicked
 *   compact        {Boolean}  – reduces padding and font sizes when true
 *
 * Requirements: 26.4, 26.5, 30.1–30.5
 */
export default function MyComparisonPanel({
  comparisonSet = [],
  onRemove,
  onClearAll,
  compact = false,
}) {
  const isEmpty = comparisonSet.length === 0

  // Provider badge pill
  const providerBadge = (provider) => {
    const c = PROVIDER_COLORS[provider] ?? {
      text: 'text-gray-400',
      bg: 'bg-gray-500/15',
      border: 'border-gray-500/30',
    }
    return (
      <span
        className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${c.text} ${c.bg} ${c.border}`}
      >
        {provider}
      </span>
    )
  }

  return (
    <div
      className={`bg-gray-900/60 backdrop-blur-md border border-white/10 rounded-xl ${
        compact ? 'p-2' : 'p-4'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitCompare className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-indigo-400`} />
          <h3
            className={`font-semibold text-gray-200 ${compact ? 'text-xs' : 'text-sm'}`}
          >
            My Comparison
          </h3>
          {/* Entry count badge */}
          {!isEmpty && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[9px] font-bold text-indigo-300">
              {comparisonSet.length} service{comparisonSet.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Clear All button */}
        <button
          onClick={isEmpty ? undefined : onClearAll}
          disabled={isEmpty}
          aria-label="Clear all pinned services and return to default view"
          aria-disabled={isEmpty ? 'true' : undefined}
          className={`${compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'} rounded-lg border font-medium transition-all duration-200 ${
            isEmpty
              ? 'opacity-40 cursor-not-allowed border-gray-600/40 text-gray-500'
              : 'border-rose-500/30 text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/50 cursor-pointer'
          }`}
        >
          Clear All
        </button>
      </div>

      {/* Content */}
      {isEmpty ? (
        <p className={`text-center text-gray-500 ${compact ? 'text-[10px] py-3' : 'text-xs py-4'}`}>
          Search for services above to compare them
        </p>
      ) : (
        <ul className="space-y-1.5">
          {comparisonSet.map((entry, index) => (
            <li
              key={`${entry.provider}-${entry.service_name}-${index}`}
              className={`flex items-center gap-2 rounded-lg border border-white/5 bg-gray-800/40 hover:bg-gray-800/60 hover:border-white/10 transition-all duration-200 ${
                compact ? 'px-2 py-1' : 'px-3 py-2'
              }`}
            >
              {/* Provider badge */}
              {providerBadge(entry.provider)}

              {/* Service info */}
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium text-white truncate ${
                    compact ? 'text-[10px]' : 'text-xs'
                  }`}
                >
                  {entry.service_name}
                </p>
                <p className={`text-gray-500 truncate ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
                  {entry.category}
                </p>
              </div>

              {/* Price */}
              <div className="flex-shrink-0 text-right">
                <span
                  className={`font-mono font-semibold text-indigo-300 ${
                    compact ? 'text-[9px]' : 'text-[10px]'
                  }`}
                >
                  ${entry.price_usd.toFixed(4)}
                </span>
                <span
                  className={`ml-0.5 text-indigo-500 ${compact ? 'text-[8px]' : 'text-[9px]'}`}
                >
                  {entry.unit}
                </span>
              </div>

              {/* Remove button */}
              <button
                onClick={() => onRemove && onRemove(entry)}
                aria-label={`Remove ${entry.service_name} from comparison`}
                className="flex-shrink-0 p-0.5 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
              >
                <X className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
