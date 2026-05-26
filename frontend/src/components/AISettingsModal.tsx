import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useAISettings } from '../context/AISettingsContext'

export default function AISettingsModal() {
  const { settings, modalOpen, closeModal, saveSettings, PROVIDER_GROUPS, ALL_PRESET_MODELS } = useAISettings()

  const [activeGroup, setActiveGroup] = useState('Google Gemini')
  const [selectedModel, setSelectedModel] = useState(settings.model || 'gemini-2.0-flash')
  const [apiKey, setApiKey] = useState(settings.apiKey || '')
  const [customModel, setCustomModel] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [ollamaCustomModel, setOllamaCustomModel] = useState('')
  const [useDockerUrl, setUseDockerUrl] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // Test connection state
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // { ok: bool, message: string, hint?: string }

  // OpenCode status state
  const [opencodeStatus, setOpencodeStatus] = useState(null) // { installed, running, version, detected_url, is_docker }
  const [checkingOpencode, setCheckingOpencode] = useState(false)
  const [opencodeUrl, setOpencodeUrl] = useState('http://localhost:4096') // user-editable URL (no /v1 — backend appends /chat/completions directly)

  useEffect(() => {
    if (!modalOpen) return
    setApiKey(settings.apiKey || '')
    setSelectedModel(settings.model || 'gemini-2.0-flash')
    setTestResult(null)
    setOllamaCustomModel('')

    const preset = ALL_PRESET_MODELS.find(m => m.value === settings.model)
    if (preset) {
      const group = PROVIDER_GROUPS.find(g => g.models.some(m => m.value === settings.model))
      if (group) setActiveGroup(group.group)
    }

    if (!ALL_PRESET_MODELS.find(m => m.value === settings.model)) {
      setActiveGroup('Custom')
      setCustomModel(settings.model || '')
      setCustomBaseUrl(settings.baseUrl || '')
    }

    // Detect if previously saved with Docker URL
    if (settings.baseUrl?.includes('host.docker.internal')) {
      setUseDockerUrl(true)
    }
  }, [modalOpen])

  const currentGroup = PROVIDER_GROUPS.find(g => g.group === activeGroup)
  const selectedPreset = ALL_PRESET_MODELS.find(m => m.value === selectedModel)
  const isCustom = activeGroup === 'Custom'
  const isOllama = selectedPreset?.provider === 'ollama' || activeGroup === 'Ollama (Local / Free)'
  const isOpenCode = activeGroup === 'OpenCode (Local)' || selectedPreset?.provider === 'opencode'

  // Compute the effective base URL (respecting Docker toggle)
  const getEffectiveBaseUrl = () => {
    if (isCustom) return customBaseUrl.trim()
    if (isOpenCode) return opencodeUrl.trim()
    let url = selectedPreset?.base_url || ''
    if (isOllama && useDockerUrl) {
      url = url.replace('localhost', 'host.docker.internal')
               .replace('127.0.0.1', 'host.docker.internal')
    }
    return url
  }

  // Compute the effective model name
  const getEffectiveModel = () => {
    if (isCustom) return customModel.trim()
    if (isOllama && ollamaCustomModel.trim()) return ollamaCustomModel.trim()
    return selectedModel
  }

  const handleGroupChange = (groupName) => {
    setActiveGroup(groupName)
    setTestResult(null)
    const group = PROVIDER_GROUPS.find(g => g.group === groupName)
    if (group && group.models.length > 0 && group.models[0].value !== 'custom') {
      setSelectedModel(group.models[0].value)
    }
    // Auto-check OpenCode status when switching to that tab
    if (groupName === 'OpenCode (Local)') {
      checkOpencodeStatus()
    }
  }

  const checkOpencodeStatus = async () => {
    setCheckingOpencode(true)
    try {
      const { data } = await axios.get('/api/ai/opencode/status')
      setOpencodeStatus(data.data)
      // Auto-apply the detected URL (no /v1 suffix — backend appends /chat/completions directly)
      if (data.data?.detected_url) {
        // detected_url comes back without /v1 from the status endpoint
        setOpencodeUrl(data.data.detected_url.replace(/\/v1\/?$/, ''))
      }
    } catch {
      setOpencodeStatus({ installed: false, running: false, version: null, detected_url: null })
    } finally {
      setCheckingOpencode(false)
    }
  }

  const handleTestConnection = async () => {
    const model = getEffectiveModel()
    const baseUrl = getEffectiveBaseUrl()
    const key = apiKey.trim() || 'ollama'

    if (!model) { setTestResult({ ok: false, message: 'Please enter a model name.' }); return }

    setTesting(true)
    setTestResult(null)

    try {
      const { data } = await axios.post('/api/ai/test-connection', {
        api_key: isOpenCode ? 'opencode' : key,
        model,
        base_url: baseUrl,
        provider: isOpenCode ? 'opencode' : (isOllama ? 'ollama' : (selectedPreset?.provider || 'custom')),
      })

      if (data.status === 'success') {
        setTestResult({ ok: true, message: data.data.message })
      } else {
        setTestResult({
          ok: false,
          message: data.data.message,
          hint: data.data.hint,
        })
        // Auto-suggest Docker URL fix
        if (data.data.hint?.includes('host.docker.internal') && !useDockerUrl && !isOpenCode) {
          setUseDockerUrl(true)
          setTestResult({
            ok: false,
            message: data.data.message,
            hint: data.data.hint + '\n\n⚡ Auto-fix applied: switched to host.docker.internal. Click "Test Connection" again.',
          })
        }
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: 'Could not reach the backend server.',
        hint: 'Make sure the DevOps Command Center backend is running.',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    const model = getEffectiveModel()
    const baseUrl = getEffectiveBaseUrl()
    const provider = isOpenCode ? 'opencode' : (isCustom ? 'custom' : (selectedPreset?.provider || 'openai'))
    // OpenCode and Ollama don't need an API key
    if (!apiKey.trim() && !isOllama && !isOpenCode) return
    if (!model) return
    saveSettings({
      apiKey: isOllama ? (apiKey.trim() || 'ollama') : isOpenCode ? 'opencode' : apiKey.trim(),
      model,
      baseUrl,
      provider,
    })
  }

  const canSave = (isOllama || isOpenCode || apiKey.trim()) && getEffectiveModel()

  if (!modalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />

      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl shadow-black/60 animate-fade-in flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">AI Provider Settings</h2>
              <p className="text-xs text-gray-500">Choose your AI provider and enter your API key</p>
            </div>
          </div>
          <button onClick={closeModal}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Provider tabs */}
          <div className="w-44 flex-shrink-0 border-r border-gray-800 p-3 space-y-1 overflow-y-auto">
            {PROVIDER_GROUPS.map(({ group, icon }) => (
              <button key={group} onClick={() => handleGroupChange(group)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  activeGroup === group
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                    : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                }`}>
                <span className="text-base">{icon}</span>
                <span className="text-xs leading-tight">{group.replace(' (Local / Free)', '')}</span>
              </button>
            ))}
          </div>

          {/* Right panel */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Privacy note */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-300 leading-relaxed">
                Your API key is stored only in your browser's localStorage — never sent to our servers.
              </p>
            </div>

            {/* Model selection */}
            {!isCustom && currentGroup && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Model</label>
                <div className="space-y-2">
                  {currentGroup.models.map(({ value, label, badge, badgeColor, description }) => (
                    <label key={value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedModel === value
                          ? 'bg-indigo-500/10 border-indigo-500/30'
                          : 'border-gray-700/40 hover:border-gray-600/60 hover:bg-gray-800/40'
                      }`}>
                      <input type="radio" name="model" value={value}
                        checked={selectedModel === value}
                        onChange={() => { setSelectedModel(value); setTestResult(null) }}
                        className="accent-indigo-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${selectedModel === value ? 'text-indigo-300' : 'text-gray-300'}`}>
                            {label}
                          </span>
                          {badge && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badgeColor}`}>
                              {badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* OpenCode panel */}
            {isOpenCode && (
              <div className="space-y-3">
                {/* Status card */}
                <div className={`p-4 rounded-xl border space-y-3 ${
                  opencodeStatus?.running
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : opencodeStatus?.installed
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-violet-500/10 border-violet-500/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔮</span>
                      <p className="text-sm font-semibold text-gray-200">OpenCode Status</p>
                    </div>
                    <button
                      onClick={checkOpencodeStatus}
                      disabled={checkingOpencode}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-gray-800/60 text-gray-400 border border-gray-700/40 hover:text-gray-200 transition-all disabled:opacity-50"
                    >
                      {checkingOpencode ? (
                        <span className="flex items-center gap-1">
                          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Checking...
                        </span>
                      ) : '↻ Check'}
                    </button>
                  </div>

                  {opencodeStatus === null && !checkingOpencode && (
                    <p className="text-xs text-gray-500">Click "Check" to auto-detect OpenCode (works with Docker too).</p>
                  )}

                  {opencodeStatus && !checkingOpencode && (
                    <div className="space-y-2">
                      {/* Installed status */}
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400" />
                        <span className="text-xs text-gray-300">
                          CLI runs on host machine
                        </span>
                      </div>

                      {/* Running status */}
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opencodeStatus.running ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                        <span className="text-xs text-gray-300">
                          {opencodeStatus.running
                            ? <>Server running — detected at <code className="text-violet-300 font-mono">{opencodeStatus.detected_url}</code></>
                            : 'Server not running — run: opencode serve'}
                        </span>
                      </div>

                      {/* Docker auto-fix notice */}
                      {opencodeStatus.running && opencodeStatus.is_docker && (
                        <div className="flex items-start gap-2 mt-1 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                          <span className="text-indigo-400 text-xs flex-shrink-0">⚡</span>
                          <p className="text-xs text-indigo-300">
                            Docker detected — auto-switched to <code className="font-mono">host.docker.internal:4096</code>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Server URL field — editable */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Server URL
                    <span className="ml-2 text-gray-600 font-normal">(auto-detected, or edit manually)</span>
                  </label>
                  <input
                    type="text"
                    value={opencodeUrl}
                    onChange={e => { setOpencodeUrl(e.target.value); setTestResult(null) }}
                    placeholder="http://localhost:4096"
                    className="w-full bg-gray-800/60 border border-gray-700/60 text-gray-100 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/60 placeholder-gray-600"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      onClick={() => { setOpencodeUrl('http://localhost:4096'); setTestResult(null) }}
                      className="text-[10px] px-2 py-0.5 rounded bg-gray-800/60 text-gray-500 border border-gray-700/30 hover:text-gray-300 transition-all"
                    >
                      localhost
                    </button>
                    <button
                      onClick={() => { setOpencodeUrl('http://host.docker.internal:4096'); setTestResult(null) }}
                      className="text-[10px] px-2 py-0.5 rounded bg-gray-800/60 text-gray-500 border border-gray-700/30 hover:text-gray-300 transition-all"
                    >
                      Docker
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="p-3 rounded-xl bg-gray-800/40 border border-gray-700/40 space-y-2">
                  <p className="text-xs font-semibold text-gray-300">Setup</p>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">1. Start the server on your host machine:</p>
                    <code className="block text-xs font-mono bg-gray-900/60 text-violet-300 px-3 py-1.5 rounded-lg border border-gray-700/40">
                      opencode serve
                    </code>
                    <p className="text-xs text-gray-500 mt-1.5">2. Click <strong className="text-gray-400">↻ Check</strong> — it auto-detects Docker vs localhost.</p>
                    <p className="text-xs text-gray-500">3. Click <strong className="text-gray-400">Test Connection</strong> then <strong className="text-gray-400">Save</strong>.</p>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">No API key needed — OpenCode uses your local provider config.</p>
                </div>
              </div>
            )}

            {/* Ollama: custom model name override */}
            {isOllama && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Custom Model Name
                  <span className="ml-2 text-xs text-gray-600 font-normal">(override preset above)</span>
                </label>
                <input
                  type="text"
                  value={ollamaCustomModel}
                  onChange={e => { setOllamaCustomModel(e.target.value); setTestResult(null) }}
                  placeholder="e.g. qwen2.5-coder:3b, phi3, gemma2:9b"
                  className="w-full bg-gray-800/60 border border-gray-700/60 text-gray-100 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/60 placeholder-gray-600"
                />
                <p className="mt-1 text-xs text-gray-600">
                  Active model: <code className="text-indigo-400">{getEffectiveModel() || '—'}</code>
                </p>
              </div>
            )}

            {/* Ollama: Docker URL toggle */}
            {isOllama && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🦙</span>
                    <p className="text-xs font-semibold text-orange-300">Ollama Connection</p>
                  </div>
                  <p className="text-xs text-orange-400/80">
                    Make sure Ollama is running: <code className="font-mono bg-orange-900/30 px-1 rounded">ollama serve</code>
                  </p>
                  <p className="text-xs text-orange-400/80">
                    Model must be pulled: <code className="font-mono bg-orange-900/30 px-1 rounded">ollama pull {getEffectiveModel()}</code>
                  </p>
                </div>

                {/* Docker URL toggle */}
                <div className="p-3 rounded-xl bg-gray-800/40 border border-gray-700/40">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                      useDockerUrl ? 'bg-indigo-600 border-indigo-500' : 'border-gray-600'
                    }`} onClick={() => { setUseDockerUrl(d => !d); setTestResult(null) }}>
                      {useDockerUrl && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                      <input type="checkbox" checked={useDockerUrl} onChange={() => { setUseDockerUrl(d => !d); setTestResult(null) }} className="sr-only" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-300">Running inside Docker?</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Uses <code className="text-indigo-400 font-mono">host.docker.internal:11434</code> instead of <code className="text-gray-500 font-mono">localhost:11434</code>
                      </p>
                    </div>
                  </label>
                  <div className="mt-2 px-7">
                    <p className="text-[10px] text-gray-600 font-mono">
                      Active URL: {getEffectiveBaseUrl()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Custom model fields */}
            {isCustom && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Model Name</label>
                  <input type="text" value={customModel} onChange={e => { setCustomModel(e.target.value); setTestResult(null) }}
                    placeholder="gpt-4o, qwen2.5-coder:3b, claude-3-5-sonnet..."
                    className="w-full bg-gray-800/60 border border-gray-700/60 text-gray-100 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/60 placeholder-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">API Base URL</label>
                  <input type="text" value={customBaseUrl} onChange={e => { setCustomBaseUrl(e.target.value); setTestResult(null) }}
                    placeholder="http://localhost:11434/v1 or https://api.openai.com/v1"
                    className="w-full bg-gray-800/60 border border-gray-700/60 text-gray-100 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/60 placeholder-gray-600" />
                  <p className="mt-1.5 text-xs text-gray-600">Any OpenAI-compatible API endpoint</p>
                </div>
              </div>
            )}

            {/* API Key — hidden for OpenCode */}
            {!isOpenCode && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">
                  API Key
                  {isOllama && <span className="ml-2 text-xs text-gray-600 font-normal">(optional for Ollama)</span>}
                </label>
                {currentGroup?.keyUrl && (
                  <a href={currentGroup.keyUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                    {currentGroup.keyLabel || 'Get API key'} →
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setTestResult(null) }}
                  placeholder={
                    isOllama ? 'ollama (or leave blank)' :
                    activeGroup === 'Google Gemini' ? 'AIza...' :
                    'sk-...'
                  }
                  className="w-full bg-gray-800/60 border border-gray-700/60 text-gray-100 rounded-xl px-4 py-2.5 pr-12 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/60 placeholder-gray-600"
                />
                <button type="button" onClick={() => setShowKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showKey ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            )}

            {/* Test connection result */}
            {testResult && (
              <div className={`p-4 rounded-xl border animate-fade-in ${
                testResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <div className="flex items-start gap-2.5">
                  <span className="text-base flex-shrink-0">{testResult.ok ? '✅' : '❌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${testResult.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                      {testResult.message}
                    </p>
                    {testResult.hint && (
                      <p className="text-xs text-red-400/80 mt-2 leading-relaxed whitespace-pre-wrap">
                        💡 {testResult.hint}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-800 flex-shrink-0">
          <button onClick={handleTestConnection} disabled={testing || !getEffectiveModel()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-800/60 border border-gray-700/40 text-gray-300 hover:bg-gray-700/60 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {testing ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Testing...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                Test Connection
              </>
            )}
          </button>

          <div className="flex gap-2">
            <button onClick={closeModal}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-all">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!canSave}
              className="px-6 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-indigo-900/30">
              Save & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
