import React, { useState, useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAISettings } from '../context/AISettingsContext'

const PRIMARY_TOOLS = [
  { path: '/ai-chat',              label: 'DevOps Chat',      icon: '💬', description: 'Ask AI anything' },
  { path: '/ai-optimization',      label: 'AI Optimization',  icon: '🧠', description: 'FinOps, Logs & IaC Review' },
  { path: '/docker-intelligence',  label: 'Docker Intelligence', icon: '🐳', description: 'AI Docker Cockpit' },
  { path: '/containerize',         label: 'Containerize',    icon: '🚀', description: 'AI App → Docker + K8s + Helm' },
  { path: '/multi-cloud',          label: 'Multi-Cloud AI',  icon: '🌐', description: 'Cost Intelligence Platform' },
  { path: '/terraform-builder',    label: 'Terraform Builder', icon: '🏗️', description: 'Visual Infrastructure Designer' },
]

const OTHER_GROUPS = [
  {
    group: '✨ AI Features',
    color: 'from-violet-400 to-fuchsia-400',
    tools: [
      { path: '/ai-error',  label: 'Error Explainer', icon: '🔎', description: 'AI-powered debug help' },
      { path: '/ai-docker', label: 'Docker Optimizer', icon: '🐳', description: 'AI Dockerfile review' },
    ],
  },
  {
    group: 'Infrastructure',
    color: 'from-blue-500 to-cyan-500',
    tools: [
      { path: '/ssl',         label: 'SSL/TLS',    icon: '🔒', description: 'Certificate Inspector' },
      { path: '/k8s',         label: 'Kubernetes',  icon: '☸️',  description: 'YAML Validator' },
      { path: '/cicd',        label: 'CI/CD',       icon: '🔄', description: 'Pipeline Generator' },
      { path: '/cloud-cost',  label: 'Cloud Costs', icon: '💰', description: 'Provider Price Comparison' },
    ],
  },
  {
    group: 'Security',
    color: 'from-violet-500 to-purple-500',
    tools: [
      { path: '/base64', label: 'Base64', icon: '🔐', description: 'Encoder / Decoder' },
      { path: '/jwt',    label: 'JWT',    icon: '🪙', description: 'Token Decoder' },
      { path: '/hash',   label: 'Hash',   icon: '🔑', description: 'Generator' },
    ],
  },
  {
    group: 'Data & Format',
    color: 'from-emerald-500 to-teal-500',
    tools: [
      { path: '/converter', label: 'JSON ↔ YAML', icon: '🔀', description: 'Converter' },
      { path: '/regex',     label: 'Regex',        icon: '🔍', description: 'Tester' },
    ],
  },
  {
    group: 'Network',
    color: 'from-orange-500 to-amber-500',
    tools: [
      { path: '/subnet', label: 'Subnet', icon: '🌐', description: 'IP Calculator' },
      { path: '/curl',   label: 'curl',   icon: '📡', description: 'Command Builder' },
    ],
  },
  {
    group: 'Utilities',
    color: 'from-pink-500 to-rose-500',
    tools: [
      { path: '/cron',      label: 'Cron',       icon: '⏰', description: 'Expression Builder' },
      { path: '/timestamp', label: 'Timestamp',  icon: '🕐', description: 'Unix Converter' },
      { path: '/uuid',      label: 'UUID',        icon: '🆔', description: 'Generator & Validator' },
      { path: '/gitignore', label: '.gitignore',  icon: '📄', description: 'Generator' },
    ],
  },
]

const ALL_TOOLS = [...PRIMARY_TOOLS, ...OTHER_GROUPS.flatMap(g => g.tools)]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [otherOpen, setOtherOpen] = useState(false)
  const location = useLocation()
  const activeTool = ALL_TOOLS.find(t => t.path === location.pathname)
  const { isConfigured, openModal } = useAISettings()

  const isInOther = OTHER_GROUPS.some(g => g.tools.some(t => t.path === location.pathname))

  useEffect(() => {
    if (isInOther) setOtherOpen(true)
  }, [location.pathname])

  return (
    <aside
      className={`flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out
        bg-gray-950 border-r border-gray-800/60
        ${collapsed ? 'w-[60px]' : 'w-[240px]'}`}
      style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.4)' }}
    >
      {/* Logo — click to go home */}
      <div className={`flex items-center border-b border-gray-800/60 h-16 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2.5 flex-1 min-w-0 group" title="Go to Home">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-900/50 group-hover:scale-105 transition-transform duration-150">
              <span className="text-sm">⚙️</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-tight tracking-tight group-hover:text-indigo-300 transition-colors">DevOps</p>
              <p className="text-xs font-medium text-indigo-400 leading-tight">Command Center</p>
            </div>
          </Link>
        )}
        {collapsed && (
          <Link to="/" title="Go to Home" className="group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/50 group-hover:scale-105 transition-transform duration-150">
              <span className="text-sm">⚙️</span>
            </div>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center
            text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all duration-150
            ${collapsed ? 'absolute right-2 top-5' : ''}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Active tool badge */}
      {!collapsed && activeTool && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <p className="text-xs text-indigo-400 font-medium truncate">
            {activeTool.icon} {activeTool.label}
          </p>
          <p className="text-xs text-gray-500 truncate">{activeTool.description}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4" aria-label="Tools">
        {/* Primary tools */}
        <div className="space-y-0.5">
          {PRIMARY_TOOLS.map(({ path, label, icon, description }) => (
            <NavLink key={path} to={path}
              title={collapsed ? `${label} — ${description}` : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl transition-all duration-150 relative
                ${collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2.5'}
                ${isActive ? 'bg-indigo-500/15 text-indigo-300' : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-full" />}
                  <span className={`text-base leading-none flex-shrink-0 transition-transform duration-150 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>{icon}</span>
                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold leading-tight ${isActive ? 'text-indigo-300' : ''}`}>{label}</p>
                      <p className="text-[10px] text-gray-600 leading-tight truncate group-hover:text-gray-500 transition-colors">{description}</p>
                    </div>
                  )}
                  {!collapsed && isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Other Tools dropdown */}
        {!collapsed && (
          <div>
            <button onClick={() => setOtherOpen(o => !o)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all
                ${isInOther ? 'text-indigo-300 bg-indigo-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'}`}
            >
              <span className="text-base">📦</span>
              <span className="flex-1 text-left">Other Tools</span>
              <svg className={`w-3 h-3 transition-transform duration-200 ${otherOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {otherOpen && (
              <div className="mt-2 space-y-4 pl-2 border-l border-gray-800/60 ml-3">
                {OTHER_GROUPS.map(({ group, color, tools }) => (
                  <div key={group}>
                    <div className="flex items-center gap-2 px-2 mb-1.5">
                      <div className={`h-px flex-1 bg-gradient-to-r ${color} opacity-30`} />
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">{group}</p>
                      <div className={`h-px flex-1 bg-gradient-to-l ${color} opacity-30`} />
                    </div>
                    <div className="space-y-0.5">
                      {tools.map(({ path, label, icon, description }) => (
                        <NavLink key={path} to={path}
                          className={({ isActive }) =>
                            `group flex items-center gap-3 rounded-xl transition-all duration-150 relative px-3 py-2
                            ${isActive ? 'bg-indigo-500/15 text-indigo-300' : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'}`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-full" />}
                              <span className={`text-base leading-none flex-shrink-0 transition-transform duration-150 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>{icon}</span>
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-semibold leading-tight ${isActive ? 'text-indigo-300' : ''}`}>{label}</p>
                                <p className="text-[10px] text-gray-600 leading-tight truncate group-hover:text-gray-500 transition-colors">{description}</p>
                              </div>
                              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />}
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsed: show a minimal items list instead */}
        {collapsed && (
          <div className="space-y-0.5">
            {OTHER_GROUPS.flatMap(g => g.tools).map(({ path, label, icon }) => (
              <NavLink key={path} to={path} title={label}
                className={({ isActive }) =>
                  `group flex items-center justify-center rounded-xl transition-all duration-150 px-0 py-2.5 mx-1
                  ${isActive ? 'bg-indigo-500/15 text-indigo-300' : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'}`
                }
              >
                <span className="text-base leading-none flex-shrink-0">{icon}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-800/60 space-y-2">
          <button
            onClick={openModal}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isConfigured
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15'
                : 'bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/15'
            }`}
          >
            <span>{isConfigured ? '🤖' : '⚙️'}</span>
            <span>{isConfigured ? 'AI Configured' : 'Configure AI'}</span>
            {!isConfigured && <span className="ml-auto text-[9px] bg-violet-500/20 px-1.5 py-0.5 rounded-full">Setup</span>}
          </button>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-600 font-medium">v2.0.0</p>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-slow" title="All systems operational" />
          </div>
        </div>
      )}
    </aside>
  )
}