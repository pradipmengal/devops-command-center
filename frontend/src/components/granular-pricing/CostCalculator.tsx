import React from 'react'
import { Calculator, TrendingDown } from 'lucide-react'
import { computeMonthlyCost } from '../../data/granularCatalogUtils'
import { PROVIDER_COLORS } from '../../data/cloudCostData'

/**
 * CostCalculator — monthly cost estimator with on-demand / reserved / spot tiers.
 */
export default function CostCalculator({ entry, hoursPerMonth, instanceCount, onHoursChange, onCountChange }) {
  const formatCost = (v) => {
    if (v === 0) return '$0.00'
    if (v < 0.01) return `$${v.toFixed(4)}`
    if (v < 1000) return `$${v.toFixed(2)}`
    return `$${(v / 1000).toFixed(2)}k`
  }

  const costs = entry ? computeMonthlyCost(entry, hoursPerMonth, instanceCount) : null
  const providerColors = entry ? (PROVIDER_COLORS[entry.provider] ?? { text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30' }) : null

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-gray-200">Cost Calculator</h3>
      </div>

      {!entry ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <TrendingDown className="w-8 h-8 text-gray-700 mb-2" />
          <p className="text-xs text-gray-500">Select an instance to calculate costs.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selected instance */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-800/40 border border-gray-700/30">
            <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${providerColors.text} ${providerColors.bg} ${providerColors.border}`}>
              {entry.provider}
            </span>
            <span className="text-xs font-semibold text-gray-200">{entry.instance_type}</span>
            <span className="text-[10px] text-gray-500 ml-auto">{entry.vcpu} vCPU · {entry.memory_gb} GB</span>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Hours/month</label>
              <input
                type="number"
                min={1}
                max={730}
                value={hoursPerMonth}
                onChange={(e) => onHoursChange(Math.min(730, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Instances</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={instanceCount}
                onChange={(e) => onCountChange(Math.max(1, Math.floor(parseInt(e.target.value) || 1)))}
                className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          {/* Cost rows */}
          <div className="space-y-2">
            {/* On-Demand */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-800/40 border border-gray-700/30">
              <div>
                <p className="text-xs font-semibold text-gray-200">On-Demand</p>
                <p className="text-[10px] text-gray-500">Pay per hour, no commitment</p>
              </div>
              <span className="text-sm font-bold font-mono text-gray-200">{formatCost(costs.onDemand)}</span>
            </div>

            {/* Reserved */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <div>
                <p className="text-xs font-semibold text-emerald-400">Reserved (1-yr)</p>
                <p className="text-[10px] text-gray-500">
                  Save ~{formatCost(costs.onDemand - costs.reserved)}/mo (40%)
                </p>
              </div>
              <span className="text-sm font-bold font-mono text-emerald-400">{formatCost(costs.reserved)}</span>
            </div>

            {/* Spot */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
              <div>
                <p className="text-xs font-semibold text-cyan-400">Spot / Preemptible</p>
                <p className="text-[10px] text-gray-500">
                  Save ~{formatCost(costs.onDemand - costs.spot)}/mo (70%)
                </p>
              </div>
              <span className="text-sm font-bold font-mono text-cyan-400">{formatCost(costs.spot)}</span>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-gray-600 leading-relaxed">
            ⚠️ Reserved and spot prices are estimates. Actual prices vary by provider, region, and availability.
          </p>
        </div>
      )}
    </div>
  )
}
