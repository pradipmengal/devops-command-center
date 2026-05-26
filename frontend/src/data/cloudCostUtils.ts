/**
 * Cloud Cost Comparison — Pure Utility Functions
 *
 * All functions are pure (no side effects, no DOM access) so they can be
 * tested in isolation without rendering any React components.
 */

import { PRICE_DATASET, PROVIDER_COLORS } from './cloudCostData.js'

/**
 * Derive the ordered list of all unique categories from PRICE_DATASET,
 * preserving the insertion order of the first occurrence of each category.
 *
 * @type {string[]}
 */
export const ALL_CATEGORIES = Array.from(
  new Set(PRICE_DATASET.map((e) => e.category))
)

/**
 * Filter dataset entries by the selected categories and active providers.
 *
 * @param {object[]} dataset   - Array of ServiceEntry objects to filter.
 * @param {string[]} categories - Categories to include.
 * @param {string[]} providers  - Providers to include ('AWS', 'Azure', 'GCP').
 * @returns {object[]} Entries whose category AND provider are in the given sets.
 */
export function filterEntries(dataset, categories, providers) {
  return dataset.filter(
    (entry) =>
      categories.includes(entry.category) && providers.includes(entry.provider)
  )
}

/**
 * Sort an array of ServiceEntry objects by a given key in ascending or
 * descending order.  Handles both string and numeric comparisons correctly.
 *
 * The original array is NOT mutated — a new sorted array is returned.
 *
 * @param {object[]} entries - Array of ServiceEntry objects.
 * @param {string}   key     - Field name to sort by.
 * @param {'asc'|'desc'} dir - Sort direction.
 * @returns {object[]} New sorted array.
 */
export function sortEntries(entries, key, dir) {
  return [...entries].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]

    let cmp
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      cmp = aVal - bVal
    } else {
      // String comparison (locale-aware, case-insensitive)
      cmp = String(aVal).localeCompare(String(bVal), undefined, {
        sensitivity: 'base',
      })
    }

    return dir === 'desc' ? -cmp : cmp
  })
}

/**
 * Find the entry with the lowest price_usd in a group of ServiceEntry objects.
 *
 * @param {object[]} entries - Non-empty array of ServiceEntry objects.
 * @returns {object} The entry with the minimum price_usd value.
 * @throws {Error} If entries is empty.
 */
export function findLowestInGroup(entries) {
  if (!entries || entries.length === 0) {
    throw new Error('findLowestInGroup requires a non-empty array')
  }
  return entries.reduce((lowest, entry) =>
    entry.price_usd < lowest.price_usd ? entry : lowest
  )
}

/**
 * Build bar groups for the SVG chart.
 *
 * Returns one group per selected category.  Each group contains exactly one
 * bar per active provider.  If no dataset entry exists for a (category,
 * provider) pair, the bar is represented with `hasData: false` and
 * `price_usd: 0` so the chart can render a zero-height placeholder.
 *
 * @param {object[]} dataset    - Full PRICE_DATASET (or any subset).
 * @param {string[]} categories - Ordered list of categories to include.
 * @param {string[]} providers  - Ordered list of providers to include.
 * @returns {{ category: string, bars: { provider: string, price_usd: number, hasData: boolean }[] }[]}
 */
export function buildBarGroups(dataset, categories, providers) {
  return categories.map((category) => {
    const bars = providers.map((provider) => {
      const entry = dataset.find(
        (e) => e.category === category && e.provider === provider
      )
      return entry
        ? { provider, price_usd: entry.price_usd, hasData: true }
        : { provider, price_usd: 0, hasData: false }
    })
    return { category, bars }
  })
}

/**
 * Get the provider color object from PROVIDER_COLORS.
 *
 * @param {'AWS'|'Azure'|'GCP'} provider - Provider identifier.
 * @returns {{ bar: string, text: string, bg: string, border: string }}
 *   Color object for the provider, or a neutral fallback for unknown providers.
 */
export function getProviderColor(provider) {
  return (
    PROVIDER_COLORS[provider] ?? {
      bar: '#6b7280',
      text: 'text-gray-400',
      bg: 'bg-gray-500/15',
      border: 'border-gray-500/30',
    }
  )
}

// ── FinOps Dashboard Utilities ────────────────────────────────────────────────
// New exports added for the FinOps Dashboard enhancement.
// Existing exports above are NOT modified.

/**
 * Region configuration with price multipliers.
 */
export const REGIONS = {
  'us-east':  { label: 'US East',      multiplier: 1.00 },
  'us-west':  { label: 'US West',      multiplier: 1.05 },
  'eu-west':  { label: 'EU West',      multiplier: 1.12 },
  'asia-pac': { label: 'Asia Pacific', multiplier: 1.18 },
}

/**
 * Filter entries by a case-insensitive search query.
 * Matches against service_name, category, and tier_label.
 * Returns all entries unchanged when query is empty.
 *
 * @param {object[]} entries - Array of ServiceEntry objects.
 * @param {string} query - Search query string.
 * @returns {object[]} Filtered entries.
 */
export function applySearchFilter(entries, query) {
  if (!query || query.trim() === '') return entries
  const q = query.toLowerCase()
  return entries.filter(
    (e) =>
      (e.service_name && e.service_name.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.tier_label && e.tier_label.toLowerCase().includes(q))
  )
}

/**
 * Apply a region price multiplier to all entries.
 * Returns new entry objects with adjusted price_usd values.
 * Original entries are NOT mutated.
 *
 * @param {object[]} entries - Array of ServiceEntry objects.
 * @param {number} multiplier - Price multiplier to apply.
 * @returns {object[]} New entries with scaled price_usd.
 */
export function applyRegionMultiplier(entries, multiplier) {
  if (multiplier === 1) return entries
  return entries.map((e) => ({ ...e, price_usd: e.price_usd * multiplier }))
}

/**
 * Compute dashboard KPI metrics from a filtered entry set.
 *
 * @param {object[]} entries - Array of ServiceEntry objects.
 * @returns {{ totalServices: number, cheapestProvider: string, mostExpensiveCategory: string, avgMonthlyCost: number, anomalyCount: number }}
 */
export function computeMetrics(entries) {
  if (!entries || entries.length === 0) {
    return {
      totalServices: 0,
      cheapestProvider: '—',
      mostExpensiveCategory: '—',
      avgMonthlyCost: 0,
      anomalyCount: 0,
    }
  }

  const totalServices = entries.length

  // Cheapest provider: provider with lowest average price
  const providerTotals = {}
  const providerCounts = {}
  for (const e of entries) {
    providerTotals[e.provider] = (providerTotals[e.provider] || 0) + e.price_usd
    providerCounts[e.provider] = (providerCounts[e.provider] || 0) + 1
  }
  let cheapestProvider = '—'
  let lowestAvg = Infinity
  for (const [provider, total] of Object.entries(providerTotals)) {
    const avg = total / providerCounts[provider]
    if (avg < lowestAvg) {
      lowestAvg = avg
      cheapestProvider = provider
    }
  }

  // Most expensive category: category with highest total price
  const categoryTotals = {}
  for (const e of entries) {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.price_usd
  }
  let mostExpensiveCategory = '—'
  let highestTotal = -Infinity
  for (const [cat, total] of Object.entries(categoryTotals)) {
    if (total > highestTotal) {
      highestTotal = total
      mostExpensiveCategory = cat
    }
  }

  // Average monthly cost
  const avgMonthlyCost = entries.reduce((sum, e) => sum + e.price_usd, 0) / entries.length

  // Anomaly count
  const anomalySet = detectAnomalies(entries)
  const anomalyCount = anomalySet.size

  return {
    totalServices,
    cheapestProvider,
    mostExpensiveCategory,
    avgMonthlyCost,
    anomalyCount,
  }
}

/**
 * Detect statistical anomalies: entries whose price_usd is more than
 * 2 standard deviations above the mean for their category.
 * Categories with fewer than 2 entries are skipped.
 *
 * @param {object[]} entries - Array of ServiceEntry objects.
 * @returns {Set<object>} Set of anomalous ServiceEntry references.
 */
export function detectAnomalies(entries) {
  const anomalySet = new Set()
  if (!entries || entries.length === 0) return anomalySet

  // Group by category
  const byCategory = {}
  for (const e of entries) {
    if (!byCategory[e.category]) byCategory[e.category] = []
    byCategory[e.category].push(e)
  }

  for (const group of Object.values(byCategory)) {
    if (group.length < 2) continue

    const prices = group.map((e) => e.price_usd)
    const mean = prices.reduce((s, p) => s + p, 0) / prices.length
    const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length
    const stdDev = Math.sqrt(variance)

    const threshold = mean + 2 * stdDev
    for (const e of group) {
      if (e.price_usd > threshold) {
        anomalySet.add(e)
      }
    }
  }

  return anomalySet
}

/**
 * Compute top-N savings opportunities by comparing the most expensive
 * and cheapest active providers per category.
 *
 * @param {object[]} entries - Array of ServiceEntry objects.
 * @param {number} topN - Maximum number of opportunities to return.
 * @returns {object[]} Array of SavingsOpportunity objects.
 */
export function computeSavings(entries, topN = 5) {
  if (!entries || entries.length === 0) return []

  // Check distinct providers
  const providers = new Set(entries.map((e) => e.provider))
  if (providers.size < 2) return []

  // Group by category
  const byCategory = {}
  for (const e of entries) {
    if (!byCategory[e.category]) byCategory[e.category] = []
    byCategory[e.category].push(e)
  }

  const opportunities = []
  for (const [category, group] of Object.entries(byCategory)) {
    if (group.length < 2) continue

    // Find most expensive and cheapest
    let expensive = group[0]
    let cheap = group[0]
    for (const e of group) {
      if (e.price_usd > expensive.price_usd) expensive = e
      if (e.price_usd < cheap.price_usd) cheap = e
    }

    if (expensive === cheap || expensive.price_usd <= cheap.price_usd) continue

    const savingsAmount = expensive.price_usd - cheap.price_usd
    const savingsPercent = (savingsAmount / expensive.price_usd) * 100

    opportunities.push({
      category,
      expensiveProvider: expensive.provider,
      expensivePrice: expensive.price_usd,
      cheapProvider: cheap.provider,
      cheapPrice: cheap.price_usd,
      savingsAmount,
      savingsPercent,
    })
  }

  // Sort by savingsAmount descending
  opportunities.sort((a, b) => b.savingsAmount - a.savingsAmount)

  return opportunities.slice(0, topN)
}

/**
 * Return the top-N entries sorted by price_usd descending.
 *
 * @param {object[]} entries - Array of ServiceEntry objects.
 * @param {number} topN - Maximum number of entries to return.
 * @returns {object[]} Top entries sorted by price descending.
 */
export function buildLeaderboard(entries, topN = 10) {
  if (!entries || entries.length === 0) return []
  const sorted = [...entries].sort((a, b) => b.price_usd - a.price_usd)
  return sorted.slice(0, topN)
}

/**
 * Compute the linear forecast for the next N periods using least-squares regression.
 *
 * @param {number[]} values - Historical values array.
 * @param {number} periods - Number of periods to forecast.
 * @returns {number[]} Forecasted values.
 */
export function linearForecast(values, periods) {
  if (!values || values.length === 0) return Array(periods).fill(0)
  if (values.length === 1) return Array(periods).fill(values[0])

  const n = values.length
  const xMean = (n - 1) / 2
  const yMean = values.reduce((s, v) => s + v, 0) / n

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean)
    denominator += (i - xMean) ** 2
  }

  const slope = denominator !== 0 ? numerator / denominator : 0
  const intercept = yMean - slope * xMean

  return Array.from({ length: periods }, (_, i) => {
    const x = n + i
    return Math.max(0, intercept + slope * x)
  })
}

/**
 * Generate a deterministic time-series trend from the filtered entries.
 *
 * @param {object[]} entries - Array of ServiceEntry objects.
 * @param {'daily'|'weekly'|'monthly'} granularity - Time granularity.
 * @param {number} historicalPeriods - Number of historical periods.
 * @param {number} forecastPeriods - Number of forecast periods.
 * @returns {{ historical: object[], forecast: object[] }}
 */
export function generateTrendData(entries, granularity, historicalPeriods = 12, forecastPeriods = 3) {
  const baseline = entries && entries.length > 0
    ? entries.reduce((sum, e) => sum + e.price_usd, 0)
    : 0

  // Generate historical points with deterministic sinusoidal variation
  const historical = Array.from({ length: historicalPeriods }, (_, i) => {
    const variation = Math.sin(i * 0.7) * 0.08 * baseline
    const value = Math.max(0, baseline + variation)
    return {
      label: _generateLabel(granularity, i),
      value,
      isForecast: false,
    }
  })

  // Generate forecast using linear regression on historical values
  const historicalValues = historical.map((p) => p.value)
  const forecastValues = linearForecast(historicalValues, forecastPeriods)

  const forecast = forecastValues.map((value, i) => ({
    label: _generateLabel(granularity, historicalPeriods + i),
    value: Math.max(0, value),
    isForecast: true,
  }))

  return { historical, forecast }
}

/**
 * Generate a label for a time period based on granularity.
 * @private
 */
function _generateLabel(granularity, index) {
  if (granularity === 'monthly') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months[index % 12]
  }
  if (granularity === 'weekly') {
    return `W${index + 1}`
  }
  // daily
  return `Day ${index + 1}`
}

/**
 * Generate a CSV string from filtered entries with region-adjusted prices.
 *
 * @param {object[]} entries - Array of ServiceEntry objects.
 * @param {string} regionLabel - Region label string.
 * @param {number} regionMultiplier - Region price multiplier.
 * @returns {string} CSV string.
 */
export function generateCSV(entries, regionLabel, regionMultiplier) {
  const header = 'Category,Service Name,Provider,Price (USD),Unit,Tier,Region,Adjusted Price (USD)'
  const rows = entries.map((e) => {
    const adjustedPrice = (e.price_usd * regionMultiplier).toFixed(6)
    // Escape fields that may contain commas
    const escape = (v) => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }
    return [
      escape(e.category),
      escape(e.service_name),
      escape(e.provider),
      e.price_usd,
      escape(e.unit),
      escape(e.tier_label),
      escape(regionLabel),
      adjustedPrice,
    ].join(',')
  })
  return [header, ...rows].join('\n')
}
