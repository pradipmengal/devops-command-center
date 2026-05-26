import React from 'react'

export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3" role="status" aria-label="Loading">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-400 animate-spin" />
        <div className="absolute inset-1.5 rounded-full border-2 border-transparent border-t-violet-400 animate-spin" style={{ animationDuration: '0.6s', animationDirection: 'reverse' }} />
      </div>
      <p className="text-sm text-gray-500 font-medium">Processing...</p>
    </div>
  )
}
