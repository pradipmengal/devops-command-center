import React, { createContext, useContext, useState } from 'react'

const AISettingsContext = createContext(null)

const STORAGE_KEY = 'devops_ai_settings'

export const PROVIDER_GROUPS = [
  {
    group: 'Google Gemini',
    icon: '✨',
    color: 'text-blue-400',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyLabel: 'Get a Gemini API key (free tier available)',
    models: [
      {
        label: 'Gemini 2.0 Flash',
        value: 'gemini-2.0-flash',
        base_url: 'https://generativelanguage.googleapis.com',
        provider: 'gemini',
        badge: 'FAST',
        badgeColor: 'text-blue-400 bg-blue-500/15 border-blue-500/20',
        description: 'Latest, fastest Gemini model',
      },
      {
        label: 'Gemini 2.0 Flash Lite',
        value: 'gemini-2.0-flash-lite',
        base_url: 'https://generativelanguage.googleapis.com',
        provider: 'gemini',
        badge: 'FREE',
        badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
        description: 'Lightweight, very fast, free tier',
      },
      {
        label: 'Gemini 1.5 Pro',
        value: 'gemini-1.5-pro',
        base_url: 'https://generativelanguage.googleapis.com',
        provider: 'gemini',
        badge: 'PRO',
        badgeColor: 'text-violet-400 bg-violet-500/15 border-violet-500/20',
        description: 'Best quality, 2M context window',
      },
      {
        label: 'Gemini 1.5 Flash',
        value: 'gemini-1.5-flash',
        base_url: 'https://generativelanguage.googleapis.com',
        provider: 'gemini',
        badge: 'FREE',
        badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
        description: 'Fast and free tier available',
      },
    ],
  },
  {
    group: 'OpenAI',
    icon: '🤖',
    color: 'text-green-400',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLabel: 'Get an OpenAI API key',
    models: [
      {
        label: 'GPT-4o Mini',
        value: 'gpt-4o-mini',
        base_url: 'https://api.openai.com/v1',
        provider: 'openai',
        badge: 'CHEAP',
        badgeColor: 'text-green-400 bg-green-500/15 border-green-500/20',
        description: 'Fast, cheap, great for most tasks',
      },
      {
        label: 'GPT-4o',
        value: 'gpt-4o',
        base_url: 'https://api.openai.com/v1',
        provider: 'openai',
        badge: 'BEST',
        badgeColor: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
        description: 'Highest quality OpenAI model',
      },
      {
        label: 'GPT-3.5 Turbo',
        value: 'gpt-3.5-turbo',
        base_url: 'https://api.openai.com/v1',
        provider: 'openai',
        badge: null,
        description: 'Legacy, very cheap',
      },
    ],
  },
  {
    group: 'Ollama (Local / Free)',
    icon: '🦙',
    color: 'text-orange-400',
    keyUrl: 'https://ollama.ai',
    keyLabel: 'Install Ollama (free, runs locally)',
    models: [
      {
        label: 'Qwen 2.5 Coder 3B',
        value: 'qwen2.5-coder:3b',
        base_url: 'http://localhost:11434/v1',
        provider: 'ollama',
        badge: 'CODE',
        badgeColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20',
        description: 'Lightweight coding model — already downloaded',
      },
      {
        label: 'Llama 3',
        value: 'llama3',
        base_url: 'http://localhost:11434/v1',
        provider: 'ollama',
        badge: 'FREE',
        badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
        description: "Meta's Llama 3, runs on your machine",
      },
      {
        label: 'Mistral',
        value: 'mistral',
        base_url: 'http://localhost:11434/v1',
        provider: 'ollama',
        badge: 'FREE',
        badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
        description: 'Fast and capable open model',
      },
      {
        label: 'CodeLlama',
        value: 'codellama',
        base_url: 'http://localhost:11434/v1',
        provider: 'ollama',
        badge: 'FREE',
        badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
        description: 'Optimized for code tasks',
      },
    ],
  },
  {
    group: 'OpenCode (Local)',
    icon: '🔮',
    color: 'text-violet-400',
    keyUrl: 'https://opencode.ai',
    keyLabel: 'OpenCode docs',
    models: [
      {
        label: 'OpenCode Default',
        value: 'opencode',
        base_url: 'http://host.docker.internal:4096/v1',
        provider: 'opencode',
        badge: 'LOCAL',
        badgeColor: 'text-violet-400 bg-violet-500/15 border-violet-500/20',
        description: 'Uses your local opencode config — any provider, any model',
      },
    ],
  },
  {
    group: 'Custom',
    icon: '⚙️',
    color: 'text-gray-400',
    keyUrl: null,
    keyLabel: null,
    models: [
      {
        label: 'Custom model',
        value: 'custom',
        base_url: '',
        provider: 'custom',
        badge: null,
        description: 'Any OpenAI-compatible API',
      },
    ],
  },
]

// Flat list for lookups
export const ALL_PRESET_MODELS = PROVIDER_GROUPS.flatMap(g => g.models)

const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'gemini-2.0-flash',
  baseUrl: 'https://generativelanguage.googleapis.com',
  provider: 'gemini',
}

export function AISettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const [modalOpen, setModalOpen] = useState(false)

  const saveSettings = (newSettings) => {
    setSettings(newSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
    setModalOpen(false)
  }

  const clearSettings = () => {
    setSettings(DEFAULT_SETTINGS)
    localStorage.removeItem(STORAGE_KEY)
  }

  // OpenCode and Ollama don't require an API key
  const isConfigured = Boolean(
    settings.model && (
      settings.apiKey ||
      settings.provider === 'ollama' ||
      settings.provider === 'opencode'
    )
  )

  const getAIConfig = () => ({
    api_key: settings.apiKey,
    model: settings.model,
    base_url: settings.baseUrl || 'https://api.openai.com/v1',
    provider: settings.provider || 'openai',
  })

  return (
    <AISettingsContext.Provider value={{
      settings,
      isConfigured,
      modalOpen,
      openModal: () => setModalOpen(true),
      closeModal: () => setModalOpen(false),
      saveSettings,
      clearSettings,
      getAIConfig,
      PROVIDER_GROUPS,
      ALL_PRESET_MODELS,
    }}>
      {children}
    </AISettingsContext.Provider>
  )
}

export function useAISettings() {
  const ctx = useContext(AISettingsContext)
  if (!ctx) throw new Error('useAISettings must be used inside AISettingsProvider')
  return ctx
}
