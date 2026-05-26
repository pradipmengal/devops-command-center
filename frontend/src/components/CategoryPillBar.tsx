import React, { useRef, useEffect } from 'react'

/**
 * CategoryPillBar — horizontal scrollable pill bar for quick category navigation.
 *
 * Replaces the need to scroll through the sidebar checklist.
 * Shows all categories as clickable pills; active ones are highlighted.
 * An "All" pill selects/deselects all categories at once.
 *
 * Props:
 *   allCategories: string[]
 *   selectedCategories: string[]
 *   onCategoryToggle: (cat: string) => void
 *   onSelectAll: () => void
 *   onClearAll: () => void
 *   activeCategory: string | null   — the currently focused/drilled category
 */
export default function CategoryPillBar({
  allCategories = [],
  selectedCategories = [],
  onCategoryToggle,
  onSelectAll,
  onClearAll,
  activeCategory = null,
}) {
  const scrollRef = useRef(null)
  const activePillRef = useRef(null)

  const allSelected = selectedCategories.length === allCategories.length
  const noneSelected = selectedCategories.length === 0

  // Scroll active pill into view when activeCategory changes
  useEffect(() => {
    if (activePillRef.current && scrollRef.current) {
      activePillRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [activeCategory])

  return (
    <div className="relative">
      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-950 to-transparent z-10 pointer-events-none" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-950 to-transparent z-10 pointer-events-none" />

      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-2 py-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* All pill */}
        <button
          onClick={allSelected ? onClearAll : onSelectAll}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all duration-150 whitespace-nowrap
            ${allSelected
              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
              : noneSelected
              ? 'bg-gray-800/60 border-gray-600/40 text-gray-400 hover:border-gray-500/60 hover:text-gray-200'
              : 'bg-gray-800/40 border-gray-700/30 text-gray-500 hover:bg-gray-700/40 hover:text-gray-300'
            }`}
        >
          {allSelected ? '✓ All' : 'All'}
          <span className="ml-1 text-[9px] opacity-60">({allCategories.length})</span>
        </button>

        {/* Divider */}
        <div className="flex-shrink-0 w-px h-4 bg-gray-700/60" />

        {/* Category pills */}
        {allCategories.map((cat) => {
          const isSelected = selectedCategories.includes(cat)
          const isActive = activeCategory === cat

          return (
            <button
              key={cat}
              ref={isActive ? activePillRef : null}
              onClick={() => onCategoryToggle(cat)}
              title={cat}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all duration-150 whitespace-nowrap max-w-[160px] truncate
                ${isActive
                  ? 'bg-violet-500/25 border-violet-500/50 text-violet-300 ring-1 ring-violet-500/30'
                  : isSelected
                  ? 'bg-gray-800/60 border-gray-600/50 text-gray-200 hover:border-gray-500/60'
                  : 'bg-gray-900/40 border-gray-700/20 text-gray-600 hover:bg-gray-800/40 hover:text-gray-400 hover:border-gray-600/30'
                }`}
            >
              {cat}
            </button>
          )
        })}
      </div>
    </div>
  )
}
