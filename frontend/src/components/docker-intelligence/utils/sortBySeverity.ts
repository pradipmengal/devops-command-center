/**
 * sortBySeverity — pure function that sorts an array of CVE or Finding objects
 * by severity in descending order (Critical → High → Medium → Low).
 *
 * This function is deterministic, non-mutating, and has no side effects.
 *
 * @param {Array<{severity: string}>} items - Array of objects with a `severity` field
 * @returns {Array} New sorted array (original is not mutated)
 */

export const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function sortBySeverity(items) {
  if (!Array.isArray(items)) return []
  return [...items].sort((a, b) => {
    const aOrder = SEVERITY_ORDER[a.severity?.toLowerCase()] ?? 99
    const bOrder = SEVERITY_ORDER[b.severity?.toLowerCase()] ?? 99
    return aOrder - bOrder
  })
}

/**
 * getSeverityColor — returns TailwindCSS color classes for a severity level.
 *
 * @param {string} severity - 'critical' | 'high' | 'medium' | 'low'
 * @returns {{ text: string, bg: string, border: string, badge: string }}
 */
export function getSeverityColor(severity) {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return {
        text: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        badge: 'bg-red-500/20 text-red-300 border border-red-500/30',
        dot: 'bg-red-400',
      }
    case 'high':
      return {
        text: 'text-orange-400',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
        dot: 'bg-orange-400',
      }
    case 'medium':
      return {
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        dot: 'bg-amber-400',
      }
    case 'low':
      return {
        text: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        dot: 'bg-blue-400',
      }
    default:
      return {
        text: 'text-gray-400',
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/30',
        badge: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
        dot: 'bg-gray-400',
      }
  }
}

export default sortBySeverity
