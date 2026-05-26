import React from 'react'
import { Search, X } from 'lucide-react'
import CloudCostFilterPanel from './CloudCostFilterPanel'
import { REGIONS } from '../data/cloudCostUtils'

/**
 * EnhancedFilterPanel — wraps the existing CloudCostFilterPanel with
 * search input and region selector.
 */
export default function EnhancedFilterPanel({
  // Existing CloudCostFilterPanel props (passed through unchanged)
  allCategories,
  selectedCategories,
  onCategoryToggle,
  onSelectAllCategories,
  onClearAllCategories,
  activeProviders,
  onProviderToggle,
  viewMode,
  onViewModeChange,
  // New props
  searchQuery = '',
  onSearchChange,
  selectedRegion = 'us-east',
  onRegionChange,
  activeFilterCount = 0,
  onResetFilters,
}) {
  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search services…"
          className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-200 rounded-xl
            pl-9 pr-8 py-2 text-xs placeholder-gray-600
            focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/30
            transition-all duration-150"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange?.('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Existing filter panel */}
      <CloudCostFilterPanel
        allCategories={allCategories}
        selectedCategories={selectedCategories}
        onCategoryToggle={onCategoryToggle}
        onSelectAllCategories={onSelectAllCategories}
        onClearAllCategories={onClearAllCategories}
        activeProviders={activeProviders}
        onProviderToggle={onProviderToggle}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />

      {/* Region selector */}
      <div className="card p-4 space-y-2">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
          Region
        </h3>
        <div className="flex flex-col gap-1">
          {Object.entries(REGIONS).map(([key, { label, multiplier }]) => {
            const isActive = selectedRegion === key
            return (
              <button
                key={key}
                onClick={() => onRegionChange?.(key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 border
                  ${isActive
                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                    : 'bg-gray-800/40 border-gray-700/30 text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                  }`}
              >
                <span>{label}</span>
                <span className={`text-[10px] font-mono ${isActive ? 'text-indigo-400' : 'text-gray-600'}`}>
                  {multiplier === 1 ? 'base' : `×${multiplier.toFixed(2)}`}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Reset filters */}
      {activeFilterCount > 0 && (
        <button
          onClick={onResetFilters}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
            bg-red-500/10 border border-red-500/20 text-red-400
            hover:bg-red-500/20 transition-all duration-150"
        >
          <X className="w-3 h-3" />
          Reset all filters ({activeFilterCount})
        </button>
      )}
    </div>
  )
}
