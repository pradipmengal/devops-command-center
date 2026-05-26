import { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { Check, AlertTriangle } from 'lucide-react'
import { PROVIDER_COLORS } from '../data/cloudCostData'

/**
 * SearchResultsDropdown — dropdown for live service search results.
 *
 * Props:
 *   results        — array of ServiceEntry objects from the search API
 *   loading        — show skeleton rows while fetching
 *   error          — error string to display (or null)
 *   unavailable    — whether the search service is unavailable
 *   comparisonSet  — array of currently pinned ServiceEntry objects
 *   onSelect(entry)— called when a result row is clicked (add or remove)
 *
 * Requirements: 29.1–29.7
 */
export default function SearchResultsDropdown({
  results = [],
  loading = false,
  error = null,
  unavailable = false,
  comparisonSet = [],
  onSelect,
}) {
  const dropdownRef = useRef(null)

  const isPinned = (entry) =>
    comparisonSet.some(
      (e) => e.provider === entry.provider && e.service_name === entry.service_name
    )

  const atCapacity = comparisonSet.length >= 10

  // Sort results: AWS → Azure → GCP, then alphabetically within each provider
  const PROVIDER_ORDER = { AWS: 0, Azure: 1, GCP: 2 }
  const sorted = [...results].sort((a, b) => {
    const po = (PROVIDER_ORDER[a.provider] ?? 3) - (PROVIDER_ORDER[b.provider] ?? 3)
    if (po !== 0) return po
    return a.service_name.localeCompare(b.service_name)
  })

  return (
    <div
      ref={dropdownRef}
      role="listbox"
      className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
          Live Search Results
        </span>
        {atCapacity && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            Comparison full (10/10)
          </span>
        )}
      </div>

      {/* Body */}
      <div className="max-h-72 overflow-y-auto">
        {/* Loading skeleton */}
        {loading && (
          <div className="p-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-12 h-4 bg-white/10 rounded" />
                <div className="flex-1 h-4 bg-white/10 rounded" />
                <div className="w-16 h-4 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="px-4 py-3 text-xs text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Unavailable */}
        {!loading && unavailable && (
          <div className="px-4 py-3 text-xs text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Live search temporarily unavailable</span>
          </div>
        )}

        {/* No results */}
        {!loading && !error && !unavailable && sorted.length === 0 && (
          <div className="px-4 py-4 text-xs text-gray-500 text-center">
            No services found
          </div>
        )}

        {/* Results */}
        {!loading && !error && !unavailable && sorted.map((entry, idx) => {
          const pinned = isPinned(entry)
          const colors = PROVIDER_COLORS[entry.provider] ?? {}
          const formattedPrice = entry.price_usd < 0.001
            ? entry.price_usd.toPrecision(3)
            : entry.price_usd.toPrecision(6).replace(/\.?0+$/, '')

          return (
            <button
              key={`${entry.provider}-${entry.service_name}-${idx}`}
              role="option"
              aria-selected={pinned}
              onClick={() => {
                if (!atCapacity || pinned) onSelect?.(entry)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
                border-b border-white/[0.04] last:border-0
                ${pinned
                  ? 'bg-indigo-500/10 hover:bg-indigo-500/15'
                  : atCapacity
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-white/5 cursor-pointer'
                }`}
            >
              {/* Provider badge */}
              <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold
                ${colors.bg ?? 'bg-white/10'} ${colors.text ?? 'text-white'} ${colors.border ?? ''} border`}>
                {entry.provider}
              </span>

              {/* Service info */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-200 truncate">{entry.service_name}</div>
                <div className="text-[10px] text-gray-500 truncate">{entry.category}</div>
              </div>

              {/* Price */}
              <div className="flex-shrink-0 text-right">
                <div className="text-xs text-indigo-400 font-mono">${formattedPrice}</div>
                <div className="text-[10px] text-gray-600">{entry.unit}</div>
              </div>

              {/* Pin indicator */}
              {pinned && (
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
