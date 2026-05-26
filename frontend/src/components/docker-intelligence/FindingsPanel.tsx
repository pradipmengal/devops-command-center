import React, { useState, useMemo } from 'react'
import { getSeverityColor } from './utils/sortBySeverity'

const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low']

/**
 * FindingsPanel — displays AI-detected Dockerfile issues with severity badges,
 * explanations, affected lines, and one-click fix application.
 *
 * Props:
 *   findings: Finding[]
 *   onApplyFix: (patchedContent: string) => void
 *
 * Finding shape:
 *   { id, severity, title, explanation, affectedLines: number[], fix: string }
 */
export default function FindingsPanel({ findings = [], onApplyFix }) {
  const [activeFilters, setActiveFilters] = useState(new Set()) // empty = show all
  const [expandedId, setExpandedId] = useState(null)

  // Count findings per severity
  const counts = useMemo(() => {
    return SEVERITY_LEVELS.reduce((acc, sev) => {
      acc[sev] = findings.filter(f => f.severity?.toLowerCase() === sev).length
      return acc
    }, {})
  }, [findings])

  // Filter findings based on active filters
  const visibleFindings = useMemo(() => {
    if (activeFilters.size === 0) return findings
    return findings.filter(f => activeFilters.has(f.severity?.toLowerCase()))
  }, [findings, activeFilters])

  const toggleFilter = (sev) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(sev)) next.delete(sev)
      else next.add(sev)
      return next
    })
  }

  const handleApplyFix = (finding) => {
    if (onApplyFix && finding.fix) {
      onApplyFix(finding.fix)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700/40 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700/40 bg-gray-900/80">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            🔍 Findings
            {findings.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-700/60 text-gray-400">
                {findings.length}
              </span>
            )}
          </h3>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {SEVERITY_LEVELS.map((sev) => {
            const colors = getSeverityColor(sev)
            const count = counts[sev]
            const isActive = activeFilters.has(sev)
            return (
              <button
                key={sev}
                onClick={() => toggleFilter(sev)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all border
                  ${isActive
                    ? `${colors.badge} scale-105`
                    : count > 0
                      ? `${colors.bg} ${colors.border} ${colors.text} opacity-70 hover:opacity-100`
                      : 'bg-gray-800/40 border-gray-700/30 text-gray-600 cursor-default'
                  }`}
                disabled={count === 0}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                {sev} {count > 0 && <span className="font-bold">{count}</span>}
              </button>
            )
          })}
          {activeFilters.size > 0 && (
            <button
              onClick={() => setActiveFilters(new Set())}
              className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-1 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Findings list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {findings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm font-semibold text-emerald-400">No issues detected</p>
            <p className="text-xs text-gray-600 mt-1">Run an AI action to analyze your Dockerfile</p>
          </div>
        ) : visibleFindings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-gray-500">No findings match the selected filters</p>
          </div>
        ) : (
          visibleFindings.map((finding) => {
            const colors = getSeverityColor(finding.severity)
            const isExpanded = expandedId === finding.id

            return (
              <div
                key={finding.id}
                className={`rounded-xl border transition-all duration-200 overflow-hidden
                  ${colors.bg} ${colors.border}`}
              >
                {/* Finding header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : finding.id)}
                  className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/5 transition-colors"
                >
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0 mt-0.5 ${colors.badge}`}>
                    {finding.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-200 leading-tight">{finding.title}</p>
                    {finding.affectedLines?.length > 0 && (
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Line{finding.affectedLines.length > 1 ? 's' : ''}: {finding.affectedLines.join(', ')}
                      </p>
                    )}
                  </div>
                  <svg
                    className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2.5 border-t border-white/5">
                    {/* Explanation */}
                    <div className="pt-2.5">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Explanation</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{finding.explanation}</p>
                    </div>

                    {/* Recommended fix */}
                    {finding.fix && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Recommended Fix</p>
                        <pre className="text-xs text-emerald-300 bg-gray-950/60 rounded-lg p-2.5 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                          {finding.fix}
                        </pre>
                      </div>
                    )}

                    {/* Apply fix button */}
                    {finding.fix && onApplyFix && (
                      <button
                        onClick={() => handleApplyFix(finding)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Apply Fix
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
