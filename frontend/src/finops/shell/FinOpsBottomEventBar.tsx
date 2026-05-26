/**
 * FinOpsBottomEventBar — live operational event stream.
 * Collapsed: 28px status bar. Expanded: 160px scrollable event log.
 */
import React, { useEffect, useRef } from 'react'
import { ChevronUp, ChevronDown, Activity, Loader2, CheckCircle2, AlertTriangle, Info, Zap } from 'lucide-react'
import useFinOpsStore, { EVENT_TYPES } from '../../store/useFinOpsStore'

const EVENT_ICON = {
  [EVENT_TYPES.SYNC]:     { Icon: Loader2,       color: 'text-indigo-400',  spin: true },
  [EVENT_TYPES.ANOMALY]:  { Icon: AlertTriangle,  color: 'text-amber-400',   spin: false },
  [EVENT_TYPES.BUDGET]:   { Icon: AlertTriangle,  color: 'text-red-400',     spin: false },
  [EVENT_TYPES.OPTIMIZE]: { Icon: Zap,            color: 'text-emerald-400', spin: false },
  [EVENT_TYPES.K8S]:      { Icon: Info,           color: 'text-blue-400',    spin: false },
  [EVENT_TYPES.AI]:       { Icon: CheckCircle2,   color: 'text-violet-400',  spin: false },
  [EVENT_TYPES.DEPLOY]:   { Icon: Activity,       color: 'text-cyan-400',    spin: false },
}

const STATUS_DOT = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error:   'bg-red-400',
  info:    'bg-indigo-400',
}

export default function FinOpsBottomEventBar() {
  const { events, eventBarExpanded, setEventBarExpanded, syncStatus } = useFinOpsStore()
  const scrollRef = useRef(null)

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (scrollRef.current && eventBarExpanded) {
      scrollRef.current.scrollTop = 0
    }
  }, [events.length, eventBarExpanded])

  const latestEvent = events[0]

  return (
    <div
      className="flex-shrink-0 border-t border-white/[0.06] overflow-hidden"
      style={{
        height: eventBarExpanded ? 160 : 28,
        background: '#0a0e1a',
        transition: 'height 0.2s ease',
      }}
    >
      {/* Status bar row */}
      <div className="flex items-center gap-3 px-4 h-7 border-b border-white/[0.04]">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-white/30 font-medium">LIVE</span>
        </div>

        <div className="w-px h-3 bg-white/[0.08]" />

        {/* Latest event */}
        {latestEvent && (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[latestEvent.status] ?? 'bg-white/20'}`} />
            <span className="text-[11px] text-white/40 truncate">{latestEvent.message}</span>
            <span className="text-[10px] text-white/20 flex-shrink-0">{latestEvent.time}</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Sync status */}
        {syncStatus === 'syncing' && (
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
            <span className="text-[10px] text-indigo-400">Syncing…</span>
          </div>
        )}

        {/* Event count */}
        <span className="text-[10px] text-white/20">{events.length} events</span>

        {/* Expand toggle */}
        <button
          onClick={() => setEventBarExpanded(!eventBarExpanded)}
          className="w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
        >
          {eventBarExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded event log */}
      {eventBarExpanded && (
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ height: 132 }}
        >
          {events.map((event) => {
            const cfg = EVENT_ICON[event.type] ?? { Icon: Info, color: 'text-white/40', spin: false }
            const { Icon, color, spin } = cfg
            return (
              <div
                key={event.id}
                className="flex items-center gap-3 px-4 py-1.5 hover:bg-white/[0.02] border-b border-white/[0.03] last:border-0"
              >
                <Icon className={`w-3 h-3 flex-shrink-0 ${color} ${spin ? 'animate-spin' : ''}`} />
                <span className="flex-1 text-[11px] text-white/50 truncate">{event.message}</span>
                <span className="text-[10px] text-white/20 flex-shrink-0 font-mono">{event.time}</span>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[event.status] ?? 'bg-white/10'}`} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
