/**
 * getScoreColor — pure function that maps a numeric score (0–100) to a
 * TailwindCSS text color class.
 *
 * > 80  → text-emerald-400 (good)
 * 50–80 → text-amber-400   (warning)
 * < 50  → text-red-400     (critical)
 *
 * This function is deterministic and has no side effects.
 *
 * @param {number} score - Integer or float in range [0, 100]
 * @returns {string} TailwindCSS text color class
 */
export function getScoreColor(score) {
  if (score > 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

/**
 * getScoreBgColor — returns a background color class for the same thresholds.
 * Useful for card backgrounds and badges.
 *
 * @param {number} score
 * @returns {string} TailwindCSS bg color class
 */
export function getScoreBgColor(score) {
  if (score > 80) return 'bg-emerald-500/10 border-emerald-500/20'
  if (score >= 50) return 'bg-amber-500/10 border-amber-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

/**
 * getScoreGlow — returns a glow/shadow class for animated metric cards.
 *
 * @param {number} score
 * @returns {string} TailwindCSS shadow class
 */
export function getScoreGlow(score) {
  if (score > 80) return 'shadow-emerald-500/20'
  if (score >= 50) return 'shadow-amber-500/20'
  return 'shadow-red-500/20'
}

export default getScoreColor
