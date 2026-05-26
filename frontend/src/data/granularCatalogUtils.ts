/**
 * Granular Cloud Pricing — Pure Utility Functions
 *
 * All functions are pure (no side effects, no DOM access, no React imports).
 * Safe to use in useMemo, unit tests, and property-based tests.
 */

/**
 * Filter InstanceEntry records by hardware specs and category/provider.
 * An entry must satisfy ALL active criteria to be included.
 * Returns a new array — input is not mutated.
 *
 * @param {object[]} entries - Array of InstanceEntry objects.
 * @param {object} filters - ServiceConfiguratorFilters object.
 * @returns {object[]} Filtered entries (subset of input).
 */
export function filterInstancesBySpecs(entries, filters) {
  if (!entries || entries.length === 0) return []
  if (!filters) return entries

  return entries.filter((e) => {
    // Category filter
    if (filters.category && e.category !== filters.category) return false

    // Provider filter
    if (filters.providers && filters.providers.length > 0) {
      if (!filters.providers.includes(e.provider)) return false
    }

    // vCPU range
    if (filters.vcpuMin !== null && filters.vcpuMin !== undefined) {
      if (e.vcpu < filters.vcpuMin) return false
    }
    if (filters.vcpuMax !== null && filters.vcpuMax !== undefined) {
      if (e.vcpu > filters.vcpuMax) return false
    }

    // Memory range (GB)
    if (filters.memoryMin !== null && filters.memoryMin !== undefined) {
      if (e.memory_gb < filters.memoryMin) return false
    }
    if (filters.memoryMax !== null && filters.memoryMax !== undefined) {
      if (e.memory_gb > filters.memoryMax) return false
    }

    // Instance family prefix (case-insensitive)
    if (filters.familyPrefix && filters.familyPrefix.trim() !== '') {
      const prefix = filters.familyPrefix.toLowerCase()
      if (!e.instance_type.toLowerCase().startsWith(prefix)) return false
    }

    return true
  })
}

/**
 * Compute price efficiency metrics for an InstanceEntry.
 * Guards against division by zero.
 *
 * @param {object} entry - InstanceEntry object.
 * @returns {{ pricePerVcpu: number, pricePerGbRam: number }}
 */
export function computePriceEfficiency(entry) {
  return {
    pricePerVcpu: entry.vcpu > 0 ? entry.price_usd / entry.vcpu : 0,
    pricePerGbRam: entry.memory_gb > 0 ? entry.price_usd / entry.memory_gb : 0,
  }
}

/**
 * Find the closest matching InstanceEntry from each other provider
 * using Euclidean distance in (vCPU, memory_gb) space.
 *
 * @param {object} entry - The reference InstanceEntry.
 * @param {object[]} catalog - Full catalog of InstanceEntry objects.
 * @returns {Record<string, object>} Object keyed by provider name.
 */
export function findEquivalentInstances(entry, catalog) {
  if (!catalog || catalog.length === 0) return {}

  // Group catalog by provider, excluding entry's own provider
  const byProvider = {}
  for (const e of catalog) {
    if (e.provider === entry.provider) continue
    if (!byProvider[e.provider]) byProvider[e.provider] = []
    byProvider[e.provider].push(e)
  }

  const result = {}
  for (const [provider, candidates] of Object.entries(byProvider)) {
    let best = null
    let bestDist = Infinity

    for (const candidate of candidates) {
      const dist = Math.sqrt(
        (entry.vcpu - candidate.vcpu) ** 2 +
        (entry.memory_gb - candidate.memory_gb) ** 2
      )
      if (dist < bestDist) {
        bestDist = dist
        best = candidate
      }
    }

    if (best) result[provider] = best
  }

  return result
}

/**
 * Compute monthly cost estimates for an InstanceEntry.
 *
 * @param {object} entry - InstanceEntry object.
 * @param {number} hoursPerMonth - Hours of usage per month (1–730).
 * @param {number} instanceCount - Number of instances.
 * @returns {{ onDemand: number, reserved: number, spot: number }}
 */
export function computeMonthlyCost(entry, hoursPerMonth, instanceCount) {
  const onDemand = entry.price_usd * hoursPerMonth * instanceCount
  return {
    onDemand,
    reserved: onDemand * 0.60,  // ~40% savings
    spot: onDemand * 0.30,       // ~70% savings
  }
}

/**
 * Sort InstanceEntry records by a given key in ascending or descending order.
 * Handles computed keys (pricePerVcpu, pricePerGbRam) by calling computePriceEfficiency.
 * Returns a new sorted array — input is not mutated.
 *
 * @param {object[]} entries - Array of InstanceEntry objects.
 * @param {string} key - Sort key.
 * @param {'asc'|'desc'} dir - Sort direction.
 * @returns {object[]} New sorted array.
 */
export function sortInstanceEntries(entries, key, dir) {
  if (!entries || entries.length === 0) return []

  return [...entries].sort((a, b) => {
    let aVal, bVal

    if (key === 'pricePerVcpu') {
      aVal = computePriceEfficiency(a).pricePerVcpu
      bVal = computePriceEfficiency(b).pricePerVcpu
    } else if (key === 'pricePerGbRam') {
      aVal = computePriceEfficiency(a).pricePerGbRam
      bVal = computePriceEfficiency(b).pricePerGbRam
    } else if (key === 'instance_type') {
      aVal = a.instance_type
      bVal = b.instance_type
    } else {
      aVal = a[key]
      bVal = b[key]
    }

    let cmp
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      cmp = aVal - bVal
    } else {
      cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' })
    }

    return dir === 'desc' ? -cmp : cmp
  })
}

/**
 * Get all unique categories from a catalog.
 * @param {object[]} catalog
 * @returns {string[]}
 */
export function getCatalogCategories(catalog) {
  if (!catalog) return []
  return [...new Set(catalog.map((e) => e.category))].sort()
}

/**
 * Get all unique instance families (prefix before first dot or dash) from entries.
 * @param {object[]} entries
 * @returns {string[]}
 */
export function getInstanceFamilies(entries) {
  if (!entries) return []
  const families = new Set()
  for (const e of entries) {
    // AWS: t3.medium → t3, m5.xlarge → m5
    // Azure: D4s v3 → D4s, B2ms → B2ms (no dot)
    // GCP: n2-standard-4 → n2
    const dotIdx = e.instance_type.indexOf('.')
    const dashIdx = e.instance_type.indexOf('-')
    let family
    if (dotIdx > 0) {
      family = e.instance_type.slice(0, dotIdx)
    } else if (dashIdx > 0) {
      family = e.instance_type.slice(0, dashIdx)
    } else {
      family = e.instance_type
    }
    families.add(family)
  }
  return [...families].sort()
}

/**
 * Default filters object.
 */
export const DEFAULT_INSTANCE_FILTERS = {
  category: 'Compute (VMs)',
  providers: ['AWS', 'Azure', 'GCP'],
  vcpuMin: null,
  vcpuMax: null,
  memoryMin: null,
  memoryMax: null,
  familyPrefix: '',
}
