import React, { useState, useRef, useEffect, useCallback } from 'react'
import PageHeader from '../components/PageHeader'
import AIGate from '../components/AIGate'
import CopyButton from '../components/CopyButton'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { useAISettings } from '../context/AISettingsContext'
import { useAIStream } from '../hooks/useAIStream'

const MODES = [
  {
    id: 'general',
    label: 'General DevOps',
    icon: '💬',
    endpoint: '/api/ai/chat',
    description: 'Docker, K8s, Terraform, CI/CD, cloud, Linux, FinOps',
    suggestions: [
      'What is the difference between CMD and ENTRYPOINT in Docker?',
      'How do I set up a blue-green deployment in Kubernetes?',
      'How can I reduce my AWS EC2 costs?',
      'Compare AWS vs Azure vs GCP compute pricing',
      'What are reserved instances and should I use them?',
      'What is Terraform and how does it work?',
    ],
  },
  {
    id: 'error',
    label: 'Error Explainer',
    icon: '🔎',
    endpoint: '/api/ai/explain-error',
    description: 'Paste any DevOps error for analysis',
    suggestions: [
      'CrashLoopBackOff: pod "api-server-7d8f9" is crashing',
      'MountVolume.SetUp failed for volume "config": permission denied',
      'terraform init: Error refreshing state: HTTP 403 Forbidden',
      'docker build failed with exit code 1: exec format error',
      'Helm install failed: release already exists',
      'kubectl describe pod: ImagePullBackOff: not found',
    ],
  },
]

function Timestamp({ ts }) {
  if (!ts) return null
  const h = ts.getHours().toString().padStart(2, '0')
  const m = ts.getMinutes().toString().padStart(2, '0')
  return <span className="text-[10px] text-gray-600 font-mono">{h}:{m}</span>
}

function MessageBubble({ msg, isLastUser, onEdit, onRegenerate }) {
  const isUser = msg.role === 'user'
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const editRef = useRef(null)

  useEffect(() => {
    if (editing) editRef.current?.focus()
  }, [editing])

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== msg.content) {
      onEdit(editText.trim())
    }
    setEditing(false)
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-in group`}>
      <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-sm ${
        isUser ? 'bg-indigo-600/30 border border-indigo-500/30' : 'bg-violet-600/20 border border-violet-500/20'
      }`}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div className={`max-w-[80%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600/20 border border-indigo-500/20 text-indigo-100 rounded-tr-sm'
            : 'bg-gray-800/60 border border-gray-700/40 text-gray-200 rounded-tl-sm'
        }`}>
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea ref={editRef} value={editText} onChange={e => setEditText(e.target.value)}
                className="w-full bg-gray-900/80 border border-gray-700/60 text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 resize-none"
                rows={3} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() }; if (e.key === 'Escape') setEditing(false) }} />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(false)} className="text-xs px-2.5 py-1 rounded-lg bg-gray-800/60 text-gray-400 hover:text-gray-200 border border-gray-700/40 transition-all">Cancel</button>
                <button onClick={handleSaveEdit} className="text-xs px-2.5 py-1 rounded-lg bg-indigo-600/80 text-white hover:bg-indigo-600 transition-all">Save</button>
              </div>
            </div>
          ) : (
            isUser ? (
              <pre className="whitespace-pre-wrap font-sans break-words">{msg.content}</pre>
            ) : (
              <MarkdownRenderer content={msg.content} />
            )
          )}
        </div>

        {/* Actions row */}
        <div className={`flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <Timestamp ts={msg.timestamp} />
          {!isUser && (
            <>
              <CopyButton text={msg.content} />
              <button onClick={onRegenerate} title="Regenerate response"
                className="text-gray-600 hover:text-cyan-400 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
            </>
          )}
          {isUser && isLastUser && !editing && (
            <button onClick={() => { setEditText(msg.content); setEditing(true) }} title="Edit message"
              className="text-gray-600 hover:text-indigo-400 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StreamingBubble({ streamedText, elapsed, statusMsg, onCancel }) {
  return (
    <div className="flex gap-3 animate-fade-in group">
      <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-sm bg-violet-600/20 border border-violet-500/20">
        🤖
      </div>
      <div className="flex flex-col gap-1.5 max-w-[80%]">
        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-800/60 border border-gray-700/40 text-sm text-gray-200 leading-relaxed">
          {streamedText ? (
            <>
              <MarkdownRenderer content={streamedText} />
              <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />
            </>
          ) : (
            <div className="flex gap-1 items-center h-5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-1">
          <span className={`text-xs font-mono font-semibold tabular-nums ${elapsed < 10 ? 'text-indigo-400' : elapsed < 30 ? 'text-amber-400' : 'text-orange-400'}`}>{elapsed}s</span>
          <span className="text-xs text-gray-600">{statusMsg}</span>
          <button onClick={onCancel} className="ml-auto text-xs text-gray-600 hover:text-red-400 transition-colors flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AiChatPage() {
  const { getAIConfig } = useAISettings()
  const { streaming, streamedText, elapsed, statusMsg, stream, cancel } = useAIStream()

  const [mode, setMode] = useState(MODES[0])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState(null)
  const [waitingForResend, setWaitingForResend] = useState(null)
  const bottomRef = useRef(null)

  const activeMode = MODES.find(m => m.id === mode.id) || MODES[0]

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming, streamedText])

  const sendMessage = useCallback(async (text) => {
    const userMsg = (text || input).trim()
    if (!userMsg || streaming) return

    setInput('')
    setError(null)
    setWaitingForResend(null)
    const historySnapshot = [...messages]
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date() }])

    const payload = activeMode.id === 'error'
      ? { ...getAIConfig(), error_text: userMsg }
      : { ...getAIConfig(), message: userMsg, history: historySnapshot }

    const { text: reply, error: err, cancelled } = await stream(activeMode.endpoint, payload)

    if (cancelled) {
      setMessages(prev => prev.slice(0, -1))
      return
    }
    if (err) {
      setError(err)
      setMessages(prev => prev.slice(0, -1))
    } else if (reply) {
      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }])
    }
  }, [input, streaming, messages, activeMode, getAIConfig, stream])

  const handleRegenerate = useCallback(() => {
    if (messages.length < 2 || streaming) return
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return
    setMessages(prev => prev.slice(0, -1))
    setInput(lastUserMsg.content)
    setTimeout(() => sendMessage(lastUserMsg.content), 0)
  }, [messages, streaming, sendMessage])

  const handleEdit = useCallback((newText) => {
    if (messages.length < 1 || streaming) return
    const lastIdx = messages.length - 1
    if (messages[lastIdx].role !== 'user') return
    setMessages(prev => prev.slice(0, -1))
    setInput(newText)
    setTimeout(() => sendMessage(newText), 0)
  }, [messages, streaming, sendMessage])

  const switchMode = useCallback((newMode) => {
    if (newMode.id === mode.id) return
    setMode(newMode)
    setMessages([])
    setError(null)
    setInput('')
  }, [mode])

  const sendSuggestion = useCallback((q) => {
    setInput(q)
    if (!streaming) setTimeout(() => sendMessage(q), 0)
  }, [streaming, sendMessage])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="max-w-4xl animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <PageHeader icon="💬" title="AI DevOps Chat"
        description="Ask any DevOps question — Docker, Kubernetes, Terraform, CI/CD, cloud, and more."
        badge="AI" />

      <AIGate>
        <div className="flex flex-col flex-1 min-h-0 card overflow-hidden">
          {/* Mode selector */}
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-700/30">
            {MODES.map(m => (
              <button key={m.id} onClick={() => switchMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeMode.id === m.id
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm shadow-indigo-900/20'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 border border-transparent'
                }`}
                title={m.description}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 scroll-smooth">
            {messages.length === 0 && !streaming ? (
              <div className="h-full flex flex-col items-center justify-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                  <span className="text-2xl">{activeMode.icon}</span>
                </div>
                <p className="text-gray-400 text-sm font-medium mb-1">{activeMode.label}</p>
                <p className="text-gray-600 text-xs mb-2">{activeMode.description}</p>
                <p className="text-gray-600 text-xs mb-6">Enter to send, Shift+Enter for new line</p>
                <div className="w-full max-w-md space-y-2">
                  <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold mb-3">Suggested questions</p>
                  {activeMode.suggestions.map(q => (
                    <button key={q} onClick={() => sendSuggestion(q)} disabled={streaming}
                      className="w-full text-left px-4 py-2.5 rounded-xl bg-gray-800/40 border border-gray-700/40 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 disabled:opacity-40 transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg}
                    isLastUser={msg.role === 'user' && i === messages.length - 1}
                    onEdit={handleEdit}
                    onRegenerate={handleRegenerate} />
                ))}

                {streaming && (
                  <StreamingBubble streamedText={streamedText} elapsed={elapsed} statusMsg={statusMsg} onCancel={cancel} />
                )}

                {error && (
                  <div className="px-4 py-3 rounded-xl bg-red-950/30 border border-red-500/20 text-sm text-red-300 flex items-start gap-2">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-700/40 p-4">
            {messages.length > 0 && (
              <div className="flex justify-end mb-2 gap-3">
                <span className="text-[10px] text-gray-600 font-mono">{messages.filter(m => m.role === 'user').length} messages</span>
                <button onClick={() => setMessages([])} disabled={streaming}
                  className="text-xs text-gray-600 hover:text-gray-400 disabled:opacity-40 transition-colors">
                  Clear conversation
                </button>
              </div>
            )}
            <div className="flex gap-3 items-end">
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={`Ask a ${activeMode.label.toLowerCase()} question... (Enter to send)`}
                rows={2} disabled={streaming}
                className="flex-1 bg-gray-900/80 border border-gray-700/60 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 placeholder-gray-600 transition-all resize-none disabled:opacity-60" />
              <button onClick={() => sendMessage()} disabled={!input.trim() || streaming}
                className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-lg shadow-indigo-900/30 hover:-translate-y-px">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </AIGate>
    </div>
  )
}
