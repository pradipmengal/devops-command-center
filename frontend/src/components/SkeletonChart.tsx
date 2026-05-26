import React from 'react'

/**
 * SkeletonChart - Animated placeholder for chart containers
 */
export default function SkeletonChart() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="space-y-4">
        <div className="h-4 bg-gray-700/50 rounded w-32" />
        <div className="h-64 bg-gray-700/30 rounded-lg" />
      </div>
    </div>
  )
}
