/**
 * Tests for AILoadingPanel component.
 *
 * Covers:
 *   - Property 6: Elapsed Time Color Thresholds (Requirements 6.3, 6.4)
 *   - Property 7: Progress Bar Proportionality (Requirements 6.5)
 *   - Unit: display states (Requirements 6.1, 3.2)
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import * as fc from 'fast-check'
import AILoadingPanel from '../AILoadingPanel'

// ── Property 6: Elapsed Time Color Thresholds ─────────────────────────────────
// Feature: ai-streaming-response, Property 6: Elapsed Time Color Thresholds
// Validates: Requirements 6.3, 6.4

describe('Property 6: Elapsed Time Color Thresholds', () => {
  it('elapsed indicator uses correct color class for all time ranges', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120 }),
        (t) => {
          const { container, unmount } = render(
            <AILoadingPanel elapsed={t} statusMsg="Testing..." />
          )

          // The elapsed timer span has the color class
          const timerSpan = container.querySelector('span.font-mono.font-semibold')
          expect(timerSpan).not.toBeNull()

          const classList = timerSpan.className
          if (t < 10) {
            expect(classList).toContain('text-indigo-400')
            expect(classList).not.toContain('text-amber-400')
            expect(classList).not.toContain('text-orange-400')
          } else if (t < 30) {
            expect(classList).toContain('text-amber-400')
            expect(classList).not.toContain('text-indigo-400')
            expect(classList).not.toContain('text-orange-400')
          } else {
            expect(classList).toContain('text-orange-400')
            expect(classList).not.toContain('text-indigo-400')
            expect(classList).not.toContain('text-amber-400')
          }

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 7: Progress Bar Proportionality ──────────────────────────────────
// Feature: ai-streaming-response, Property 7: Progress Bar Proportionality
// Validates: Requirements 6.5

describe('Property 7: Progress Bar Proportionality', () => {
  it('progress bar width equals min(95, (elapsed/60)*100)%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120 }),
        (t) => {
          const { container, unmount } = render(
            <AILoadingPanel elapsed={t} statusMsg="Testing..." />
          )

          // The progress bar inner div has an inline style width
          const progressInner = container.querySelector('[style*="width"]')
          expect(progressInner).not.toBeNull()

          const expectedWidth = `${Math.min(95, (t / 60) * 100)}%`
          expect(progressInner.style.width).toBe(expectedWidth)

          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Unit: display states ──────────────────────────────────────────────────────
// Validates: Requirements 6.1, 3.2

describe('AILoadingPanel display states', () => {
  it('TTFT badge is not rendered when firstTokenTime is null', () => {
    render(<AILoadingPanel elapsed={5} statusMsg="Waiting..." firstTokenTime={null} />)
    expect(screen.queryByText(/first token/i)).not.toBeInTheDocument()
  })

  it('TTFT badge renders correctly when firstTokenTime is provided', () => {
    render(<AILoadingPanel elapsed={5} statusMsg="Waiting..." firstTokenTime={1200} />)
    expect(screen.getByText(/first token: 1\.2s/i)).toBeInTheDocument()
  })

  it('TTFT badge renders for 0ms firstTokenTime', () => {
    render(<AILoadingPanel elapsed={1} statusMsg="Waiting..." firstTokenTime={500} />)
    expect(screen.getByText(/first token: 0\.5s/i)).toBeInTheDocument()
  })

  it('Cancel button calls onCancel when clicked', () => {
    const onCancel = vi.fn()
    render(<AILoadingPanel elapsed={3} statusMsg="Waiting..." onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Cancel button is not rendered when onCancel is not provided', () => {
    render(<AILoadingPanel elapsed={3} statusMsg="Waiting..." />)
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  it('slow model hint appears when elapsed >= 5', () => {
    render(<AILoadingPanel elapsed={5} statusMsg="Waiting..." />)
    // The hint text contains "Local models" or similar
    expect(screen.getByText(/local models/i)).toBeInTheDocument()
  })

  it('slow model hint is not shown when elapsed < 5', () => {
    render(<AILoadingPanel elapsed={4} statusMsg="Waiting..." />)
    expect(screen.queryByText(/local models/i)).not.toBeInTheDocument()
  })

  it('displays the status message', () => {
    render(<AILoadingPanel elapsed={2} statusMsg="Connecting to model..." />)
    expect(screen.getByText('Connecting to model...')).toBeInTheDocument()
  })

  it('displays the model name when provided', () => {
    render(<AILoadingPanel elapsed={2} statusMsg="Waiting..." modelName="qwen2.5-coder:3b" />)
    expect(screen.getByText('qwen2.5-coder:3b')).toBeInTheDocument()
  })
})
