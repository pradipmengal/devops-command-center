import React from 'react'
import { PROVIDER_COLORS } from '../data/cloudCostData'

const VIEW_MODES = [
  { value: 'chart',    label: '📊 Chart' },
  { value: 'table',    label: '📋 Table' },
  { value: 'combined', label: '⚡ Combined' },
]

const PROVIDERS = ['AWS', 'Azure', 'GCP']

/**
 * CloudCostFilterPanel
 *
 * Sidebar-style filter panel with three sections:
 *   1. View Mode — chart / table / combined toggle
 *   2. Providers — pill toggles for AWS, Azure, GCP
 *   3. Service Categories — scrollable checklist with Select All / Clear All
 *
 * @param {{
 *   allCategories: string[],
 *   selectedCategories: string[],
 *   onCategoryToggle: (category: string) => void,
 *   onSelectAllCategories: () => void,
 *   onClearAllCategories: () => void,
 *   activeProviders: string[],
 *   onProviderToggle: (provider: string) => void,
 *   viewMode: 'chart' | 'table' | 'combined',
 *   onViewModeChange: (mode: string) => void,
 * }} props
 */
export default function CloudCostFilterPanel({
  allCategories,
  selectedCategories,
  onCategoryToggle,
  onSelectAllCategories,
  onClearAllCategories,
  activeProviders,
  onProviderToggle,
  viewMode,
  onViewModeChange,
}) {
  const selectedCount = selectedCategories.length
  const totalCount = allCategories.length

  return (
    <div className="card p-4 space-y-5 text-sm">

      {/* ── 1. View Mode ─────────────────────────────────────────────────── */}
      <section aria-labelledby="view-mode-heading">
        <h3
          id="view-mode-heading"
          className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2"
        >
          View Mode
        </h3>
        <div className="flex flex-col gap-1.5">
          {VIEW_MODES.map(({ value, label }) => {
            const isActive = viewMode === value
            return (
              <button
                key={value}
                onClick={() => onViewModeChange(value)}
                aria-pressed={isActive}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                    : 'bg-gray-800/40 border border-gray-700/30 text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── 2. Providers ─────────────────────────────────────────────────── */}
      <section aria-labelledby="providers-heading">
        <h3
          id="providers-heading"
          className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2"
        >
          Providers
        </h3>
        <div className="flex flex-col gap-1.5">
          {PROVIDERS.map((provider) => {
            const isActive = activeProviders.includes(provider)
            const colors = PROVIDER_COLORS[provider]
            return (
              <button
                key={provider}
                onClick={() => onProviderToggle(provider)}
                aria-pressed={isActive}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  isActive
                    ? `${colors.bg} ${colors.border} ${colors.text}`
                    : 'bg-gray-800/40 border-gray-700/30 text-gray-500 hover:bg-gray-700/50 hover:text-gray-300'
                }`}
              >
                {provider}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── 3. Service Categories ─────────────────────────────────────────── */}
      <section aria-labelledby="categories-heading">
        <div className="flex items-center justify-between mb-2">
          <h3
            id="categories-heading"
            className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest"
          >
            Categories
            <span className="ml-1.5 text-gray-600 normal-case tracking-normal font-normal">
              ({selectedCount}/{totalCount})
            </span>
          </h3>
        </div>

        {/* Select All / Clear All */}
        <div className="flex gap-1.5 mb-2">
          <button
            onClick={onSelectAllCategories}
            disabled={selectedCount === totalCount}
            className="flex-1 px-2 py-1 rounded-md text-[10px] font-medium bg-gray-800/60 border border-gray-700/30 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Select All
          </button>
          <button
            onClick={onClearAllCategories}
            disabled={selectedCount === 0}
            className="flex-1 px-2 py-1 rounded-md text-[10px] font-medium bg-gray-800/60 border border-gray-700/30 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Clear All
          </button>
        </div>

        {/* Scrollable checklist */}
        <div
          className="overflow-y-auto space-y-0.5 pr-1"
          style={{ maxHeight: '300px' }}
          role="group"
          aria-labelledby="categories-heading"
        >
          {allCategories.map((category) => {
            const isChecked = selectedCategories.includes(category)
            const id = `cat-${category.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()}`
            return (
              <label
                key={category}
                htmlFor={id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
                  isChecked
                    ? 'bg-gray-800/50 text-gray-200'
                    : 'text-gray-500 hover:bg-gray-800/30 hover:text-gray-300'
                }`}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onCategoryToggle(category)}
                  className="w-3.5 h-3.5 rounded accent-indigo-500 flex-shrink-0 cursor-pointer"
                />
                <span className="text-[11px] leading-tight">{category}</span>
              </label>
            )
          })}
        </div>
      </section>
    </div>
  )
}
