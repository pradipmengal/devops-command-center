/**
 * Tests for AiErrorPage component.
 *
 * Covers:
 *   - Property 5: Form Inputs Disabled During Streaming (Requirements 3.5)
 *   - Unit: streaming UI states (Requirements 3.1, 3.2, 3.3, 3.6, 5.4, 5.6)
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import * as fc from 'fast-check'
import { vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock useAIStream with controllable state
const mockStreamFn = vi.fn()
const mockCancel = vi.fn()
const mockReset = vi.fn()

let mockStreamState = {
  streaming: false,
  streamedText: '',
  elapsed: 0,
  statusMsg: '',
  streamError: null,
  firstTokenTime: null,
  stream: mockStreamFn,
  cancel: mockCancel,
  reset: mockReset,
}

vi.mock('../../hooks/useAIStream', () => ({
  useAIStream: () => mockStreamState,
}))

// Mock AISettingsContext
vi.mock('../../context/AISettingsContext', () => ({
  useAISettings: () => ({
    getAIConfig: () => ({ api_key: 'test', model: 'gpt-4o', base_url: 'https://api.openai.com/v1' }),
    settings: { model: 'gpt-4o' },
    isConfigured: true,
    openModal: vi.fn(),
  }),
}))

// Mock AIGate to just render children (bypass the "configure AI" gate)
vi.mock('../../components/AIGate', () => ({
  default: ({ children }) => <div data-testid="ai-gate">{children}</div>,
}))

// Mock AILoadingPanel
vi.mock('../../components/AILoadingPanel', () => ({
  default: ({ elapsed, statusMsg, onCancel }) => (
    <div data-testid="ai-loading-panel">
      <span>{statusMsg}</span>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

import AiErrorPage from '../AiErrorPage'

function setStreamState(overrides) {
  mockStreamState = { ...mockStreamState, ...overrides }
}

function renderPage() {
  return render(<AiErrorPage />)
}

// ── Property 5: Form Inputs Disabled During Streaming ─────────────────────────
// Feature: ai-streaming-response, Property 5: Form Inputs Disabled During Streaming
// Validates: Requirements 3.5

describe('Property 5: Form Inputs Disabled During Streaming', () => {
  it('textarea and submit button are disabled when streaming=true, enabled when false', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isStreaming) => {
          setStreamState({ streaming: isStreaming, streamedText: '' })
          const { unmount } = renderPage()

          const textarea = screen.getByRole('textbox')
          // The submit button text changes when streaming, so query by type
          const submitBtn = document.querySelector('button[type="submit"]')

          if (isStreaming) {
            expect(textarea).toBeDisabled()
            expect(submitBtn).toBeDisabled()
          } else {
            expect(textarea).not.toBeDisabled()
            expect(submitBtn).not.toBeDisabled()
          }

          unmount()
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ── Unit: streaming UI states ─────────────────────────────────────────────────
// Validates: Requirements 3.1, 3.2, 3.3, 3.6, 5.4, 5.6

describe('AiErrorPage streaming UI states', () => {
  beforeEach(() => {
    setStreamState({
      streaming: false,
      streamedText: '',
      elapsed: 0,
      statusMsg: '',
      streamError: null,
      firstTokenTime: null,
    })
    mockStreamFn.mockReset()
    mockReset.mockReset()
  })

  it('shows AILoadingPanel when streaming=true and streamedText is empty', () => {
    setStreamState({ streaming: true, streamedText: '' })
    renderPage()
    expect(screen.getByTestId('ai-loading-panel')).toBeInTheDocument()
  })

  it('does NOT show AILoadingPanel when streaming=false', () => {
    setStreamState({ streaming: false, streamedText: '' })
    renderPage()
    expect(screen.queryByTestId('ai-loading-panel')).not.toBeInTheDocument()
  })

  it('does NOT show AILoadingPanel when streaming=true but streamedText is non-empty', () => {
    setStreamState({ streaming: true, streamedText: 'hello' })
    renderPage()
    expect(screen.queryByTestId('ai-loading-panel')).not.toBeInTheDocument()
  })

  it('shows streaming text with blinking cursor when streaming=true and streamedText is non-empty', () => {
    setStreamState({ streaming: true, streamedText: 'Analyzing your error...' })
    renderPage()
    expect(screen.getByText('Analyzing your error...')).toBeInTheDocument()
    // Cursor is a span with animate-pulse — check it exists in the output area
    const pre = screen.getByText('Analyzing your error...').closest('pre')
    expect(pre).not.toBeNull()
    const cursor = pre.querySelector('span.animate-pulse')
    expect(cursor).not.toBeNull()
  })

  it('shows Copy button when streaming=false and finalResult is present', async () => {
    // Simulate a completed stream: mockStreamFn resolves with text
    mockStreamFn.mockResolvedValue({ text: 'The error means X', error: null, cancelled: false })
    setStreamState({ streaming: false, streamedText: '' })

    renderPage()

    // Fill in the textarea and submit
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'some error' } })
    fireEvent.click(screen.getByRole('button', { name: /explain this error/i }))

    // After stream resolves, finalResult is set — wait for re-render
    await screen.findByRole('button', { name: /copy/i })
  })

  it('shows error panel when streamError is set', async () => {
    // streamError from the hook is shown when a stream fails
    // The page sets local error state from the stream result
    mockStreamFn.mockResolvedValue({ text: null, error: 'Connection refused', cancelled: false })
    setStreamState({ streaming: false, streamedText: '' })

    renderPage()

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'some error' } })
    fireEvent.click(screen.getByRole('button', { name: /explain this error/i }))

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeInTheDocument()
    })
  })

  it('submit button is re-enabled after an error (retry affordance)', async () => {
    mockStreamFn.mockResolvedValue({ text: null, error: 'Something went wrong', cancelled: false })
    setStreamState({ streaming: false, streamedText: '' })

    renderPage()

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'some error' } })
    fireEvent.click(screen.getByRole('button', { name: /explain this error/i }))

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    // After error, submit button should be re-enabled
    const submitBtn = screen.getByRole('button', { name: /explain this error/i })
    expect(submitBtn).not.toBeDisabled()
  })
})
