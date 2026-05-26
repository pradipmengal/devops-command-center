/**
 * Tests for AiDockerPage component.
 *
 * Covers:
 *   - Unit: streaming UI states (Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 5.6)
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

vi.mock('../../context/AISettingsContext', () => ({
  useAISettings: () => ({
    getAIConfig: () => ({ api_key: 'test', model: 'gpt-4o', base_url: 'https://api.openai.com/v1' }),
    settings: { model: 'gpt-4o' },
    isConfigured: true,
    openModal: vi.fn(),
  }),
}))

vi.mock('../../components/AIGate', () => ({
  default: ({ children }) => <div data-testid="ai-gate">{children}</div>,
}))

vi.mock('../../components/AILoadingPanel', () => ({
  default: ({ elapsed, statusMsg, onCancel }) => (
    <div data-testid="ai-loading-panel">
      <span>{statusMsg}</span>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

import AiDockerPage from '../AiDockerPage'

function setStreamState(overrides) {
  mockStreamState = { ...mockStreamState, ...overrides }
}

function renderPage() {
  return render(<AiDockerPage />)
}

// ── Unit: streaming UI states ─────────────────────────────────────────────────
// Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 5.6

describe('AiDockerPage streaming UI states', () => {
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

  it('shows streaming text with blinking cursor when streaming=true and streamedText is non-empty', () => {
    setStreamState({ streaming: true, streamedText: '## Issues Found' })
    renderPage()
    expect(screen.getByText('## Issues Found')).toBeInTheDocument()
    const pre = screen.getByText('## Issues Found').closest('pre')
    expect(pre).not.toBeNull()
    const cursor = pre.querySelector('span.animate-pulse')
    expect(cursor).not.toBeNull()
  })

  it('shows Copy button when streaming=false and finalResult is present', async () => {
    mockStreamFn.mockResolvedValue({ text: '## Optimized Dockerfile', error: null, cancelled: false })
    setStreamState({ streaming: false, streamedText: '' })

    renderPage()

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'FROM node:latest' } })
    fireEvent.click(screen.getByRole('button', { name: /analyze.*optimize/i }))

    await screen.findByRole('button', { name: /copy/i })
  })

  it('shows error panel when error or streamError is set', () => {
    setStreamState({ streaming: false, streamedText: '', streamError: 'Rate limit exceeded' })
    renderPage()
    expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
  })

  it('submit button is re-enabled after an error (retry affordance)', () => {
    setStreamState({ streaming: false, streamedText: '', streamError: 'Something went wrong' })
    renderPage()
    const submitBtn = screen.getByRole('button', { name: /analyze.*optimize/i })
    expect(submitBtn).not.toBeDisabled()
  })

  it('textarea and submit button are disabled while streaming=true', () => {
    setStreamState({ streaming: true, streamedText: '' })
    renderPage()
    const textarea = screen.getByRole('textbox')
    const submitBtn = screen.getByRole('button', { name: /analyzing/i })
    expect(textarea).toBeDisabled()
    expect(submitBtn).toBeDisabled()
  })
})
