import React, { useState, useMemo } from 'react'
import { sortBySeverity, getSeverityColor } from './utils/sortBySeverity'
import { useAIStream } from '../../hooks/useAIStream'
import { useAISettings } from '../../context/AISettingsContext'

/**
 * SecurityDashboard — vulnerability intelligence panel.
 *
 * Props:
 *   securityReport: SecurityReport | null
 *   dockerfileContent: string  — for AI CVE explanation context
 *
 * SecurityReport shape:
 *   { criticalCount, highCount, vulnerablePackages, fixAvailablePercent, cves: CVE[] }
 *
 * CVE shape:
 *   { id, severity, package, installedVersion, fixedVersion, description }
 */
export default function SecurityDashboard({ securityReport, dockerfileContent }) {
  const { getAIConfig } = useAISettings()
  const { streaming, streamedText, streamError, stream, reset } = useAIStream()

  const [selectedCve, setSelectedCve] = useState(null)
  const [showFixOnly, setShowFixOnly] = useState(false)

  // Sort and filter CVEs
  const displayedCves = useMemo(() => {
    if (!securityReport?.cves) return []
    let cves = sortBySeverity(securityReport.cves)
    if (showFixOnly) {
      cves = cves.filter(c => c.fixedVersion && c.fixedVersion.trim())
    }
    return cves
  }, [securityReport, showFixOnly])

  const handleCveClick = async (cve) => {
    if (selectedCve?.id === cve.id) {
      setSelectedCve(null)
      reset()
      return
    }
    setSelectedCve(cve)
    reset()

    const aiConfig = getAIConfig()
    await stream('/api/docker-intelligence/explain', {
      ...aiConfig,
      question: `Explain CVE ${cve.id} affecting ${cve.package} (${cve.installedVersion}). What is the risk? How do I fix it? Is there a safer alternative package?`,
      dockerfile: dockerfileContent || '',
      history: [],
    })
  }

  if (!securityReport) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center bg-gray-900/40 rounded-xl border border-gray-700/30">
        <div className="text-4xl mb-3">🛡️</div>
        <p className="text-sm font-semibold text-gray-400">No security scan yet</p>
        <p className="text-xs text-gray-600 mt-1">Click "Scan Security" in the Dockerfile Workspace</p>
      </div>
    )
  }

  const { criticalCount = 0, highCount = 0, vulnerablePackages = 0, fixAvailablePercent = 0 } = securityReport

  return (
    <div className="flex flex-col gap-4">
      {/* Summary widgets */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="text-2xl font-bold font-mono text-red-400">{criticalCount}</div>
          <div className="text-xs font-semibold text-gray-400 mt-1">Critical CVEs</div>
        </div>
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
          <div className="text-2xl font-bold font-mono text-orange-400">{highCount}</div>
          <div className="text-xs font-semibold text-gray-400 mt-1">High CVEs</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="text-2xl font-bold font-mono text-amber-400">{vulnerablePackages}</div>
          <div className="text-xs font-semibold text-gray-400 mt-1">Vulnerable Packages</div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="text-2xl font-bold font-mono text-emerald-400">{fixAvailablePercent}%</div>
          <div className="text-xs font-semibold text-gray-400 mt-1">Fix Available</div>
        </div>
      </div>

      {/* CVE table */}
      <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40">
          <h3 className="text-sm font-semibold text-gray-300">CVE Table</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFixOnly(f => !f)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border
                ${showFixOnly
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-gray-800/60 text-gray-400 border-gray-700/40 hover:text-gray-200'
                }`}
            >
              🔧 Fixable only
            </button>
            <span className="text-[10px] text-gray-600">{displayedCves.length} shown</span>
          </div>
        </div>

        {displayedCves.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            {showFixOnly ? 'No fixable CVEs found' : 'No CVEs found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/40 bg-gray-900/40">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">CVE ID</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Package</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Installed</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Fixed In</th>
                </tr>
              </thead>
              <tbody>
                {displayedCves.map((cve) => {
                  const colors = getSeverityColor(cve.severity)
                  const isSelected = selectedCve?.id === cve.id
                  return (
                    <React.Fragment key={cve.id}>
                      <tr
                        onClick={() => handleCveClick(cve)}
                        className={`border-b border-gray-800/40 cursor-pointer transition-colors
                          ${isSelected ? `${colors.bg} ${colors.border}` : 'hover:bg-gray-800/30'}`}
                      >
                        <td className="px-4 py-2.5 font-mono text-cyan-400 font-medium">{cve.id}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${colors.badge}`}>
                            <span className={`w-1 h-1 rounded-full ${colors.dot}`} />
                            {cve.severity}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-gray-300">{cve.package}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-500">{cve.installedVersion}</td>
                        <td className="px-3 py-2.5 font-mono">
                          {cve.fixedVersion
                            ? <span className="text-emerald-400">{cve.fixedVersion}</span>
                            : <span className="text-gray-600">—</span>
                          }
                        </td>
                      </tr>

                      {/* AI explanation panel */}
                      {isSelected && (
                        <tr>
                          <td colSpan={5} className={`px-4 py-3 ${colors.bg} border-b border-gray-700/40`}>
                            <div className="space-y-2">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                {cve.description}
                              </p>
                              {(streaming || streamedText) && (
                                <div className="bg-gray-950/60 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                                  {streamedText}
                                  {streaming && <span className="inline-block w-1.5 h-3 bg-cyan-400 ml-0.5 animate-pulse align-middle" />}
                                </div>
                              )}
                              {streamError && (
                                <p className="text-xs text-red-400">⚠️ {streamError}</p>
                              )}
                              {!streaming && !streamedText && !streamError && (
                                <p className="text-xs text-gray-600 italic">Loading AI explanation...</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
