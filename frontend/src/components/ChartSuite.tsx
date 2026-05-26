import React, { useState, useEffect } from 'react'
import CloudCostBarChart from './CloudCostBarChart'
import BreakdownPieChart from './BreakdownPieChart'
import CostHeatmap from './CostHeatmap'
import TrendLineChart from './TrendLineChart'
import { SkeletonChart } from './SkeletonCard'

const TABS = [
  { id: 'bar',     label: '📊 Bar',     title: 'Provider Comparison' },
  { id: 'pie',     label: '🥧 Pie',     title: 'Category Breakdown' },
  { id: 'heatmap', label: '🌡️ Heatmap', title: 'Cost Intensity Grid' },
  { id: 'trend',   label: '📈 Trend',   title: 'Cost Trend & Forecast' },
]

/**
 * ChartSuite — tabbed chart container with skeleton loading state.
 */
export default function ChartSuite({
  filteredEntries = [],
  activeProviders = [],
  anomalySet = new Set(),
  trendGranularity = 'monthly',
  onGranularityChange,
  budgetThreshold = 0,
  onBudgetThresholdChange,
  trendData = [],
  forecastData = [],
  compact = false,
}) {
  const [activeTab, setActiveTab] = useState('bar')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Show skeleton on first render, then reveal charts
    const t = setTimeout(() => setMounted(true), 150)
    return () => clearTimeout(t)
  }, [])

  if (!mounted) {
    return <SkeletonChart height={compact ? 220 : 340} />
  }

  return (
    <div className="card overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-700/40 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all duration-150 border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'text-indigo-300 border-indigo-400 bg-indigo-500/10'
                : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600'
              }`}
          >
            {tab.label}
          </button>
        ))}

        {/* Granularity toggle for trend tab */}
        {activeTab === 'trend' && (
          <div className="ml-auto flex items-center gap-1 pb-2">
            {['daily', 'weekly', 'monthly'].map((g) => (
              <button
                key={g}
                onClick={() => onGranularityChange?.(g)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all duration-150
                  ${trendGranularity === g
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                  }`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart content with fade transition */}
      <div className="transition-opacity duration-200 p-0">
        {activeTab === 'bar' && (
          <CloudCostBarChart
            filteredEntries={filteredEntries}
            activeProviders={activeProviders}
            tooltipEnabled={true}
          />
        )}
        {activeTab === 'pie' && (
          <BreakdownPieChart filteredEntries={filteredEntries} compact={compact} />
        )}
        {activeTab === 'heatmap' && (
          <CostHeatmap
            filteredEntries={filteredEntries}
            activeProviders={activeProviders}
            anomalySet={anomalySet}
            compact={compact}
          />
        )}
        {activeTab === 'trend' && (
          <TrendLineChart
            trendData={trendData}
            forecastData={forecastData}
            budgetThreshold={budgetThreshold}
            onBudgetThresholdChange={onBudgetThresholdChange}
            granularity={trendGranularity}
            compact={compact}
          />
        )}
      </div>
    </div>
  )
}
