import React from 'react'
import { useNavigate } from 'react-router-dom'

const TOOLS = [
  { path: '/ssl',       icon: '🔒', label: 'SSL/TLS',      desc: 'Certificate Inspector',    color: 'from-green-500/20 to-emerald-500/10', border: 'border-green-500/20',   tag: 'Infrastructure' },
  { path: '/k8s',       icon: '☸️',  label: 'Kubernetes',  desc: 'YAML Validator',           color: 'from-blue-500/20 to-indigo-500/10',  border: 'border-blue-500/20',    tag: 'Infrastructure' },
  { path: '/cicd',      icon: '🔄', label: 'CI/CD',        desc: 'Pipeline Generator',       color: 'from-indigo-500/20 to-blue-500/10',  border: 'border-indigo-500/20',  tag: 'Infrastructure' },
  { path: '/base64',    icon: '🔐', label: 'Base64',        desc: 'Encoder / Decoder',        color: 'from-violet-500/20 to-purple-500/10',border: 'border-violet-500/20',  tag: 'Security' },
  { path: '/jwt',       icon: '🪙', label: 'JWT',           desc: 'Token Decoder',            color: 'from-purple-500/20 to-pink-500/10',  border: 'border-purple-500/20',  tag: 'Security' },
  { path: '/hash',      icon: '🔑', label: 'Hash',          desc: 'Generator',                color: 'from-pink-500/20 to-rose-500/10',    border: 'border-pink-500/20',    tag: 'Security' },
  { path: '/converter', icon: '🔀', label: 'JSON ↔ YAML',  desc: 'Converter',                color: 'from-emerald-500/20 to-teal-500/10', border: 'border-emerald-500/20', tag: 'Data' },
  { path: '/regex',     icon: '🔍', label: 'Regex',         desc: 'Tester',                   color: 'from-teal-500/20 to-cyan-500/10',    border: 'border-teal-500/20',    tag: 'Data' },
  { path: '/subnet',    icon: '🌐', label: 'Subnet',        desc: 'IP Calculator',            color: 'from-orange-500/20 to-amber-500/10', border: 'border-orange-500/20',  tag: 'Network' },
  { path: '/curl',      icon: '📡', label: 'curl',          desc: 'Command Builder',          color: 'from-amber-500/20 to-yellow-500/10', border: 'border-amber-500/20',   tag: 'Network' },
  { path: '/cron',      icon: '⏰', label: 'Cron',          desc: 'Expression Builder',       color: 'from-rose-500/20 to-pink-500/10',    border: 'border-rose-500/20',    tag: 'Utilities' },
  { path: '/timestamp', icon: '🕐', label: 'Timestamp',     desc: 'Unix Converter',           color: 'from-pink-500/20 to-fuchsia-500/10', border: 'border-pink-500/20',    tag: 'Utilities' },
  { path: '/uuid',      icon: '🆔', label: 'UUID',          desc: 'Generator & Validator',    color: 'from-fuchsia-500/20 to-violet-500/10',border: 'border-fuchsia-500/20', tag: 'Utilities' },
  { path: '/gitignore', icon: '📄', label: '.gitignore',    desc: 'Generator',                color: 'from-gray-500/20 to-slate-500/10',   border: 'border-gray-500/20',    tag: 'Utilities' },
  { path: '/cloud-cost',        icon: '💰', label: 'Cloud Costs',    desc: 'Provider Price Comparison',    color: 'from-cyan-500/20 to-blue-500/10',     border: 'border-cyan-500/20',    tag: 'Infrastructure' },
]

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-5xl animate-fade-in">
      {/* Hero */}
      <div className="mb-10 relative">
        <div className="absolute inset-0 bg-gradient-radial from-indigo-500/5 via-transparent to-transparent rounded-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/50">
              <span className="text-lg">⚙️</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                DevOps <span className="text-gradient">Command Center</span>
              </h1>
              <p className="text-xs text-gray-500">v2.0.0 · 15 tools</p>
            </div>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed max-w-xl">
            A collection of production-ready DevOps utilities — from Dockerfile generation to CI/CD pipelines, JWT decoding, subnet calculation, and more.
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total Tools', value: '15', icon: '🛠️' },
          { label: 'Infrastructure', value: '4', icon: '🏗️' },
          { label: 'Security', value: '3', icon: '🔐' },
          { label: 'Utilities', value: '8', icon: '⚡' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tool grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">All Tools</h2>
        <div className="grid grid-cols-3 gap-3">
          {TOOLS.map(({ path, icon, label, desc, color, border, tag }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`group text-left p-4 rounded-2xl bg-gradient-to-br ${color} border ${border}
                hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20
                active:scale-[0.99] transition-all duration-150 cursor-pointer`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl group-hover:scale-110 transition-transform duration-150" aria-hidden="true">{icon}</span>
                <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider bg-gray-800/60 px-1.5 py-0.5 rounded-full">{tag}</span>
              </div>
              <p className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5 group-hover:text-gray-400 transition-colors">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-8 p-4 rounded-2xl bg-gray-800/30 border border-gray-700/30 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-slow flex-shrink-0" />
        <p className="text-xs text-gray-500">All tools run locally — no data is sent to external servers. Your inputs stay private.</p>
      </div>
    </div>
  )
}
