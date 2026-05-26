import React from 'react'

const PHASE_ICONS = {
  cloning: '📦',
  detecting: '🔍',
  generating: '⚡',
}

export default function ProgressStream({ steps }) {
  if (!steps || steps.length === 0) return null

  return (
    <div className="rounded-2xl bg-gray-900/80 border border-gray-700/40 overflow-hidden shadow-xl shadow-black/20">
      <div className="px-4 py-3 border-b border-gray-700/40 bg-gray-800/40">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs text-gray-500 font-medium ml-1">Progress</span>
        </div>
      </div>
      <div className="p-4 space-y-2 max-h-[200px] overflow-y-auto">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 text-sm animate-fade-in ${
              step.type === 'error' ? 'text-red-400' :
              step.type === 'done' ? 'text-emerald-400' :
              step.isLatest && !step.done ? 'text-blue-300' : 'text-gray-400'
            }`}
          >
            <span className="flex-shrink-0 mt-0.5">
              {step.type === 'error' ? '❌' :
               step.type === 'done' ? '✅' :
               step.icon || PHASE_ICONS[step.phase] || '•'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{step.message}</span>
                {step.isLatest && !step.done && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                )}
              </div>
              {step.data?.languages && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {step.data.languages.map(lang => (
                    <span key={lang} className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                      {lang}
                    </span>
                  ))}
                  {step.data.frameworks?.map(fw => (
                    <span key={fw} className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                      {fw}
                    </span>
                  ))}
                  {step.data.databases?.map(db => (
                    <span key={db} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">
                      {db}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
