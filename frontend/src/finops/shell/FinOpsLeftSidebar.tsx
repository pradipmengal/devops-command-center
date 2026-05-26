/**
 * FinOpsLeftSidebar — collapsible enterprise navigation sidebar.
 * Width: 220px expanded, 52px collapsed.
 */
import React from 'react'
import {
  LayoutDashboard, Boxes, Container, Cloud, Zap, TrendingUp,
  AlertTriangle, Sparkles, Shield, FileBarChart, Settings,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import useFinOpsStore, { NAV_ITEMS, NAV_GROUPS } from '../../store/useFinOpsStore'

const ICON_MAP = {
  LayoutDashboard, Boxes, Container, Cloud, Zap, TrendingUp,
  AlertTriangle, Sparkles, Shield, FileBarChart, Settings,
}

const HEALTH_SCORE = 74

export default function FinOpsLeftSidebar() {
  const { activeView, setActiveView, sidebarCollapsed, toggleSidebar } = useFinOpsStore()
  const collapsed = sidebarCollapsed

  return (
    <aside
      className="flex-shrink-0 flex flex-col border-r border-white/[0.06] overflow-hidden relative"
      style={{
        width: collapsed ? 52 : 220,
        background: '#0d1120',
        transition: 'width 0.2s ease',
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-5 z-10 w-6 h-6 rounded-full border border-white/[0.1]
          bg-[#131929] flex items-center justify-center text-white/40 hover:text-white/80
          hover:border-white/[0.2] transition-all duration-150 shadow-lg"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* FinOps Health Score */}
      {!collapsed && (
        <div className="mx-3 mt-3 mb-2 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">FinOps Score</span>
            <span className="text-[10px] text-white/30">/ 100</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-white/90 leading-none">{HEALTH_SCORE}</span>
            <div className="flex-1 mb-1">
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${HEALTH_SCORE}%`,
                    background: HEALTH_SCORE >= 80 ? '#22c55e' : HEALTH_SCORE >= 60 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-amber-400/80 mt-1">↑ 3pts from last week</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-0.5 px-2">
        {NAV_GROUPS.map(group => {
          const groupItems = NAV_ITEMS.filter(i => i.group === group.id)
          return (
            <div key={group.id} className="mb-1">
              {!collapsed && (
                <p className="text-[9px] text-white/20 uppercase tracking-widest font-semibold px-2 py-1.5">
                  {group.label}
                </p>
              )}
              {groupItems.map(item => {
                const Icon = ICON_MAP[item.icon]
                const isActive = activeView === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 rounded-md transition-all duration-150
                      ${collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-2'}
                      ${isActive
                        ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent'
                      }`}
                  >
                    {Icon && <Icon className={`flex-shrink-0 ${collapsed ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />}
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left text-[12px] font-medium truncate">{item.label}</span>
                        {item.badge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
                            ${item.badge === 'NEW'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Bottom: total spend summary */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">Total Spend</p>
          <p className="text-lg font-black text-white/90">$16,040</p>
          <p className="text-[10px] text-white/30">/ month · all accounts</p>
          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[10px] text-red-400">↑ 8.2%</span>
            <span className="text-[10px] text-white/25">vs last month</span>
          </div>
        </div>
      )}
    </aside>
  )
}
