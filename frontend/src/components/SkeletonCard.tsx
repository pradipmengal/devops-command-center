import React from 'react'

/**
 * SkeletonCard — animated pulse placeholder for metric cards.
 */
export function SkeletonCard({ compact = false }) {
  return (
    <div className={`rounded-2xl border border-gray-700/40 bg-gray-800/40 animate-pulse ${compact ? 'p-3' : 'p-5'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gray-700/60" />
        <div className="h-3 w-24 rounded bg-gray-700/60" />
      </div>
      <div className="h-7 w-20 rounded bg-gray-700/60 mb-2" />
      <div className="h-2.5 w-32 rounded bg-gray-700/40" />
    </div>
  )
}

/**
 * SkeletonChart — animated pulse placeholder for chart containers.
 */
export function SkeletonChart({ height = 320 }) {
  return (
    <div
      className="rounded-2xl border border-gray-700/40 bg-gray-800/40 animate-pulse flex flex-col gap-3 p-5"
      style={{ height }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-3 w-32 rounded bg-gray-700/60" />
        <div className="ml-auto flex gap-2">
          <div className="h-6 w-14 rounded-lg bg-gray-700/40" />
          <div className="h-6 w-14 rounded-lg bg-gray-700/40" />
          <div className="h-6 w-14 rounded-lg bg-gray-700/40" />
        </div>
      </div>
      <div className="flex-1 rounded-xl bg-gray-700/30" />
      <div className="flex gap-4 justify-center">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gray-700/60" />
            <div className="h-2.5 w-12 rounded bg-gray-700/40" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default SkeletonCard
