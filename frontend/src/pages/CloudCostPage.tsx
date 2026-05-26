import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { PRICE_DATASET, DATASET_META } from '../data/cloudCostData'
import {
  ALL_CATEGORIES,
  filterEntries,
  applySearchFilter,
  applyRegionMultiplier,
  computeMetrics,
  detectAnomalies,
  computeSavings,
  buildLeaderboard,
  generateTrendData,
  generateCSV,
  REGIONS,
} from '../data/cloudCostUtils'
import {
  filterInstancesBySpecs,
  sortInstanceEntries,
  DEFAULT_INSTANCE_FILTERS,
} from '../data/granularCatalogUtils'

// Existing components (preserved)
import CloudCostDisclaimer from '../components/CloudCostDisclaimer'
import CloudCostTable from '../components/CloudCostTable'
import PageHeader from '../components/PageHeader'

// FinOps dashboard components
import FinOpsDashboardHeader from '../components/FinOpsDashboardHeader'
import MetricCardsRow from '../components/MetricCardsRow'
import EnhancedFilterPanel from '../components/EnhancedFilterPanel'
import ChartSuite from '../components/ChartSuite'
import SavingsWidget from '../components/SavingsWidget'
import Leaderboard from '../components/Leaderboard'
import AIInsightsPanel from '../components/AIInsightsPanel'

// Usability enhancements
import GlobalSearchBar from '../components/GlobalSearchBar'
import CategoryPillBar from '../components/CategoryPillBar'
import CategoryCompareCard from '../components/CategoryCompareCard'

// Chat-based cost analysis
import CostChatPanel from '../components/CostChatPanel'

// Open service search
import ServiceSearchInput from '../components/ServiceSearchInput'
import SearchResultsDropdown from '../components/SearchResultsDropdown'
import MyComparisonPanel from '../components/MyComparisonPanel'

// Granular pricing components
import GranularViewToggle from '../components/granular-pricing/GranularViewToggle'
import ServiceConfigurator from '../components/granular-pricing/ServiceConfigurator'
import InstanceFamilyBrowser from '../components/granular-pricing/InstanceFamilyBrowser'
import ComparisonTable from '../components/granular-pricing/ComparisonTable'
import CostCalculator from '../components/granular-pricing/CostCalculator'

// Zustand store
import useFinOpsDashboardStore from '../store/useFinOpsDashboardStore'

export default function CloudCostPage() {
  // ── Persisted UI state ────────────────────────────────────────────────────
  const { dashboardMode, setDashboardMode } = useFinOpsDashboardStore()

  // ── Live pricing state ────────────────────────────────────────────────────
  const [liveEntries, setLiveEntries] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [dataSource, setDataSource] = useState('static')

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedCategories, setSelectedCategories] = useState(ALL_CATEGORIES)
  const [activeProviders, setActiveProviders] = useState(['AWS', 'Azure', 'GCP'])
  const [viewMode, setViewMode] = useState('combined')
  const [sortConfig, setSortConfig] = useState({ key: 'category', dir: 'asc' })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('us-east')

  // ── Dashboard state ───────────────────────────────────────────────────────
  const [budgetThreshold, setBudgetThreshold] = useState(0)
  const [trendGranularity, setTrendGranularity] = useState('monthly')
  const [openDrillDown, setOpenDrillDown] = useState(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [exportSuccess, setExportSuccess] = useState('')
  const [compareCategory, setCompareCategory] = useState(null) // category shown in compare card

  // ── Chat panel state ──────────────────────────────────────────────────────
  const [chatPanelOpen, setChatPanelOpen] = useState(false)

  // ── Service search state ──────────────────────────────────────────────────
  const [comparisonSet, setComparisonSet] = useState([])
  const [serviceSearchQuery, setServiceSearchQuery] = useState('')
  const [serviceSearchResults, setServiceSearchResults] = useState([])
  const [serviceSearchLoading, setServiceSearchLoading] = useState(false)
  const [serviceSearchError, setServiceSearchError] = useState(null)
  const [serviceSearchUnavailable, setServiceSearchUnavailable] = useState(false)

  // ── Granular view state ───────────────────────────────────────────────────
  const [granularMode, setGranularMode] = useState(false)
  const [catalogData, setCatalogData] = useState(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState(null)
  const catalogFetchedRef = useRef(false)

  // Granular sub-state
  const [comparisonBasket, setComparisonBasket] = useState([])
  const [selectedInstance, setSelectedInstance] = useState(null)
  const [granularCategory, setGranularCategory] = useState('Compute (VMs)')
  const [instanceFilters, setInstanceFilters] = useState(DEFAULT_INSTANCE_FILTERS)
  const [instanceSortKey, setInstanceSortKey] = useState('price_usd')
  const [instanceSortDir, setInstanceSortDir] = useState('asc')
  const [compSortKey, setCompSortKey] = useState('price_usd')
  const [compSortDir, setCompSortDir] = useState('asc')
  const [calcHours, setCalcHours] = useState(730)
  const [calcCount, setCalcCount] = useState(1)

  // Saved summary state for restoration when switching back
  const [savedSummaryState, setSavedSummaryState] = useState(null)

  // ── Active dataset: live prices or static fallback ────────────────────────
  const ACTIVE_DATASET = useMemo(() => {
    // If user has built a comparison set, use it
    if (comparisonSet.length > 0) return comparisonSet
    // Otherwise use live or static dataset
    return liveEntries ?? PRICE_DATASET
  }, [comparisonSet, liveEntries])

  // ── Fetch live prices on mount ────────────────────────────────────────────
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/cloud-pricing/prices')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (json.data?.entries?.length > 0) {
          setLiveEntries(json.data.entries)
          setLastSyncedAt(json.data.synced_at)
          setDataSource(json.data.source ?? 'live')
        }
      } catch (err) {
        setSyncError('Could not fetch live prices — using reference data.')
        console.warn('Live pricing fetch failed:', err.message)
      }
    }
    fetchPrices()
  }, [])

  // ── Manual sync handler ───────────────────────────────────────────────────
  const handleSyncPrices = useCallback(async () => {
    setIsSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/cloud-pricing/sync', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.data?.entries?.length > 0) {
        setLiveEntries(json.data.entries)
        setLastSyncedAt(json.data.synced_at)
        setDataSource(json.data.source ?? 'live')
      }
    } catch (err) {
      setSyncError('Sync failed — using cached data.')
    } finally {
      setIsSyncing(false)
    }
  }, [])

  // ── Service search handler ────────────────────────────────────────────────
  const handleServiceSearch = useCallback(async (query) => {
    setServiceSearchQuery(query)
    if (query.trim().length < 2) {
      setServiceSearchResults([])
      setServiceSearchError(null)
      return
    }

    setServiceSearchLoading(true)
    setServiceSearchError(null)
    setServiceSearchUnavailable(false)

    try {
      const providers = activeProviders.join(',')
      const res = await fetch(`/api/cloud-pricing/search?q=${encodeURIComponent(query)}&providers=${providers}`)
      if (!res.ok) {
        if (res.status === 503) {
          setServiceSearchUnavailable(true)
          throw new Error('Service search temporarily unavailable')
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      setServiceSearchResults(json.data?.results ?? [])
    } catch (err) {
      setServiceSearchError(err.message)
      setServiceSearchResults([])
    } finally {
      setServiceSearchLoading(false)
    }
  }, [activeProviders])

  // ── Service search selection handlers ─────────────────────────────────────
  const handleSelectSearchResult = useCallback((entry) => {
    setComparisonSet((prev) => {
      const exists = prev.some(
        (e) => e.provider === entry.provider && e.category === entry.category && e.service === entry.service
      )
      if (exists) {
        // Remove if already in set
        return prev.filter(
          (e) => !(e.provider === entry.provider && e.category === entry.category && e.service === entry.service)
        )
      } else {
        // Add if under limit
        if (prev.length >= 10) {
          return prev // Max 10 entries
        }
        return [...prev, entry]
      }
    })
  }, [])

  const handleRemoveFromComparison = useCallback((entry) => {
    setComparisonSet((prev) =>
      prev.filter(
        (e) => !(e.provider === entry.provider && e.category === entry.category && e.service === entry.service)
      )
    )
  }, [])

  const handleClearComparison = useCallback(() => {
    setComparisonSet([])
    setServiceSearchQuery('')
    setServiceSearchResults([])
  }, [])

  // ── Derived data pipeline ─────────────────────────────────────────────────
  const baseFiltered = useMemo(
    () => filterEntries(ACTIVE_DATASET, selectedCategories, activeProviders),
    [ACTIVE_DATASET, selectedCategories, activeProviders]
  )

  const searchFiltered = useMemo(
    () => applySearchFilter(baseFiltered, searchQuery),
    [baseFiltered, searchQuery]
  )

  const regionMultiplier = REGIONS[selectedRegion]?.multiplier ?? 1
  const regionLabel = REGIONS[selectedRegion]?.label ?? 'US East'

  const regionEntries = useMemo(
    () => applyRegionMultiplier(searchFiltered, regionMultiplier),
    [searchFiltered, regionMultiplier]
  )

  const metrics = useMemo(() => computeMetrics(regionEntries), [regionEntries])
  const anomalySet = useMemo(() => detectAnomalies(regionEntries), [regionEntries])
  const savings = useMemo(() => computeSavings(regionEntries), [regionEntries])
  const leaderboard = useMemo(() => buildLeaderboard(regionEntries, 10), [regionEntries])

  const { historical: trendData, forecast: forecastData } = useMemo(
    () => generateTrendData(regionEntries, trendGranularity),
    [regionEntries, trendGranularity]
  )

  // Initialize budget threshold to 120% of avg cost when data first loads
  useEffect(() => {
    if (metrics.avgMonthlyCost > 0 && budgetThreshold === 0) {
      setBudgetThreshold(metrics.avgMonthlyCost * 1.2)
    }
  }, [metrics.avgMonthlyCost])

  // ── Lazy catalog fetch — only when Granular View is first activated ────────
  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      const res = await fetch('/api/cloud-pricing/catalog')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.data?.entries?.length > 0) {
        setCatalogData(json.data.entries)
      } else {
        throw new Error('Empty catalog response')
      }
    } catch (err) {
      setCatalogError(`Could not load granular catalog: ${err.message}`)
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    if (granularMode && !catalogFetchedRef.current) {
      catalogFetchedRef.current = true
      fetchCatalog()
    }
  }, [granularMode, fetchCatalog])

  // ── Granular view mode toggle ─────────────────────────────────────────────
  const handleGranularToggle = useCallback((mode) => {
    if (mode && !granularMode) {
      // Save current summary filter state
      setSavedSummaryState({ selectedCategories, activeProviders, selectedRegion, searchQuery })
    } else if (!mode && granularMode && savedSummaryState) {
      // Restore summary filter state
      setSelectedCategories(savedSummaryState.selectedCategories)
      setActiveProviders(savedSummaryState.activeProviders)
      setSelectedRegion(savedSummaryState.selectedRegion)
      setSearchQuery(savedSummaryState.searchQuery)
    }
    setGranularMode(mode)
  }, [granularMode, savedSummaryState, selectedCategories, activeProviders, selectedRegion, searchQuery])

  // ── Granular derived data ─────────────────────────────────────────────────
  const filteredInstances = useMemo(() => {
    if (!catalogData) return []
    return filterInstancesBySpecs(catalogData, { ...instanceFilters, category: granularCategory })
  }, [catalogData, instanceFilters, granularCategory])

  const sortedInstances = useMemo(
    () => sortInstanceEntries(filteredInstances, instanceSortKey, instanceSortDir),
    [filteredInstances, instanceSortKey, instanceSortDir]
  )

  const sortedBasket = useMemo(
    () => sortInstanceEntries(comparisonBasket, compSortKey, compSortDir),
    [comparisonBasket, compSortKey, compSortDir]
  )

  // ── Basket handlers ───────────────────────────────────────────────────────
  const handleAddToBasket = useCallback((entry) => {
    setComparisonBasket((prev) => {
      const exists = prev.some((b) => b.provider === entry.provider && b.instance_type === entry.instance_type)
      return exists ? prev : [...prev, entry]
    })
  }, [])

  const handleRemoveFromBasket = useCallback((entry) => {
    setComparisonBasket((prev) =>
      prev.filter((b) => !(b.provider === entry.provider && b.instance_type === entry.instance_type))
    )
  }, [])

  const handleInstanceSort = useCallback((key) => {
    setInstanceSortKey((prev) => {
      if (prev === key) setInstanceSortDir((d) => d === 'asc' ? 'desc' : 'asc')
      else { setInstanceSortDir('asc') }
      return key
    })
  }, [])

  const handleCompSort = useCallback((key) => {
    setCompSortKey((prev) => {
      if (prev === key) setCompSortDir((d) => d === 'asc' ? 'desc' : 'asc')
      else { setCompSortDir('asc') }
      return key
    })
  }, [])

  // ── Active filter count ───────────────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedCategories.length !== ALL_CATEGORIES.length) count++
    if (activeProviders.length !== 3) count++
    if (selectedRegion !== 'us-east') count++
    if (searchQuery.trim()) count++
    return count
  }, [selectedCategories, activeProviders, selectedRegion, searchQuery])

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleCategoryToggle = (cat) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )

  const handleProviderToggle = (p) =>
    setActiveProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )

  const handleSort = (key) =>
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    )

  const handleDrillDownToggle = (category) =>
    setOpenDrillDown((prev) => (prev === category ? null : category))

  const handleResetFilters = () => {
    setSelectedCategories(ALL_CATEGORIES)
    setActiveProviders(['AWS', 'Azure', 'GCP'])
    setSelectedRegion('us-east')
    setSearchQuery('')
    setOpenDrillDown(null)
  }
  // ── Export handlers ───────────────────────────────────────────────────────
  const handleExport = useCallback((format) => {
    if (format === 'csv') {
      try {
        const csv = generateCSV(regionEntries, regionLabel, regionMultiplier)
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const date = new Date().toISOString().slice(0, 10)
        const providers = activeProviders.join('-').toLowerCase()
        a.href = url
        a.download = `cloud-costs-${date}-${providers}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setExportSuccess('CSV exported successfully')
        setTimeout(() => setExportSuccess(''), 2500)
      } catch (err) {
        console.error('CSV export failed:', err)
      }
    } else if (format === 'pdf') {
      window.print()
    }
  }, [regionEntries, regionLabel, regionMultiplier, activeProviders])

  const compact = dashboardMode === 'compact'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1600px] animate-fade-in dashboard-main">
      <PageHeader
        icon="💰"
        title="Cloud Cost FinOps Dashboard"
        description={`Live pricing across AWS, Azure, and GCP · ${ACTIVE_DATASET.length} services · ${dataSource === 'live' ? '🟢 Live data' : '🟡 Reference data'}`}
        badge="FinOps"
      />

      {/* Disclaimer */}
      <CloudCostDisclaimer lastUpdated={lastSyncedAt ?? DATASET_META.last_updated} />

      {/* Sync error banner */}
      {syncError && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{syncError}</span>
        </div>
      )}

      {/* Export success toast */}
      {exportSuccess && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
          <span>✓</span>
          <span>{exportSuccess}</span>
        </div>
      )}

      {/* Dashboard header bar */}
      <FinOpsDashboardHeader
        dashboardMode={dashboardMode}
        onModeToggle={() => setDashboardMode(dashboardMode === 'expanded' ? 'compact' : 'expanded')}
        activeFilterCount={activeFilterCount}
        onExport={handleExport}
        onResetFilters={handleResetFilters}
        onSyncPrices={handleSyncPrices}
        isSyncing={isSyncing}
        lastSyncedAt={lastSyncedAt}
        chatPanelOpen={chatPanelOpen}
        onChatToggle={() => setChatPanelOpen((o) => !o)}
      />

      {/* Summary / Detail view toggle */}
      <div className="mb-4">
        <GranularViewToggle
          granularMode={granularMode}
          onToggle={handleGranularToggle}
          catalogLoading={catalogLoading}
        />
      </div>

      {/* ── GRANULAR VIEW ── */}
      {granularMode ? (
        <div className="space-y-5">
          {/* Catalog error */}
          {catalogError && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <span>⚠️ {catalogError}</span>
              <button
                onClick={() => { catalogFetchedRef.current = false; fetchCatalog() }}
                className="ml-4 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-[10px] font-semibold"
              >
                Retry
              </button>
            </div>
          )}

          <div className="flex gap-5">
            {/* Left: Service Configurator */}
            <ServiceConfigurator
              catalog={catalogData ?? []}
              filters={instanceFilters}
              onFiltersChange={setInstanceFilters}
              comparisonBasket={comparisonBasket}
              onAddToBasket={handleAddToBasket}
              onRemoveFromBasket={handleRemoveFromBasket}
              onCompare={() => {
                // Scroll to comparison table
                document.getElementById('comparison-table')?.scrollIntoView({ behavior: 'smooth' })
              }}
              activeCategory={granularCategory}
              onCategoryChange={(cat) => {
                setGranularCategory(cat)
                setInstanceFilters((f) => ({ ...f, category: cat }))
              }}
            />

            {/* Right: Browser + Comparison + Calculator */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Instance Family Browser */}
              <InstanceFamilyBrowser
                entries={sortedInstances}
                totalCount={filteredInstances.length}
                sortKey={instanceSortKey}
                sortDir={instanceSortDir}
                onSort={handleInstanceSort}
                onAddToBasket={handleAddToBasket}
                onSelectForCalculator={setSelectedInstance}
                loading={catalogLoading}
              />

              {/* Comparison Table */}
              <div id="comparison-table">
                <ComparisonTable
                  basket={sortedBasket}
                  catalog={catalogData ?? []}
                  onRemoveFromBasket={handleRemoveFromBasket}
                  onClearBasket={() => setComparisonBasket([])}
                  onSelectForCalculator={setSelectedInstance}
                  sortKey={compSortKey}
                  sortDir={compSortDir}
                  onSort={handleCompSort}
                />
              </div>

              {/* Cost Calculator */}
              <CostCalculator
                entry={selectedInstance}
                hoursPerMonth={calcHours}
                instanceCount={calcCount}
                onHoursChange={setCalcHours}
                onCountChange={setCalcCount}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ── SUMMARY VIEW ── */
        <>
          {/* ── Global search bar ── */}
          <div className="mb-4">
            <GlobalSearchBar
              entries={regionEntries}
              searchQuery={searchQuery}
              onSearchChange={(q) => {
                setSearchQuery(q)
                // If search matches a single category, highlight it
                if (q.trim()) setCompareCategory(null)
              }}
              onSelectCategory={(cat) => {
                // Ensure the category is selected in the filter
                if (!selectedCategories.includes(cat)) {
                  setSelectedCategories((prev) => [...prev, cat])
                }
                setCompareCategory(cat)
                setOpenDrillDown(cat)
                // Scroll to table
                setTimeout(() => {
                  document.getElementById('cloud-cost-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 100)
              }}
              onSelectEntry={(entry) => {
                setCompareCategory(entry.category)
              }}
            />
          </div>

          {/* ── Category quick-jump pill bar ── */}
          <div className="mb-4">
            <CategoryPillBar
              allCategories={ALL_CATEGORIES}
              selectedCategories={selectedCategories}
              onCategoryToggle={handleCategoryToggle}
              onSelectAll={() => setSelectedCategories(ALL_CATEGORIES)}
              onClearAll={() => {
                setSelectedCategories([])
                setOpenDrillDown(null)
              }}
              activeCategory={compareCategory ?? openDrillDown}
            />
          </div>

          {/* KPI metric cards */}
          <div className={compact ? 'mb-4' : 'mb-6'}>
            <MetricCardsRow metrics={metrics} compact={compact} />
          </div>

          {/* My Comparison Panel — shown when user has built a comparison set */}
          {comparisonSet.length > 0 && (
            <div className="mb-5">
              <MyComparisonPanel
                comparisonSet={comparisonSet}
                onRemove={handleRemoveFromComparison}
                onClearAll={handleClearComparison}
              />
            </div>
          )}

          {/* Main layout: filter sidebar + content */}
          <div className="flex gap-5">
            {/* Left sidebar: enhanced filter panel */}
            <div className="w-72 flex-shrink-0 filter-panel">
              {/* Service search input */}
              <div className="mb-3 relative">
                <ServiceSearchInput
                  query={serviceSearchQuery}
                  onQueryChange={handleServiceSearch}
                  loading={serviceSearchLoading}
                  error={serviceSearchError}
                  unavailable={serviceSearchUnavailable}
                />
                {/* Search results dropdown */}
                {serviceSearchQuery.length >= 2 && (
                  <SearchResultsDropdown
                    results={serviceSearchResults}
                    loading={serviceSearchLoading}
                    error={serviceSearchError}
                    unavailable={serviceSearchUnavailable}
                    comparisonSet={comparisonSet}
                    onSelect={handleSelectSearchResult}
                  />
                )}
              </div>

              <EnhancedFilterPanel
                allCategories={ALL_CATEGORIES}
                selectedCategories={selectedCategories}
                onCategoryToggle={handleCategoryToggle}
                onSelectAllCategories={() => setSelectedCategories(ALL_CATEGORIES)}
                onClearAllCategories={() => {
                  setSelectedCategories([])
                  setOpenDrillDown(null)
                }}
                activeProviders={activeProviders}
                onProviderToggle={handleProviderToggle}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedRegion={selectedRegion}
                onRegionChange={setSelectedRegion}
                activeFilterCount={activeFilterCount}
                onResetFilters={handleResetFilters}
              />
            </div>

            {/* Main content area */}
            <div className="flex-1 min-w-0 space-y-5">
              {activeProviders.length === 0 ? (
                <div className="card p-6 flex items-center justify-center min-h-[200px]">
                  <p className="text-gray-500 text-sm text-center">
                    Select at least one provider to see results.
                  </p>
                </div>
              ) : (
                <>
                  {/* ── Category compare card — shown when a category is focused ── */}
                  {compareCategory && (
                    <CategoryCompareCard
                      category={compareCategory}
                      allEntries={regionEntries}
                      anomalySet={anomalySet}
                      onClose={() => setCompareCategory(null)}
                    />
                  )}

                  <ChartSuite
                    filteredEntries={regionEntries}
                    activeProviders={activeProviders}
                    anomalySet={anomalySet}
                    trendGranularity={trendGranularity}
                    onGranularityChange={setTrendGranularity}
                    budgetThreshold={budgetThreshold}
                    onBudgetThresholdChange={setBudgetThreshold}
                    trendData={trendData}
                    forecastData={forecastData}
                    compact={compact}
                  />

                  <div className={`grid gap-5 ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                    <SavingsWidget
                      savings={savings}
                      totalSavings={savings.reduce((s, o) => s + o.savingsAmount, 0)}
                      compact={compact}
                    />
                    <Leaderboard
                      entries={leaderboard}
                      anomalySet={anomalySet}
                      compact={compact}
                      onSelectCategory={(cat) => setCompareCategory(cat)}
                    />
                  </div>

                  {(viewMode === 'table' || viewMode === 'combined') && (
                    <div id="cloud-cost-table">
                      <CloudCostTable
                        filteredEntries={regionEntries}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        anomalySet={anomalySet}
                        openDrillDown={openDrillDown}
                        onDrillDownToggle={(cat) => {
                          handleDrillDownToggle(cat)
                          setCompareCategory(cat)
                        }}
                      />
                    </div>
                  )}

                  <div className="ai-panel">
                    <AIInsightsPanel
                      filteredEntries={regionEntries}
                      anomalySet={anomalySet}
                      savings={savings}
                      isOpen={aiPanelOpen}
                      onToggle={() => setAiPanelOpen((o) => !o)}
                      compact={compact}
                    />
                  </div>

                  {/* Cost Chat Panel */}
                  <CostChatPanel
                    filteredEntries={regionEntries}
                    anomalySet={anomalySet}
                    savings={savings}
                    leaderboard={leaderboard}
                    metrics={metrics}
                    isOpen={chatPanelOpen}
                    onToggle={() => setChatPanelOpen((o) => !o)}
                    compact={compact}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
