import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAIStream } from '../../hooks/useAIStream'
import { useAISettings } from '../../context/AISettingsContext'
import useDockerIntelligenceStore from '../../store/useDockerIntelligenceStore'

const SUGGESTED_PROMPTS = [
  'Why is my image so large?',
  'Optimize this Dockerfile',
  'Explain this layer',
  'How do I add a healthcheck?',
  'What base image should I use?',
]

/**
 * Lightweight inline Markdown renderer.
 * Handles: code blocks, inline code, bold, headers, bullet lists.
 * No external dependency — uses regex splitting only.
 */
function MarkdownRenderer({ content }) {
  if (!content) return null

  // Split on code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <div className="space-y-2 text-xs leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3, -3).split('\n')
          const lang = lines[0].trim()
          const code = lines.slice(1).join('\n')
          return (
            <pre key={i} className="bg-gray-950/80 border border-gray-700/40 rounded-lg p-3 overflow-x-auto font-mono text-[11px] text-emerald-300 leading-relaxed">
              {lang && <div className="text-[9px] text-gray-500 mb-1.5 uppercase tracking-wider">{lang}</div>}
              {code}
            </pre>
          )
        }

        // Process inline formatting
        const lines = part.split('\n')
        return (
          <div key={i} className="space-y-1">
            {lines.map((line, j) => {
              if (!line.trim()) return <div key={j} className="h-1" />

              // Headers
              if (line.startsWith('## ')) {
                return <p key={j} className="text-sm font-bold text-white mt-2">{line.slice(3)}</p>
              }
              if (line.startsWith('# ')) {
                return <p key={j} className="text-sm font-bold text-cyan-300 mt-2">{line.slice(2)}</p>
              }

              // Bullet points
              if (line.match(/^[-*•]\s/)) {
                return (
                  <div key={j} className="flex gap-2">
                    <span className="text-cyan-500 flex-shrink-0 mt-0.5">•</span>
                    <span className="text-gray-300">{renderInline(line.slice(2))}</span>
                  </div>
                )
              }

              // Numbered list
              if (line.match(/^\d+\.\s/)) {
                const match = line.match(/^(\d+)\.\s(.*)/)
                return (
                  <div key={j} className="flex gap-2">
                    <span className="text-cyan-500 flex-shrink-0 font-mono text-[10px] mt-0.5">{match[1]}.</span>
                    <span className="text-gray-300">{renderInline(match[2])}</span>
                  </div>
                )
              }

              return <p key={j} className="text-gray-300">{renderInline(line)}</p>
            })}
          </div>
        )
      })}
    </div>
  )
}

function renderInline(text) {
  // Handle inline code and bold
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-gray-800/80 text-cyan-300 px-1 py-0.5 rounded text-[10px] font-mono">{part.slice(1, -1)}</code>
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

/**
 * AIAssistantPanel — persistent Docker-aware AI assistant.
 *
 * Props:
 *   dockerfileContent: string — implicit context for every request
 */
export default function AIAssistantPanel({ dockerfileContent }) {
  const { getAIConfig } = useAISettings()
  const { streaming, streamedText, streamError, stream, cancel, reset } = useAIStream()
  const appendChatMessage = useDockerIntelligenceStore(s => s.appendChatMessage)

  const [inputText, setInputText] = useState('')
  const [messages, setMessages] = useState([])
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamedText])

  const handleSubmit = useCallback(async (text) => {
    const question = (text || inputText).trim()
    if (!question || streaming) return

    setInputText('')

    const userMsg = { role: 'user', content: question, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    appendChatMessage(userMsg)
    reset()

    const aiConfig = getAIConfig()
    // Send last 8 messages as history
    const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }))

    const result = await stream('/api/docker-intelligence/explain', {
      ...aiConfig,
      question,
      dockerfile: dockerfileContent || '',
      history,
    })

    if (result.text && !result.cancelled) {
      const assistantMsg = { role: 'assistant', content: result.text, timestamp: Date.now() }
      setMessages(prev => [...prev, assistantMsg])
      appendChatMessage(assistantMsg)
    }
  }, [inputText, streaming, messages, dockerfileContent, getAIConfig, stream, reset, appendChatMessage])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChipClick = (prompt) => {
    setInputText(prompt)
    handleSubmit(prompt)
  }

  return (
    <div className="flex flex-col h-full bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40 bg-gray-900/80 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs">
            🤖
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-200">Docker AI</h3>
            <p className="text-[9px] text-gray-500">Context-aware assistant</p>
          </div>
        </div>
        {streaming && (
          <button
            onClick={cancel}
            className="text-[10px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
          >
            Stop
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && !streaming && (
          <div className="py-4 text-center">
            <div className="text-3xl mb-2">🐳</div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Ask me anything about your Dockerfile, Docker best practices, or container optimization.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-xl px-3 py-2.5 ${
              msg.role === 'user'
                ? 'bg-indigo-500/20 border border-indigo-500/30 text-gray-200 text-xs'
                : 'bg-gray-800/60 border border-gray-700/40'
            }`}>
              {msg.role === 'user' ? (
                <p className="text-xs text-gray-200">{msg.content}</p>
              ) : (
                <MarkdownRenderer content={msg.content} />
              )}
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {streaming && streamedText && (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-xl px-3 py-2.5 bg-gray-800/60 border border-gray-700/40">
              <MarkdownRenderer content={streamedText} />
              <span className="inline-block w-1.5 h-3 bg-cyan-400 ml-0.5 animate-pulse align-middle" />
            </div>
          </div>
        )}

        {/* Streaming waiting state */}
        {streaming && !streamedText && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3 py-2.5 bg-gray-800/60 border border-gray-700/40">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {streamError && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            ⚠️ {streamError}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length === 0 && !streaming && (
        <div className="px-3 pb-2 flex-shrink-0">
          <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1.5 px-1">Suggested</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleChipClick(prompt)}
                className="text-[10px] px-2.5 py-1.5 rounded-lg bg-gray-800/60 text-gray-400 border border-gray-700/40 hover:bg-gray-700/60 hover:text-gray-200 transition-all text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 flex-shrink-0 border-t border-gray-700/40 pt-3">
        <div className="flex items-end gap-2 bg-gray-800/60 border border-gray-700/40 rounded-xl px-3 py-2 focus-within:border-cyan-500/40 transition-colors">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder="Ask about your Dockerfile..."
            rows={1}
            className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 resize-none outline-none leading-relaxed max-h-24 overflow-y-auto disabled:opacity-50"
            style={{ minHeight: '20px' }}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!inputText.trim() || streaming}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-[9px] text-gray-700 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
