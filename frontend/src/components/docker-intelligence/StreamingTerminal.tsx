import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAIStream } from '../../hooks/useAIStream'
import { useAISettings } from '../../context/AISettingsContext'

// Simulated Docker command responses for demo purposes
const SIMULATED_RESPONSES = {
  'docker ps': [
    'CONTAINER ID   IMAGE              COMMAND                  CREATED        STATUS                  PORTS',
    'a1b2c3d4e5f6   nginx:1.25-alpine  "/docker-entrypoint.…"   2 hours ago    Up 2 hours              0.0.0.0:80->80/tcp',
    'b2c3d4e5f6a1   python:3.11-slim   "uvicorn main:app --…"   2 hours ago    Up 2 hours              0.0.0.0:8000->8000/tcp',
    'c3d4e5f6a1b2   redis:7.2-alpine   "docker-entrypoint.s…"   2 hours ago    Up 2 hours (unhealthy)  0.0.0.0:6379->6379/tcp',
  ],
  'docker images': [
    'REPOSITORY         TAG          IMAGE ID       CREATED        SIZE',
    'nginx              1.25-alpine  abc123def456   2 days ago     41.1MB',
    'python             3.11-slim    def456abc789   5 days ago     149MB',
    'redis              7.2-alpine   789abc123def   1 week ago     34.2MB',
    'postgres           16-alpine    123def456abc   1 week ago     268MB',
  ],
  'docker stats --no-stream': [
    'CONTAINER ID   NAME           CPU %     MEM USAGE / LIMIT   MEM %     NET I/O',
    'a1b2c3d4e5f6   web-server     2.40%     128MiB / 512MiB     25.00%    1.2MB / 890kB',
    'b2c3d4e5f6a1   api-service    15.70%    256MiB / 1GiB       25.00%    5.4MB / 2.1MB',
    'c3d4e5f6a1b2   redis-cache    0.80%     64MiB / 256MiB      25.00%    234kB / 156kB',
  ],
  'docker version': [
    'Client: Docker Engine - Community',
    ' Version:           24.0.7',
    ' API version:       1.43',
    ' Go version:        go1.20.10',
    '',
    'Server: Docker Engine - Community',
    ' Engine:',
    '  Version:          24.0.7',
    '  API version:      1.43 (minimum version 1.12)',
  ],
  'help': [
    'Docker Intelligence Terminal — Available commands:',
    '',
    '  docker ps              List running containers',
    '  docker images          List images',
    '  docker stats           Show container resource usage',
    '  docker version         Show Docker version',
    '',
    '  explain: <command>     Get AI explanation of any Docker command',
    '  explain: docker run    Explain docker run flags',
    '',
    'Type any docker command to see simulated output.',
  ],
}

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
        // Split streamed text into lines for the terminal
        result.text.split('\n').forEach(line => appendLine('ai', line))
      } else if (result.error) {
        appendLine('error', `AI Error: ${result.error}`)
      }
      return
    }

    // Simulated Docker commands
    const normalized = cmd.toLowerCase().trim()
    const simulated = SIMULATED_RESPONSES[normalized] || SIMULATED_RESPONSES[cmd]
    if (simulated) {
      simulated.forEach(line => appendLine('output', line))
      return
    }

    // Unknown command
    if (cmd.startsWith('docker ')) {
      appendLine('output', `Simulated: ${cmd}`)
      appendLine('system', 'Tip: Use "explain: <command>" for AI explanation')
    } else if (cmd === 'clear') {
      setOutputLines([{ type: 'system', content: '🐳 Terminal cleared' }])
    } else {
      appendLine('error', `Command not recognized: ${cmd}`)
      appendLine('system', 'Type "help" for available commands')
    }
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
