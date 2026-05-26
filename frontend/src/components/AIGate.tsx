import React from 'react'
import { useAISettings } from '../context/AISettingsContext'

export default function AIGate({ children }) {
  const { isConfigured, openModal, settings } = useAISettings()

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center animate-fade-in">
        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center mb-6 shadow-lg shadow-violet-900/20">
          <span className="text-4xl">🤖</span>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">AI Not Configured</h2>
        <p className="text-gray-400 text-sm max-w-sm leading-relaxed mb-8">
          To use AI features, you need to provide an API key and select a model.
          Your key is stored locally in your browser and never sent to our servers.
        </p>

        {/* What you need */}
        <div className="w-full max-w-sm bg-gray-800/40 border border-gray-700/40 rounded-2xl p-5 mb-6 text-left space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What you need</p>
          {[
            { icon: '✨', title: 'Google Gemini', desc: 'Free tier available — aistudio.google.com', free: true },
            { icon: '🤖', title: 'OpenAI API Key', desc: 'From platform.openai.com/api-keys', free: false },
            { icon: '🦙', title: 'Ollama (local)', desc: 'Free, runs on your machine — ollama.ai', free: true },
            { icon: '🔮', title: 'OpenCode (local)', desc: 'Free, run: opencode serve — opencode.ai', free: true },
          ].map(({ icon, title, desc, free }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-300">{title}</p>
                  {free && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">FREE</span>}
                </div>
                <p className="text-xs text-gray-600">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={openModal}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-900/30 hover:-translate-y-px"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configure AI Settings
        </button>
      </div>
    )
  }

  // Show configured badge + children
  return (
    <div>
      {/* Configured indicator */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-emerald-400 font-medium">
            Using <code className="font-mono">{settings.model}</code>
          </span>
        </div>
        <button
          onClick={openModal}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
          Change settings
        </button>
      </div>
      {children}
    </div>
  )
}
