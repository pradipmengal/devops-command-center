import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAISettings } from '../../context/AISettingsContext'

const SUGGESTIONS = [
  'start the apache container',
  'stop the apache container',
  'restart the apache container',
]

export default function AIContainerControl() {
  const { getAIConfig, isConfigured, openModal } = useAISettings()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    { type: 'system', text: '🤖 Tell me which container to start, stop, or restart.' },
    { type: 'system', text: 'Example: "start the apache container" or "stop container fe152955890c"' },
  ])
  const [loading, setLoading] = useState(false)
  const [containers, setContainers] = useState([])
  const endRef = useRef(null)

  const fetchContainers = useCallback(() => {
    fetch('/api/docker-intelligence/containers')
      .then(r => r.json())
      .then(d => setContainers(d.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchContainers()
  }, [fetchContainers])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    if (!isConfigured) {
      setMessages(prev => [...prev,
        { type: 'user', text },
        { type: 'error', text: '⚠️ AI is not configured. Please configure AI settings first.' },
      ])
      setInput('')
      return
    }

    const aiConfig = getAIConfig()

    setMessages(prev => [...prev, { type: 'user', text }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/docker-intelligence/ai-container-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: text,
          ...aiConfig,
        }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        setMessages(prev => [...prev, { type: 'success', text: data.message }])
        fetchContainers()
      } else {
        setMessages(prev => [...prev, { type: 'error', text: data.message }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { type: 'error', text: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, isConfigured, getAIConfig, fetchContainers])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-300">🤖 AI Container Control</h3>
        <span className="text-[10px] text-gray-600">Natural language container management</span>
        {!isConfigured && (
          <button
            onClick={openModal}
            className="ml-auto text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
          >
            ⚙️ Configure AI
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 bg-gray-900/40 rounded-xl border border-gray-700/40 p-4">
        {messages.map((msg, i) => (
          <div key={i} className={`text-xs leading-relaxed ${
            msg.type === 'user' ? 'text-cyan-400' :
            msg.type === 'success' ? 'text-emerald-400' :
            msg.type === 'error' ? 'text-red-400' :
            'text-gray-500'
          }`}>
            {msg.type === 'user' && <span className="text-gray-600 mr-2">$</span>}
            {msg.text}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            AI is thinking...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Container quick reference */}
      {containers.length > 0 && (
        <div className="bg-gray-900/40 rounded-xl border border-gray-700/40 p-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Available Containers</p>
          <div className="flex flex-wrap gap-1.5">
            {containers.map(c => (
              <button
                key={c.id}
                onClick={() => setInput(`${c.status === 'running' ? 'stop' : 'start'} the ${c.name} container`)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                  c.status === 'exited' || c.status === 'stopped'
                    ? 'bg-gray-800/40 text-gray-500 border-gray-700/30'
                    : 'bg-gray-800/60 text-gray-400 border-gray-700/40 hover:text-cyan-400'
                }`}
              >
                {c.status === 'running' ? '●' : '○'} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => setInput(s)}
            className="text-[10px] px-2 py-1 rounded-lg bg-gray-800/40 text-gray-500 border border-gray-700/30 hover:text-gray-300 hover:bg-gray-800/60 transition-all"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 rounded-xl border border-gray-700/40">
        <span className="text-cyan-500 font-mono text-xs">🤖</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="e.g. start the apache container"
          className="flex-1 bg-transparent font-mono text-xs text-gray-200 placeholder-gray-700 outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="text-[10px] px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-40"
        >
          {loading ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}