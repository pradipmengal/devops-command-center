import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CopyButton from '../CopyButton'

describe('CopyButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders with Copy label', () => {
    render(<CopyButton text="hello" />)
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })

  it('calls navigator.clipboard.writeText with the correct text on click', async () => {
    render(<CopyButton text="test content" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test content')
    })
  })

  it('shows Copied! after click', async () => {
    render(<CopyButton text="hello" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument()
    })
  })
})
