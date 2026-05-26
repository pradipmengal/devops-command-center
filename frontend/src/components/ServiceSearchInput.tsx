import React, { useEffect, useRef } from 'react'
import { Globe, Loader2 } from 'lucide-react'

/**
 * ServiceSearchInput — live cloud service search input with debouncing.
 *
 * Props:
 *   query                — controlled input value
 *   onQueryChange(query) — called with debounced query (≥2 chars) or '' when cleared
 *   loading              — shows a spinning loader inside the input on the right
 *   error                — error message string (optional)
 *   unavailable          — shows an amber "Live search unavailable" badge below
 *
 * Requirements: 24.1, 24.4, 28.2
 */
export default function ServiceSearchInput({
  query = '',
  onQueryChange,
  loading = false,
  error = null,
  unavailable = false,
}) {
  const debounceRef = useRef(null)

  // Debounce: fire onQueryChange 300ms after the last keystroke
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      if (query.length >= 2) {
        onQueryChange?.(query)
      } else {
        onQueryChange?.('')
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, onQueryChange])

  return (
    <div className="space-y-1.5">
      {/* Label */}
      <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
        Live Service Search
      </span>

      {/* Input wrapper */}
      <div className="relative">
        {/* Globe icon — left side */}
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400 pointer-events-none" />

        <input
          type="text"
          aria-label="Search any cloud service by name"
          placeholder="Search any cloud service…"
          value={query}
          onChange={(e) => onQueryChange?.(e.target.value)}
          className="w-full bg-gray-900/60 backdrop-blur-md border border-white/10 rounded-lg
            pl-9 pr-9 py-2 text-xs text-gray-200 placeholder-gray-600
            focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/30
            transition-all duration-200"
        />

        {/* Loader icon — right side, shown while loading */}
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400 animate-spin pointer-events-none" />
        )}
      </div>

      {/* Unavailable badge */}
      {unavailable && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 border border-amber-500/25 text-amber-400">
          Live search unavailable
        </span>
      )}
    </div>
  )
}
