import React from 'react'

/**
 * AILoadingPanel — shown while waiting for a local/slow AI model.
 * Displays elapsed time, rotating status message, TTFT badge, and a cancel button.
 */
export default function AILoadingPanel({ elapsed, statusMsg, onCancel, modelName, firstTokenTime }) {
  const isSlowModel = elapsed >= 5
  const ttftSec = firstTokenTime != null ? (firstTokenTime / 1000).toFixed(1) : null

  return (
    <div className="mt-5 rounded-2xl bg-gray-800/40 border border-gray-700/40 p-6 animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-400 animate-spin" />
          <div className="absolute inset-1.5 rounded-full border-2 border-transparent border-t-indigo-400 animate-spin"
            style={{ animationDuration: '0.7s', animationDirection: 'reverse' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg">🤖</span>
          </div>
        </div>

        {/* Status message */}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-300 transition-all" key={statusMsg}>
            {statusMsg}
          </p>
          {modelName && (
            <p className="text-xs text-gray-600 mt-1">
              Model: <code className="text-indigo-400 font-mono">{modelName}</code>
            </p>
          )}
        </div>

        {/* Elapsed timer + TTFT badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${elapsed < 10 ? 'bg-indigo-400' : elapsed < 30 ? 'bg-amber-400' : 'bg-orange-400'}`} />
            <span className={`text-sm font-mono font-semibold tabular-nums ${
              elapsed < 10 ? 'text-indigo-400' : elapsed < 30 ? 'text-amber-400' : 'text-orange-400'
            }`}>
              {elapsed}s
            </span>
            <span className="text-xs text-gray-600">elapsed</span>
          </div>

          {/* TTFT badge — appears once first token arrives */}
          {ttftSec && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 animate-fade-in">
              first token: {ttftSec}s
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs bg-gray-700/40 rounded-full h-1 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              elapsed < 10 ? 'bg-indigo-500' : elapsed < 30 ? 'bg-amber-500' : 'bg-orange-500'
            }`}
            style={{
              width: `${Math.min(95, (elapsed / 60) * 100)}%`,
            }}
          />
        </div>

        {/* Slow model hint */}
        {isSlowModel && (
          <p className="text-xs text-gray-600 text-center max-w-xs animate-fade-in">
            {elapsed < 20
              ? 'Local models take longer than cloud APIs — this is normal.'
              : elapsed < 45
              ? `Still generating... ${modelName || 'the model'} is processing your request.`
              : 'Taking longer than usual. The model may be under load.'}
          </p>
        )}

        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-gray-700/60 border border-gray-600/40 text-gray-400 hover:bg-red-900/30 hover:border-red-500/30 hover:text-red-300 transition-all"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel request
          </button>
        )}
      </div>
    </div>
  )
}
