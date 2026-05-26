/**
 * FinOpsTopNavbar — enterprise top navigation bar.
 * Height: 44px. Contains: logo, global search, command palette trigger,
 * sync status, notifications, AI copilot toggle, user profile.
 */
import React, { useState } from 'react'
import {
  Search, Command, Bell, RefreshCw, Sparkles, ChevronDown,
  Cloud, CheckCircle2, AlertCircle, Loader2, X
} from 'lucide-react'
import useFinOpsStore from '../../store/useFinOpsStore'

const ACCOUNTS = [
  { id: 'prod',    label: 'Production',  provider: 'AWS',   spend: '$12,840/mo' },
  { id: 'staging', label: 'Staging',     provider: 'Azure', spend: '$2,310/mo' },
  { id: 'dev',     label: 'Development', provider: 'GCP',   spend: '$890/mo' },
]

const PROVIDER_DOT = { AWS: '#f97316', Azure: '#3b82f6', GCP: '#22c55e' }

export default function FinOpsTopNavbar() {
  const {
    setCommandPaletteOpen, syncStatus, lastSyncedAt,
    copilotOpen, setCopilotOpen, pushEvent, setSyncStatus, setLastSyncedAt,
  } = useFinOpsStore()

  const [accountOpen, setAccountOpen] = useState(false)
  const [activeAccount, setActiveAccount] = useState(ACCOUNTS[0])
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  const handleSync = async () => {
    setSyncStatus('syncing')
    pushEvent({ type: 'sync', message: 'Syncing cloud pricing data...', status: 'info' })
    await new Promise(r => setTimeout(r, 2200))
    setSyncStatus('idle')
    setLastSyncedAt(new Date().toISOString())
    pushEvent({ type: 'sync', message: 'Sync complete — pricing data updated', status: 'success' })
  }

  return (
    <header
      className="flex-shrink-0 flex items-center gap-3 px-4 border-b border-white/[0.06] z-30"
      style={{ height: 44, background: '#0d1120' }}
    >
      {/* Logo + product name */}
      <div className="flex items-center gap-2.5 flex-shrink-0 mr-2">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <span className="text-white text-[10px] font-black">F</span>
        </div>
        <span className="text-[13px] font-semibold text-white/90 tracking-tight">FinOps</span>
        <span className="text-[10px] text-white/20 font-medium px-1.5 py-0.5 rounded border border-white/10">ENTERPRISE</span>
      </div>

      {/* Global search — triggers command palette */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex items-center gap-2 flex-1 max-w-xs h-7 px-3 rounded-md text-xs text-white/30
          bg-white/[0.04] border border-white/[0.07] hover:border-white/[0.12] hover:text-white/50
          transition-all duration-150 cursor-text"
      >
        <Search className="w-3 h-3 flex-shrink-0" />
        <span className="flex-1 text-left">Search infrastructure, services…</span>
        <kbd className="flex items-center gap-0.5 text-[9px] text-white/20 bg-white/[0.04] px-1 py-0.5 rounded border border-white/[0.06]">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      <div className="flex-1" />

      {/* Cloud account selector */}
      <div className="relative">
        <button
          onClick={() => setAccountOpen(o => !o)}
          className="flex items-center gap-2 h-7 px-2.5 rounded-md text-xs
            bg-white/[0.04] border border-white/[0.07] hover:border-white/[0.12]
            text-white/70 hover:text-white/90 transition-all duration-150"
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: PROVIDER_DOT[activeAccount.provider] }} />
          <span className="font-medium">{activeAccount.label}</span>
          <span className="text-white/30 text-[10px]">{activeAccount.spend}</span>
          <ChevronDown className="w-3 h-3 text-white/30" />
        </button>

        {accountOpen && (
          <div className="absolute top-full right-0 mt-1 w-56 rounded-lg border border-white/[0.08] shadow-2xl z-50 overflow-hidden"
            style={{ background: '#131929' }}>
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Cloud Accounts</p>
            </div>
            {ACCOUNTS.map(acc => (
              <button key={acc.id}
                onClick={() => { setActiveAccount(acc); setAccountOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors
                  ${activeAccount.id === acc.id ? 'bg-indigo-500/10' : ''}`}
              >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PROVIDER_DOT[acc.provider] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/80">{acc.label}</p>
                  <p className="text-[10px] text-white/30">{acc.provider} · {acc.spend}</p>
                </div>
                {activeAccount.id === acc.id && <CheckCircle2 className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sync status */}
      <button
        onClick={handleSync}
        disabled={syncStatus === 'syncing'}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium
          bg-white/[0.04] border border-white/[0.07] hover:border-white/[0.12]
          text-white/50 hover:text-white/80 transition-all duration-150 disabled:opacity-50"
        title="Sync pricing data"
      >
        {syncStatus === 'syncing'
          ? <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
          : <RefreshCw className="w-3 h-3" />
        }
        <span className="hidden sm:inline">
          {syncStatus === 'syncing' ? 'Syncing…' : 'Sync'}
        </span>
      </button>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setNotifOpen(o => !o)}
          className="relative w-7 h-7 rounded-md flex items-center justify-center
            bg-white/[0.04] border border-white/[0.07] hover:border-white/[0.12]
            text-white/50 hover:text-white/80 transition-all duration-150"
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-[8px] font-bold text-black flex items-center justify-center">3</span>
        </button>

        {notifOpen && (
          <div className="absolute top-full right-0 mt-1 w-72 rounded-lg border border-white/[0.08] shadow-2xl z-50 overflow-hidden"
            style={{ background: '#131929' }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Notifications</p>
              <button onClick={() => setNotifOpen(false)} className="text-white/30 hover:text-white/60">
                <X className="w-3 h-3" />
              </button>
            </div>
            {[
              { icon: '⚠️', text: 'Cost spike: CloudWatch Logs +340%', time: '14s ago', color: 'text-amber-400' },
              { icon: '💡', text: '7 optimization recommendations ready', time: '1m ago', color: 'text-indigo-400' },
              { icon: '📊', text: 'Budget 85% reached: Production', time: '3m ago', color: 'text-red-400' },
            ].map((n, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-white/[0.03] border-b border-white/[0.04] last:border-0">
                <span className="text-sm flex-shrink-0 mt-0.5">{n.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-medium ${n.color}`}>{n.text}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Copilot toggle */}
      <button
        onClick={() => setCopilotOpen(!copilotOpen)}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium
          border transition-all duration-150
          ${copilotOpen
            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
            : 'bg-white/[0.04] border-white/[0.07] hover:border-white/[0.12] text-white/50 hover:text-white/80'
          }`}
      >
        <Sparkles className="w-3 h-3" />
        <span className="hidden sm:inline">Copilot</span>
      </button>

      {/* User avatar */}
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 cursor-pointer">
        <span className="text-white text-[10px] font-bold">P</span>
      </div>
    </header>
  )
}
