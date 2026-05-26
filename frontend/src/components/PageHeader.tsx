import React from 'react'

interface PageHeaderProps {
  icon: string;
  title: string;
  description: string;
  badge?: string;
}

export default function PageHeader({ icon, title, description, badge }: PageHeaderProps) {
  return (
    <div className="mb-7 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 shadow-inner-glow">
          <span className="text-xl" aria-hidden="true">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 uppercase tracking-wide">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  )
}
