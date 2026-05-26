import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, X, GitCompare, Search } from 'lucide-react'
import { filterInstancesBySpecs, getCatalogCategories, getInstanceFamilies } from '../../data/granularCatalogUtils'
import { PROVIDER_COLORS } from '../../data/cloudCostData'

/**
 * ServiceConfigurator — left panel for browsing, filtering, and selecting instance types.
 */
export default function ServiceConfigurator({
  catalog = [],
  filters,
  onFiltersChange,
  comparisonBasket = [],
  onAddToBasket,
  onRemoveFromBasket,
  onCompare,
  activeCategory,
  onCategoryChange,
}) {
  const [expandedCategory, setExpandedCategory] = useState(activeCategory || 'Compute (VMs)')

  const categories = useMemo(() => getCatalogCategories(catalog), [catalog])

  // Entries for the expanded category (before spec filters)
  const categoryEntries = useMemo(
    () => catalog.filter((e) => e.category === expandedCategory),
    [catalog, expandedCategory]
  )

  // Entries after all filters applied
  const filteredEntries = useMemo(
    () => filterInstancesBySpecs(catalog, { ...filters, category: expandedCategory }),
    [catalog, filters, expandedCategory]
  )

  // Instance families for the current category
  const families = useMemo(() => getInstanceFamilies(categoryEntries), [categoryEntries])

  const handleCategoryClick = (cat) => {
    setExpandedCategory(cat)
    onCategoryChange?.(cat)
    // Reset spec filters when switching category
    onFiltersChange?.({
      ...filters,
      category: cat,
      vcpuMin: null,
      vcpuMax: null,
      memoryMin: null,
      memoryMax: null,
      familyPrefix: '',
    })
  }

  const isInBasket = (entry) =>
    comparisonBasket.some(
      (b) => b.provider === entry.provider && b.instance_type === entry.instance_type
    )

  const formatPrice = (p) => {
    if (!p) return '—'
    if (p < 0.01) return `$${p.toFixed(4)}`
    return `$${p.toFixed(4)}`
  }

  return (
    <div className="flex flex-col gap-3 w-72 flex-shrink-0">
      {/* Category list */}
      <div className="card p-3 space-y-1">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-2">
          Service Categories
        </p>
        {categories.map((cat) => {
          const count = catalog.filter((e) => e.category === cat).length
          const isActive = expandedCategory === cat
          return (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 border
                ${isActive
                  ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                  : 'bg-gray-800/40 border-gray-700/30 text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                }`}
            >
              <span className="truncate">{cat}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0 ${isActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-700/40 text-gray-600'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filters for expanded category */}
      {expandedCategory && (
        <div className="card p-3 space-y-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
            Filters — {expandedCategory}
          </p>

          {/* Family prefix search */}
          <div>
            <label className="text-[10px] text-gray-600 block mb-1">Instance family</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600 pointer-events-none" />
              <input
                type="text"
                value={filters.familyPrefix || ''}
                onChange={(e) => onFiltersChange?.({ ...filters, familyPrefix: e.target.value })}
                placeholder="e.g. t3, m5, D4s"
                className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-200 rounded-lg pl-7 pr-3 py-1.5 text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
            {/* Family quick-select chips */}
            {families.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {families.slice(0, 8).map((f) => (
                  <button
                    key={f}
                    onClick={() => onFiltersChange?.({ ...filters, familyPrefix: filters.familyPrefix === f ? '' : f })}
                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-all
                      ${filters.familyPrefix === f
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        : 'bg-gray-800/40 text-gray-500 border-gray-700/30 hover:text-gray-300'
                      }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* vCPU range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-600 block mb-1">vCPU min</label>
              <input
                type="number"
                min={1}
                value={filters.vcpuMin ?? ''}
                onChange={(e) => onFiltersChange?.({ ...filters, vcpuMin: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Any"
                className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-200 rounded-lg px-2 py-1.5 text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 block mb-1">vCPU max</label>
              <input
                type="number"
                min={1}
                value={filters.vcpuMax ?? ''}
                onChange={(e) => onFiltersChange?.({ ...filters, vcpuMax: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Any"
                className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-200 rounded-lg px-2 py-1.5 text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          {/* Memory range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-600 block mb-1">Memory min (GB)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={filters.memoryMin ?? ''}
                onChange={(e) => onFiltersChange?.({ ...filters, memoryMin: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="Any"
                className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-200 rounded-lg px-2 py-1.5 text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 block mb-1">Memory max (GB)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={filters.memoryMax ?? ''}
                onChange={(e) => onFiltersChange?.({ ...filters, memoryMax: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="Any"
                className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-200 rounded-lg px-2 py-1.5 text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          {/* Result count */}
          <p className="text-[10px] text-gray-600">
            {filteredEntries.length} of {categoryEntries.length} instances match
          </p>
        </div>
      )}

      {/* Instance list */}
      <div className="card overflow-hidden flex-1">
        <div className="px-3 py-2 border-b border-gray-700/40 bg-gray-900/60">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
            Instances
          </p>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
          {filteredEntries.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[10px] text-gray-600">No instances match filters.</p>
            </div>
          ) : (
            filteredEntries.slice(0, 50).map((entry, i) => {
              const inBasket = isInBasket(entry)
              const pc = PROVIDER_COLORS[entry.provider] ?? { text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30' }
              return (
                <div
                  key={`${entry.provider}-${entry.instance_type}-${i}`}
                  className={`flex items-center gap-2 px-3 py-2 border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors cursor-pointer
                    ${inBasket ? 'bg-indigo-500/5' : ''}`}
                  onClick={() => !inBasket && onAddToBasket?.(entry)}
                >
                  <span className={`inline-flex px-1 py-0.5 rounded text-[8px] font-bold border flex-shrink-0 ${pc.text} ${pc.bg} ${pc.border}`}>
                    {entry.provider}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-gray-200 truncate">{entry.instance_type}</p>
                    <p className="text-[9px] text-gray-600">{entry.vcpu}vCPU · {entry.memory_gb}GB</p>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{formatPrice(entry.price_usd)}</span>
                  {inBasket ? (
                    <span className="text-[9px] text-indigo-400 flex-shrink-0">✓</span>
                  ) : (
                    <span className="text-[9px] text-gray-600 flex-shrink-0">+</span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Comparison basket */}
      {comparisonBasket.length > 0 && (
        <div className="card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Basket ({comparisonBasket.length})
            </p>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {comparisonBasket.map((entry, i) => {
              const pc = PROVIDER_COLORS[entry.provider] ?? { text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30' }
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/30">
                  <span className={`inline-flex px-1 py-0.5 rounded text-[8px] font-bold border flex-shrink-0 ${pc.text} ${pc.bg} ${pc.border}`}>
                    {entry.provider}
                  </span>
                  <span className="text-[10px] font-mono text-gray-300 flex-1 truncate">{entry.instance_type}</span>
                  <button
                    onClick={() => onRemoveFromBasket?.(entry)}
                    className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
          <button
            onClick={onCompare}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold
              bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
              text-white transition-all shadow-lg shadow-indigo-900/20"
          >
            <GitCompare className="w-3.5 h-3.5" />
            Compare {comparisonBasket.length} instances
          </button>
        </div>
      )}
    </div>
  )
}
