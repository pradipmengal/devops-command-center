import React from 'react'

/**
 * CloudCostDisclaimer
 *
 * Renders an amber notice bar reminding users that all prices are approximate
 * reference values and should not be used for financial commitments.
 *
 * @param {{ lastUpdated: string }} props - lastUpdated is an ISO date string (e.g. '2025-05-01')
 */
export default function CloudCostDisclaimer({ lastUpdated }) {
  // Format the ISO date string into a human-readable form (e.g. "May 1, 2025")
  const formattedDate = React.useMemo(() => {
    if (!lastUpdated) return lastUpdated
    try {
      return new Date(lastUpdated + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return lastUpdated
    }
  }, [lastUpdated])

  return (
    <div
      role="note"
      aria-label="Pricing disclaimer"
      className="rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-3 mb-5 text-sm"
    >
      <div className="flex items-start gap-2.5">
        <span className="text-base flex-shrink-0 mt-0.5" aria-hidden="true">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium leading-snug">
            All prices are approximate reference values and may differ from current provider
            pricing. Do not use for financial commitments.
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-amber-400/80">
            <span>Last updated: {formattedDate}</span>
            <span className="hidden sm:inline text-amber-500/40">|</span>
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-amber-400/60">Official pricing:</span>
              <a
                href="https://aws.amazon.com/pricing/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-amber-200 transition-colors"
              >
                AWS
              </a>
              <a
                href="https://azure.microsoft.com/en-us/pricing/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-amber-200 transition-colors"
              >
                Azure
              </a>
              <a
                href="https://cloud.google.com/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-amber-200 transition-colors"
              >
                GCP
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
