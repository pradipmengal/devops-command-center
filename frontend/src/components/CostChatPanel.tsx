import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquare, X, Trash2, Send, ChevronRight } from 'lucide-react'
import { useAIStream } from '../hooks/useAIStream'
import { useAISettings } from '../context/AISettingsContext'
import AIGate from './AIGate'
import AILoadingPanel from './AILoadingPanel'
import useFinOpsStore, { EVENT_TYPES } from '../store/useFinOpsStore'

/**
 * CostChatPanel — persistent multi-turn chat panel for cloud cost Q&A.
 *
 * Props:
 *   filteredEntries  — current visible ServiceEntry array
 *   anomalySet       — Set of anomalous ServiceEntry objects
 *   savings          — SavingsOpportunity[] array
 *   leaderboard      — top 10 ServiceEntry[] sorted by price desc
 *   metrics          — DashboardMetrics object
 *   isOpen           — whether the panel is visible
 *   onToggle()       — called to open/close the panel
 *   compact          — compact mode flag
 *
 * Requirements: 16.1–16.7, 17.1–17.5, 18.1–18.6, 19.1–19.5,
 *               21.1–21.4, 22.1–22.5, 23.1–23.8
 */
export default function CostChatPanel({
  filteredEntries = [],
  anomalySet = new Set(),
  savings = [],
  leaderboard = [],
  metrics = {},
  isOpen = false,
  onToggle,
  compact = false,
}) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const panelId = 'cost-chat-panel'

  const { streaming, streamedText, elapsed, statusMsg, streamError, firstTokenTime, stream, cancel, reset } = useAIStream()
  const { settings } = useAISettings()
  const { pushEvent } = useFinOpsStore()

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  // Auto-scroll to bottom on new messages or streaming text
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamedText])

  // Build cost_context from current dashboard state
  const buildCostContext = useCallback(() => {
    const top3 = leaderboard.slice(0, 3).map((e) => ({
      service: e.service_name,
      provider: e.provider,
      price: e.price_usd,
      unit: e.unit,
    }))
    const topSavings = savings[0]
      ? {
          category: savings[0].category,
          savings_amount: savings[0].savingsAmount,
          from: savings[0].expensiveProvider,
          to: savings[0].cheapProvider,
        }
      : null

    return {
      total_services: filteredEntries.length,
      top_3_expensive: top3,
      anomaly_count: anomalySet.size,
      avg_monthly_cost: metrics.avgMonthlyCost ?? 0,
      cheapest_provider: metrics.cheapestProvider ?? '—',
      most_expensive_category: metrics.mostExpensiveCategory ?? '—',
      top_savings_opportunity: topSavings,
    }
  }, [filteredEntries, anomalySet, savings, leaderboard, metrics])

  // Derive starter questions from current data
  const starterQuestions = (() => {
    const qs = []
    if (leaderboard[0]) {
      qs.push(`Why is ${leaderboard[0].service_name} so expensive compared to alternatives?`)
    }
    if (metrics.mostExpensiveCategory && metrics.mostExpensiveCategory !== '—') {
      qs.push(`How can I reduce costs in the ${metrics.mostExpensiveCategory} category?`)
    }
    if (anomalySet.size > 0) {
      qs.push(`Which services have pricing anomalies and what should I do about them?`)
    }
    if (savings[0]) {
      qs.push(`What's the best provider-switching opportunity to save money right now?`)
    }
    qs.push('Compare the cheapest options across AWS, Azure, and GCP for my current filters.')
    qs.push('What reserved instance or commitment discounts should I consider?')
    return qs.slice(0, 6)
  })()

  const handleSubmit = useCallback(async (text) => {
    const msg = (text ?? inputValue).trim()
    if (!msg || streaming) return

    setInputValue('')
    reset()

    // Append user message immediately
    const userMsg = { role: 'user', content: msg }
    setMessages((prev) => [...prev, userMsg])

    // Build history (last 8 exchanges = 16 messages)
    const history = messages.slice(-16).map((m) => ({ role: m.role, content: m.content }))

    const payload = {
      api_key: settings.apiKey,
      model: settings.model,
      base_url: settings.baseUrl,
      provider: settings.provider,
      message: msg,
      history,
      cost_context: buildCostContext(),
    }

    const result = await stream('/api/ai/cost-chat', payload)

    if (result.cancelled) {
      // Do not dispatch event on cancel
      return
    }

    if (result.error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Error: ${result.error}` },
      ])
      pushEvent({
        type: EVENT_TYPES.AI,
        status: 'error',
        message: `Cost chat failed: ${result.error.slice(0, 100)}`,
      })
      return
    }

    if (result.text) {
      setMessages((prev) => [...prev, { role: 'assistant', content: result.text }])
      // Dispatch AI event with first 120 chars (markdown stripped)
      const summary = result.text.replace(/[#*`_~]/g, '').slice(0, 120)
      pushEvent({
        type: EVENT_TYPES.AI,
        status: 'info',
        message: summary,
      })
    }
  }, [inputValue, streaming, messages, settings, buildCostContext, stream, reset, pushEvent])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    // Shift+Enter inserts newline naturally (textarea default)
  }

  const handleClear = () => {
    if (streaming) cancel()
    setMessages([])
    reset()
  }

  const handleChipClick = (question) => {
    setInputValue(question)
    handleSubmit(question)
  }

  return (
    <>
      {/* Toggle button in header area — rendered outside the panel */}
      {/* (The parent FinOpsDashboardHeader handles the toggle button) */}

      {/* Panel */}
      <div
        id={panelId}
        className={`
          fixed right-0 top-0 h-full z-40 flex flex-col
          bg-gray-950/95 backdrop-blur-xl border-l border-white/[0.08]
          shadow-2xl shadow-black/50
          transition-[width,opacity] duration-300 ease-in-out
          ${isOpen ? 'w-[380px] opacity-100' : 'w-0 opacity-0 overflow-hidden'}
        `}
        aria-hidden={!isOpen}
      >
        {isOpen && (
          <AIGate>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-white">Cost Analyst</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">
                  AI
                </span>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={handleClear}
                    title="Clear conversation"
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={onToggle}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Message history */}
            <div
              role="log"
              aria-live="polite"
              aria-label="Chat messages"
              className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
            >
              {/* Starter questions — shown when no messages */}
              {messages.length === 0 && !streaming && (
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-500 text-center pt-2">
                    Ask anything about your current cloud costs
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {starterQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleChipClick(q)}
                        className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/10
                          hover:bg-white/10 hover:border-white/20 text-gray-300 transition-all text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation messages */}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed
                      ${msg.role === 'user'
                        ? 'bg-indigo-600/20 border border-indigo-500/20 text-gray-200'
                        : 'bg-white/5 border border-white/[0.06] text-gray-300'
                      }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                  </div>
                </div>
              ))}

              {/* Streaming response in progress */}
              {streaming && streamedText && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-white/5 border border-white/[0.06] text-gray-300">
                    <pre className="whitespace-pre-wrap font-sans">{streamedText}</pre>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {streaming && !streamedText && (
                <div className="px-1">
                  <AILoadingPanel
                    elapsed={elapsed}
                    statusMsg={statusMsg}
                    onCancel={cancel}
                    modelName={settings.model}
                    firstTokenTime={firstTokenTime}
                  />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 border-t border-white/[0.06] px-3 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  aria-label="Ask a question about your cloud costs"
                  placeholder="Ask about your cloud costs…"
                  rows={2}
                  disabled={streaming}
                  className="flex-1 resize-none bg-gray-900/60 backdrop-blur-md border border-white/10
                    rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-600
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/30
                    transition-all duration-200 disabled:opacity-50"
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={streaming || !inputValue.trim()}
                  aria-label="Send message"
                  aria-disabled={streaming || !inputValue.trim()}
                  className="flex-shrink-0 p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                    disabled:opacity-40 disabled:cursor-not-allowed
                    text-white transition-all duration-200"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-gray-600">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </AIGate>
        )}
      </div>

      {/* Backdrop overlay when panel is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
    </>
  )
}
