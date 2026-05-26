import React, { useState, useRef, useEffect } from 'react'
import { LayoutGrid, Minimize2, Download, RefreshCw, X, Filter, CheckCircle, MessageSquare } from 'lucide-react'

/**
 * FinOpsDashboardHeader — top bar with mode toggle, export, sync, chat, and filter controls.
 */
export default function FinOpsDashboardHeader({
  dashboardMode,
  onModeToggle,
  activeFilterCount = 0,
  onExport,
  onResetFilters,
  onSyncPrices,
  isSyncing = false,
  lastSyncedAt = null,
  chatPanelOpen = false,
  onChatToggle,
}) {
  const [exportOpen, setExportOpen] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)
  const exportRef = useRef(null)

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSync = async () => {
    await onSyncPrices?.()
    setSyncSuccess(true)
    setTimeout(() => setSyncSuccess(false), 3000)
  }

  const handleExport = (format) => {
    setExportOpen(false)
    onExport?.(format)
  }

  const formatSyncTime = (iso) => {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { return null }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      {/* Left: title + sync status */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {syncSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg animate-fade-in">
              <CheckCircle className="w-3 h-3" />
              Prices updated
            </span>
          )}
          {lastSyncedAt && !syncSuccess && (
            <span className="text-[10px] text-gray-600">
              Synced {formatSyncTime(lastSyncedAt)}
            </span>
          )}
        </div>

        {/* Active filter badge */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400">
            <Filter className="w-3 h-3" />
            {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            <button
              onClick={onResetFilters}
              className="ml-1 hover:text-white transition-colors"
              title="Reset all filters"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2">
        {/* Chat Toggle */}
        <button
          onClick={onChatToggle}
          aria-expanded={chatPanelOpen}
          aria-controls="cost-chat-panel"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
            border transition-all duration-200
            ${chatPanelOpen
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
              : 'bg-gray-800/60 text-gray-300 border-gray-700/40 hover:bg-gray-700/60 hover:text-white'
            }`}
          title="Toggle cost analysis chat"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Cost Chat
        </button>

        {/* Sync Prices */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
            bg-cyan-500/10 text-cyan-400 border border-cyan-500/20
            hover:bg-cyan-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Fetch latest prices from cloud providers"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing…' : 'Sync Prices'}
        </button>

        {/* Export dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
              bg-gray-800/60 text-gray-300 border border-gray-700/40
              hover:bg-gray-700/60 hover:text-white transition-all duration-200"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-36 bg-gray-900/95 backdrop-blur border border-gray-700/60 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
              <button
                onClick={() => handleExport('csv')}
                className="w-full text-left px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-800/60 hover:text-white transition-colors"
              >
                📄 Export CSV
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="w-full text-left px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-800/60 hover:text-white transition-colors border-t border-gray-800/60"
              >
                🖨️ Print / PDF
              </button>
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <button
          onClick={onModeToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
            bg-gray-800/60 text-gray-300 border border-gray-700/40
            hover:bg-gray-700/60 hover:text-white transition-all duration-200"
          title={dashboardMode === 'expanded' ? 'Switch to compact mode' : 'Switch to expanded mode'}
        >
          {dashboardMode === 'expanded'
            ? <><Minimize2 className="w-3.5 h-3.5" /> Compact</>
            : <><LayoutGrid className="w-3.5 h-3.5" /> Expanded</>
          }
        </button>
      </div>
    </div>
  )
}
