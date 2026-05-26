import React, { useEffect, useRef, useState } from 'react'

/**
 * useCounterAnimation — counts from 0 to target over ~600ms using rAF.
 */
function useCounterAnimation(target) {
  const [current, setCurrent] = useState(0)
  const rafRef = useRef(null)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) return
    const start = prevTarget.current
    const end = target
    const duration = 600
    const startTime = performance.now()

    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setCurrent(Math.round(start + (end - start) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        prevTarget.current = end
      }
    }

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  return current
}

/**
 * MetricCard — glassmorphism KPI card with animated counter.
 */
export default function MetricCard({
  icon,
  label,
  value,
  subLabel,
  accentColor = 'text-indigo-400',
  compact = false,
}) {
  const isNumeric = typeof value === 'number' && !isNaN(value)
  const animated = useCounterAnimation(isNumeric ? value : 0)
  const displayValue = isNumeric
    ? (value < 1 && value > 0 ? `$${value.toFixed(4)}` : animated)
    : value

  return (
    <div className={`
      group relative rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-md
      hover:border-white/20 hover:scale-105 transition-all duration-200 cursor-default
      shadow-lg hover:shadow-xl
      ${compact ? 'p-3' : 'p-5'}
    `}>
      {/* Subtle glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 pointer-events-none" />

      <div className={`flex items-start justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
        <div className={`rounded-xl bg-gray-800/60 border border-gray-700/40 flex items-center justify-center ${compact ? 'w-7 h-7' : 'w-9 h-9'}`}>
          {icon}
        </div>
      </div>

      <div className={`font-bold font-mono ${accentColor} ${compact ? 'text-xl mb-0.5' : 'text-2xl mb-1'}`}>
        {displayValue}
      </div>

      <div className={`font-semibold text-gray-400 leading-tight ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {label}
      </div>

      {subLabel && (
        <div className="text-[10px] text-gray-600 mt-0.5 truncate">{subLabel}</div>
      )}
    </div>
  )
}
