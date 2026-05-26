import React, { useEffect, useRef, useState } from 'react'
import { getScoreColor, getScoreBgColor } from './utils/scoreColor'

/**
 * useCountUp — animates a numeric value from 0 (or previous value) to target
 * over `duration` milliseconds using requestAnimationFrame.
 *
 * @param {number|null} target - Target value (null = show placeholder)
 * @param {number} duration - Animation duration in ms (default 800)
 * @returns {number|null} Current animated value
 */
function useCountUp(target, duration = 800) {
  const [current, setCurrent] = useState(null)
  const prevRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (target === null || target === undefined) {
      setCurrent(null)
      prevRef.current = null
      return
    }

    const start = prevRef.current ?? 0
    const end = target
    const startTime = performance.now()

    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = Math.round(start + (end - start) * eased)
      setCurrent(value)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        prevRef.current = end
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return current
}

/**
 * MetricCard — a single animated metric card.
 */
function MetricCard({ label, value, unit, icon, isScore = true, description }) {
  const numericValue = typeof value === 'number' ? value : null
  const animated = useCountUp(isScore ? numericValue : null)
  const displayValue = isScore ? animated : value
  const colorClass = isScore && numericValue !== null ? getScoreColor(numericValue) : 'text-cyan-400'
  const bgClass = isScore && numericValue !== null ? getScoreBgColor(numericValue) : 'bg-cyan-500/10 border-cyan-500/20'

  return (
    <div className={`relative rounded-xl border p-4 backdrop-blur transition-all duration-500
      ${numericValue !== null || value !== null
        ? `${bgClass} shadow-lg`
        : 'bg-gray-900/40 border-gray-700/30'
      }`}
    >
      {/* Subtle glow on active */}
      {(numericValue !== null || value !== null) && (
        <div className="absolute inset-0 rounded-xl opacity-20 blur-xl -z-10 bg-current" />
      )}

      <div className="flex items-start justify-between mb-2">
        <span className="text-lg">{icon}</span>
        {numericValue !== null && (
          <div className={`w-1.5 h-1.5 rounded-full ${colorClass.replace('text-', 'bg-')} animate-pulse`} />
        )}
      </div>

      <div className={`text-2xl font-bold font-mono mb-1 transition-colors duration-300 ${
        displayValue !== null ? colorClass : 'text-gray-700'
      }`}>
        {displayValue !== null ? `${displayValue}${unit || ''}` : '—'}
      </div>

      <div className="text-xs font-semibold text-gray-400 leading-tight">{label}</div>
      {description && (
        <div className="text-[10px] text-gray-600 mt-0.5 leading-tight">{description}</div>
      )}
    </div>
  )
}

/**
 * AnalysisDashboard — 8 animated metric cards showing AI-derived quality scores.
 *
 * Props:
 *   results: AnalysisResults | null
 *   AnalysisResults shape:
 *     { securityScore, optimizationScore, layerEfficiency, buildPerformance,
 *       imageSizeEstimate, vulnerabilityCount, riskLevel, cacheEfficiency }
 */
export default function AnalysisDashboard({ results }) {
  const METRICS = [
    {
      key: 'securityScore',
      label: 'Security Score',
      icon: '🔒',
      unit: '',
      isScore: true,
      description: 'Overall security posture',
    },
    {
      key: 'optimizationScore',
      label: 'Optimization Score',
      icon: '⚡',
      unit: '',
      isScore: true,
      description: 'Build & layer optimization',
    },
    {
      key: 'layerEfficiency',
      label: 'Layer Efficiency',
      icon: '📦',
      unit: '',
      isScore: true,
      description: 'Cache & ordering quality',
    },
    {
      key: 'buildPerformance',
      label: 'Build Performance',
      icon: '🚀',
      unit: '',
      isScore: true,
      description: 'Estimated build speed',
    },
    {
      key: 'imageSizeEstimate',
      label: 'Image Size',
      icon: '💾',
      unit: '',
      isScore: false,
      description: 'Estimated final image size',
    },
    {
      key: 'vulnerabilityCount',
      label: 'Vulnerabilities',
      icon: '🛡️',
      unit: '',
      isScore: false,
      description: 'Estimated CVE count',
    },
    {
      key: 'riskLevel',
      label: 'Risk Level',
      icon: '⚠️',
      unit: '',
      isScore: false,
      description: 'Overall risk assessment',
    },
    {
      key: 'cacheEfficiency',
      label: 'Cache Efficiency',
      icon: '🔄',
      unit: '',
      isScore: true,
      description: 'Layer cache utilization',
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-300">AI Analysis</h3>
        {results ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Updated
          </span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-500 border border-gray-700/30">
            Run an action to analyze
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {METRICS.map((metric) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            icon={metric.icon}
            unit={metric.unit}
            isScore={metric.isScore}
            description={metric.description}
            value={results ? results[metric.key] ?? null : null}
          />
        ))}
      </div>
    </div>
  )
}
