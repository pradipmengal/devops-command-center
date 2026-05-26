import React from 'react'
import { BarChart2, Layers } from 'lucide-react'

/**
 * GranularViewToggle — two-tab strip switching between Summary and Detail views.
 */
export default function GranularViewToggle({ granularMode, onToggle, catalogLoading }) {
  return (
    <div className="flex items-center gap-1 bg-gray-900/60 border border-gray-700/40 rounded-xl p-1 w-fit">
      <button
        onClick={() => onToggle(false)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
          ${!granularMode
            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            : 'text-gray-500 hover:text-gray-300'
          }`}
      >
        <BarChart2 className="w-3.5 h-3.5" />
        Summary
      </button>
      <button
        onClick={() => onToggle(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
          ${granularMode
            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            : 'text-gray-500 hover:text-gray-300'
          }`}
      >
        <Layers className="w-3.5 h-3.5" />
        Detail
        {catalogLoading && granularMode && (
          <div className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin ml-1" />
        )}
      </button>
    </div>
  )
}
