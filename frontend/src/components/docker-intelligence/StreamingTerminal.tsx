import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAIStream } from '../../hooks/useAIStream'
import { useAISettings } from '../../context/AISettingsContext'

const LINE_COLORS = {
  input:  'text-cyan-400',
  output: 'text-gray-300',
  ai:     'text-violet-300',
  error:  'text-red-400',
  system: 'text-gray-600',
}

/**
 * StreamingTerminal — collapsible bottom-dock terminal with AI command explanations.
 */
export default function StreamingTerminal() {
  const { getAIConfig } = useAISettings()
  const { streaming, streamedText, stream, cancel, reset } = useAIStream()

  const [isOpen, setIsOpen] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [commandHistory, setCommandHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [outputLines, setOutputLines] = useState([
    { type: 'system', content: '🐳 Docker Intelligence Terminal — type "help" for commands' },
    { type: 'system', content: 'Prefix with "explain:" to get AI explanations' },
  ])
  const [isFocused, setIsFocused] = useState(false)

  const inputRef = useRef(null)
  const outputEndRef = useRef(null)

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [outputLines, streamedText])

  const appendLine = useCallback((type, content) => {
    setOutputLines(prev => [...prev, { type, content }])
  }, [])

  const handleSubmit = useCallback(async () => {
    const cmd = inputValue.trim()
    if (!cmd) return

    // Add to history
    setCommandHistory(prev => [cmd, ...prev])
    setHistoryIndex(-1)
    setInputValue('')

    // Echo the command
    appendLine('input', `$ ${cmd}`)

    // Route: explain: prefix → AI stream
    if (cmd.toLowerCase().startsWith('explain:')) {
      const question = cmd.slice(8).trim()
      if (!question) {
        appendLine('error', 'Usage: explain: <docker command or concept>')
        return
      }
      reset()
      const aiConfig = getAIConfig()
      const result = await stream('/api/docker-intelligence/explain', {
        ...aiConfig,
        question: `Explain this Docker command or concept: ${question}`,
        dockerfile: '',
        history: [],
      })
      if (result.text) {
        result.text.split('\n').forEach(line => appendLine('ai', line))
      } else if (result.error) {
        appendLine('error', `AI Error: ${result.error}`)
      }
      return
    }

    // Clear command
    if (cmd === 'clear') {
      setOutputLines([{ type: 'system', content: '🐳 Terminal cleared' }])
      return
    }

    // Real Docker commands via backend
    if (cmd.startsWith('docker ') || cmd === 'help') {
      try {
        const res = await fetch('/api/docker-intelligence/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd }),
        })
        const data = await res.json()
        if (data.status === 'success') {
          data.output.split('\n').forEach(line => appendLine('output', line))
        } else {
          appendLine('error', data.output || 'Command failed')
        }
      } catch (err) {
        appendLine('error', `Error: ${err.message}`)
      }
      return
    }

    // Unknown command
    appendLine('error', `Command not recognized: ${cmd}`)
    appendLine('system', 'Type "help" for available commands')
  }, [inputValue, appendLine, getAIConfig, stream, reset])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
      setHistoryIndex(newIndex)
      if (commandHistory[newIndex] !== undefined) {
        setInputValue(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIndex = Math.max(historyIndex - 1, -1)
      setHistoryIndex(newIndex)
      setInputValue(newIndex === -1 ? '' : commandHistory[newIndex] || '')
    }
  }

  return (
    <div className={`flex-shrink-0 border-t border-gray-700/40 bg-gray-950/90 backdrop-blur transition-all duration-300 ${isOpen ? 'h-56' : 'h-10'}`}>
      {/* Terminal header */}
      <div
        className="flex items-center gap-3 px-4 h-10 cursor-pointer hover:bg-gray-900/40 transition-colors select-none"
        onClick={() => setIsOpen(o => !o)}
      >
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="text-xs font-mono text-gray-400 font-semibold">Terminal</span>
        {streaming && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-[10px] text-violet-400">AI streaming...</span>
          </div>
        )}
        <div className="flex-1" />
        <svg
          className={`w-3.5 h-3.5 text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Terminal body */}
      {isOpen && (
        <div className="flex flex-col h-[calc(100%-40px)]" onClick={() => inputRef.current?.focus()}>
          {/* Output area */}
          <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs space-y-0.5">
            {outputLines.map((line, i) => (
              <div key={i} className={`leading-relaxed ${LINE_COLORS[line.type] || 'text-gray-300'}`}>
                {line.content}
              </div>
            ))}

            {/* Streaming AI output */}
            {streaming && streamedText && (
              <div className="text-violet-300 leading-relaxed whitespace-pre-wrap">
                {streamedText}
                <span className="inline-block w-1.5 h-3 bg-violet-400 ml-0.5 animate-pulse align-middle" />
              </div>
            )}

            <div ref={outputEndRef} />
          </div>

          {/* Input line */}
          <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-800/60">
            <span className="text-cyan-500 font-mono text-xs flex-shrink-0">$</span>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={streaming}
              placeholder="docker ps | explain: docker run -d"
              className="flex-1 bg-transparent font-mono text-xs text-gray-200 placeholder-gray-700 outline-none disabled:opacity-50"
              autoComplete="off"
              spellCheck={false}
            />
            {isFocused && !inputValue && (
              <span className="w-1.5 h-3.5 bg-gray-400 animate-pulse" />
            )}
            {streaming && (
              <button
                onClick={(e) => { e.stopPropagation(); cancel() }}
                className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
