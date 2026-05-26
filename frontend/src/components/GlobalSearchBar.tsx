import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { PROVIDER_COLORS } from '../data/cloudCostData'

/**
 * GlobalSearchBar — full-width search bar with instant results overlay.
 *
 * Searches across service_name, category, provider, and tier_label.
 * Shows a floating results panel with grouped results and price highlights.
 *
 * Props:
 *   entries: ServiceEntry[]       — the full region-adjusted dataset to search
 *   onSelectCategory: (cat) => void — called when user clicks a category result
 *   onSelectEntry: (entry) => void  — called when user clicks a specific service
 *   searchQuery: string
 *   onSearchChange: (q: string) => void
 */
export default function GlobalSearchBar({
  entries = [],
  onSelectCategory,
  onSelectEntry,
  searchQuery = '',
  onSearchChange,
}) {
  const [focused, setFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef(null)
  const panelRef = useRef(null)

  // ── Search logic ──────────────────────────────────────────────────────────
  const results = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q || q.length < 1) return []

    const matched = entries.filter(
      (e) =>
        e.service_name?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q) ||
        e.provider?.toLowerCase().includes(q) ||
        e.tier_label?.toLowerCase().includes(q)
    )

    // Group by category, max 5 categories, max 3 entries per category
    const grouped = {}
    for (const e of matched) {
      if (!grouped[e.category]) grouped[e.category] = []
      if (grouped[e.category].length < 3) grouped[e.category].push(e)
    }

    const categories = Object.keys(grouped).slice(0, 5)
    return categories.map((cat) => ({
      category: cat,
      entries: grouped[cat],
      totalMatches: matched.filter((e) => e.category === cat).length,
    }))
  }, [entries, searchQuery])

  const flatResults = React.useMemo(
    () => results.flatMap((g) => g.entries),
    [results]
  )

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (!focused || results.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, flatResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (activeIdx >= 0 && flatResults[activeIdx]) {
          onSelectEntry?.(flatResults[activeIdx])
          onSelectCategory?.(flatResults[activeIdx].category)
          setFocused(false)
        }
      } else if (e.key === 'Escape') {
        setFocused(false)
        inputRef.current?.blur()
      }
    },
    [focused, results, flatResults, activeIdx, onSelectEntry, onSelectCategory]
  )

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        !inputRef.current?.contains(e.target)
      ) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset active index when results change
  useEffect(() => {
    setActiveIdx(-1)
  }, [searchQuery])

  const showPanel = focused && searchQuery.trim().length > 0

  const formatPrice = (p) => {
    if (p < 0.01) return `$${p.toFixed(4)}`
    return `$${p.toFixed(2)}`
  }

  // ── Flat index tracker for keyboard nav ───────────────────────────────────
  let flatIdx = -1

  return (
    <div className="relative w-full">
      {/* Input */}
      <div className={`relative flex items-center transition-all duration-200 ${
        focused ? 'ring-2 ring-indigo-500/40' : ''
      } rounded-xl`}>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value)
            setFocused(true)
          }}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search services, categories, providers… (e.g. S3, Kubernetes, GCP)"
          className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-200 rounded-xl
            pl-10 pr-10 py-2.5 text-sm placeholder-gray-600
            focus:outline-none focus:border-indigo-500/40
            transition-all duration-150"
          aria-label="Search cloud services"
          aria-autocomplete="list"
          aria-expanded={showPanel}
        />
        {searchQuery && (
          <button
            onClick={() => { onSearchChange(''); setFocused(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results panel */}
      {showPanel && (
        <div
          ref={panelRef}
          className="absolute top-full left-0 right-0 mt-1.5 z-50
            bg-gray-900/98 backdrop-blur-md border border-gray-700/60
            rounded-xl shadow-2xl shadow-black/60 overflow-hidden
            animate-fade-in"
          role="listbox"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No services match "<span className="text-gray-300">{searchQuery}</span>"
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {results.map((group) => (
                <div key={group.category}>
                  {/* Category header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-2 bg-gray-800/60
                      hover:bg-indigo-500/10 transition-colors text-left group"
                    onClick={() => {
                      onSelectCategory?.(group.category)
                      setFocused(false)
                    }}
                  >
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-indigo-300 transition-colors">
                      {group.category}
                    </span>
                    <span className="text-[10px] text-gray-600 group-hover:text-indigo-400 transition-colors">
                      {group.totalMatches} match{group.totalMatches !== 1 ? 'es' : ''} →
                    </span>
                  </button>

                  {/* Service entries */}
                  {group.entries.map((entry) => {
                    flatIdx++
                    const currentFlatIdx = flatIdx
                    const isActive = activeIdx === currentFlatIdx
                    const colors = PROVIDER_COLORS[entry.provider] ?? {
                      text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30',
                    }

                    return (
                      <button
                        key={`${entry.provider}-${entry.service_name}`}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                          ${isActive ? 'bg-indigo-500/15' : 'hover:bg-gray-800/40'}`}
                        onClick={() => {
                          onSelectEntry?.(entry)
                          onSelectCategory?.(entry.category)
                          setFocused(false)
                        }}
                        role="option"
                        aria-selected={isActive}
                      >
                        {/* Provider badge */}
                        <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border
                          ${colors.text} ${colors.bg} ${colors.border}`}>
                          {entry.provider}
                        </span>

                        {/* Service name */}
                        <span className="flex-1 text-xs text-gray-300 truncate">
                          <HighlightMatch text={entry.service_name} query={searchQuery} />
                        </span>

                        {/* Price */}
                        <span className="flex-shrink-0 text-xs font-mono text-gray-400">
                          {formatPrice(entry.price_usd)}
                          <span className="text-gray-600 ml-1 text-[10px]">{entry.unit}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-gray-800/60 flex items-center justify-between">
                <span className="text-[10px] text-gray-600">
                  {results.reduce((s, g) => s + g.totalMatches, 0)} total matches
                </span>
                <span className="text-[10px] text-gray-700">↑↓ navigate · Enter select · Esc close</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Highlight matching substring in text.
 */
function HighlightMatch({ text, query }) {
  if (!query || !text) return <>{text}</>
  const q = query.trim()
  if (!q) return <>{text}</>

  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-indigo-500/30 text-indigo-200 rounded-sm px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}
