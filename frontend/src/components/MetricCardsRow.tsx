import React from 'react'
import MetricCard from './MetricCard'
import { SkeletonCard } from './SkeletonCard'
import { DollarSign, TrendingDown, AlertTriangle, BarChart2, ShieldAlert } from 'lucide-react'

/**
 * MetricCardsRow — 4 animated KPI cards at the top of the FinOps dashboard.
 */
export default function MetricCardsRow({ metrics, compact = false, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} compact={compact} />)}
      </div>
    )
  }

  const formatCost = (v) => {
    if (!v || v === 0) return '$0.00'
    if (v < 0.01) return `$${v.toFixed(4)}`
    if (v < 1000) return `$${v.toFixed(2)}`
    return `$${(v / 1000).toFixed(1)}k`
  }

  const cards = [
    {
      icon: <DollarSign className="w-4 h-4 text-indigo-400" />,
      label: 'Total Services',
      value: metrics?.totalServices ?? 0,
      subLabel: 'across active filters',
      accentColor: 'text-indigo-400',
    },
    {
      icon: <TrendingDown className="w-4 h-4 text-emerald-400" />,
      label: 'Cheapest Provider',
      value: metrics?.cheapestProvider ?? '—',
      subLabel: 'lowest avg price',
      accentColor: 'text-emerald-400',
    },
    {
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      label: 'Priciest Category',
      value: metrics?.mostExpensiveCategory ?? '—',
      subLabel: 'highest total cost',
      accentColor: 'text-amber-400',
    },
    {
      icon: <BarChart2 className="w-4 h-4 text-cyan-400" />,
      label: 'Avg Service Cost',
      value: formatCost(metrics?.avgMonthlyCost),
      subLabel: `${metrics?.anomalyCount ?? 0} anomalies detected`,
      accentColor: 'text-cyan-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} compact={compact} />
      ))}
    </div>
  )
}
