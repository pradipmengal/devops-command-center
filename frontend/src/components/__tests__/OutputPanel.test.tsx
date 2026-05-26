import React from 'react'
import { render, screen } from '@testing-library/react'
import OutputPanel from '../OutputPanel'

describe('OutputPanel', () => {
  it('renders loading spinner when loading is true', () => {
    render(<OutputPanel loading={true} content={null} error={null} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders error message when error is set', () => {
    render(<OutputPanel loading={false} content={null} error="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('renders content in pre block when content is set', () => {
    render(<OutputPanel loading={false} content="FROM node:18-alpine" error={null} />)
    expect(screen.getByText('FROM node:18-alpine')).toBeInTheDocument()
  })

  it('renders copy button when content is set', () => {
    render(<OutputPanel loading={false} content="some output" error={null} />)
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })

  it('renders placeholder when all props are null/false', () => {
    render(<OutputPanel loading={false} content={null} error={null} />)
    expect(screen.getByText('Output will appear here')).toBeInTheDocument()
  })
})
