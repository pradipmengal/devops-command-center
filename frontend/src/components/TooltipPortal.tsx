import React from 'react'
import ReactDOM from 'react-dom'
import { PROVIDER_COLORS } from '../data/cloudCostData'

const TOOLTIP_WIDTH = 240
const TOOLTIP_HEIGHT = 130
const OFFSET = 14

/**
 * TooltipPortal — rich HTML tooltip rendered via React portal into document.body.
 * Clamps position to avoid viewport overflow.
 */
export default function TooltipPortal({ visible, x, y, entry, regionMultiplier = 1 }) {
  if (!visible || !entry) return null

  // Clamp to viewport
  const left = Math.min(x + OFFSET, window.innerWidth - TOOLTIP_WIDTH - 8)
  const top = y + OFFSET + TOOLTIP_HEIGHT > window.innerHeight
    ? y - TOOLTIP_HEIGHT - OFFSET
    : y + OFFSET

  const providerColors = PROVIDER_COLORS[entry.provider] ?? {
    text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30',
  }

  const adjustedPrice = entry.price_usd * regionMultiplier
  const formatPrice = (p) => {
    if (p === 0) return '0.00'
    if (p < 0.0001) return p.toFixed(8)
    if (p < 0.01) return p.toFixed(4)
    return p.toFixed(2)
  }

  return ReactDOM.createPortal(
    <div
      className="fixed z-[9999] pointer-events-none transition-opacity duration-150"
      style={{ left, top, width: TOOLTIP_WIDTH, opacity: visible ? 1 : 0 }}
    >
      <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700/60 rounded-xl shadow-2xl p-3 text-xs">
        <p className="font-semibold text-white leading-tight mb-2 truncate" title={entry.service_name}>
          {entry.service_name}
        </p>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${providerColors.text} ${providerColors.bg} ${providerColors.border}`}>
            {entry.provider}
          </span>
          <span className="text-gray-500 text-[10px]">{entry.tier_label}</span>
        </div>
        <div className="flex items-baseline gap-1 mb-0.5">
          <span className="text-emerald-400 font-bold font-mono">${formatPrice(entry.price_usd)}</span>
          <span className="text-gray-500 text-[10px]">{entry.unit}</span>
        </div>
        {regionMultiplier !== 1 && (
          <div className="flex items-baseline gap-1 mt-1 pt-1 border-t border-gray-700/40">
            <span className="text-cyan-400 font-mono text-[10px]">Adjusted: ${formatPrice(adjustedPrice)}</span>
            <span className="text-gray-600 text-[10px]">({((regionMultiplier - 1) * 100).toFixed(0)}% regional)</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
