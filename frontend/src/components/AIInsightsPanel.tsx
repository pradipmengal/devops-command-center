import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, X, Zap } from 'lucide-react'
import { useAIStream } from '../hooks/useAIStream'
import { useAISettings } from '../context/AISettingsContext'
import AIGate from './AIGate'
import AILoadingPanel from './AILoadingPanel'

const SHORTCUTS = [
  { label: 'Explain spending spikes', icon: '📈' },
  { label: 'Recommend reserved instances', icon: '💡' },
  { label: 'Identify idle resources', icon: '🔍' },
  { label: 'Summarize unusual usage patterns', icon: '⚠️' },
]

/**
 * AIInsightsPanel — collapsible AI-powered cost analysis panel.
 */
export default function AIInsightsPanel({
  filteredEntries = [],
  anomalySet = new Set(),
  savings = [],
  isOpen = false,
  onToggle,
  compact = false,
}) {
  const { getAIConfig } = useAISettings()
  const { streaming, streamedText, streamError, elapsed, statusMsg, stream, cancel, reset } = useAIStream()
  const [result, setResult] = useState('')

  const buildPrompt = (question) => {
    const topExpensive = [...filteredEntries]
      .sort((a, b) => b.price_usd - a.price_usd)
      .slice(0, 5)
      .map((e) => `${e.service_name} (${e.provider}): $${e.price_usd.toFixed(4)}/${e.unit}`)
      .join('\n')

    const anomalyList = [...anomalySet]
      .slice(0, 3)
      .map((e) => `${e.service_name} (${e.provider}): $${e.price_usd.toFixed(4)}`)
      .join('\n')

    const savingsList = savings
      .slice(0, 3)
      .map((s) => `${s.category}: switch ${s.expensiveProvider}→${s.cheapProvider}, save $${s.savingsAmount.toFixed(4)}`)
      .join('\n')

    return `You are a FinOps cloud cost optimization expert. Analyze this cloud cost data and ${question.toLowerCase()}.

Top 5 most expensive services:
${topExpensive || 'None'}

Detected anomalies (>2σ above category mean):
${anomalyList || 'None'}

Top savings opportunities:
${savingsList || 'None'}

Total services analyzed: ${filteredEntries.length}

Provide specific, actionable recommendations. Be concise and practical.`
  }

  const handleGenerate = async (question = 'provide a comprehensive cost optimization analysis') => {
    reset()
    setResult('')
    const aiConfig = getAIConfig()
    const res = await stream('/api/ai/chat', {
      ...aiConfig,
      message: buildPrompt(question),
      history: [],
    })
    if (res.text) setResult(res.text)
  }

  return (
    <div className="card overflow-hidden transition-all duration-300">
      {/* Toggle header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/30 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-200">AI Cost Insights</p>
          <p className="text-[10px] text-gray-500">Powered by your configured AI model</p>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {/* Collapsible body */}
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? '800px' : '0px' }}
      >
        <div className="border-t border-gray-700/40 p-4">
          <AIGate>
            <div className="space-y-3">
              {/* Shortcut buttons */}
              <div className="grid grid-cols-2 gap-2">
                {SHORTCUTS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleGenerate(s.label)}
                    disabled={streaming}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium
                      bg-gray-800/60 border border-gray-700/40 text-gray-300
                      hover:bg-gray-700/60 hover:text-white hover:border-indigo-500/30
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-all duration-150 text-left"
                  >
                    <span>{s.icon}</span>
                    <span className="leading-tight">{s.label}</span>
                  </button>
                ))}
              </div>

              {/* Generate button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerate()}
                  disabled={streaming}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                    bg-gradient-to-r from-violet-600 to-indigo-600
                    hover:from-violet-500 hover:to-indigo-500
                    text-white transition-all duration-150 shadow-lg shadow-violet-900/20
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Generate Full Analysis
                </button>
                {streaming && (
                  <button
                    onClick={cancel}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                      bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                  >
                    <X className="w-3 h-3" />
                    Stop
                  </button>
                )}
              </div>

              {/* Loading state */}
              {streaming && !streamedText && (
                <AILoadingPanel elapsed={elapsed} statusMsg={statusMsg} />
              )}

              {/* Streamed result */}
              {(streaming && streamedText) || result ? (
                <div className="bg-gray-950/60 border border-gray-700/40 rounded-xl p-3 max-h-64 overflow-y-auto">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">
                    {streaming ? streamedText : result}
                    {streaming && <span className="inline-block w-1.5 h-3.5 bg-violet-400 ml-0.5 animate-pulse align-middle" />}
                  </pre>
                </div>
              ) : null}

              {/* Error */}
              {streamError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  ⚠️ {streamError}
                </div>
              )}
            </div>
          </AIGate>
        </div>
      </div>
    </div>
  )
}
