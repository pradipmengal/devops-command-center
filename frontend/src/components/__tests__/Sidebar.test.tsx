import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from '../Sidebar'
import { AISettingsProvider } from '../../context/AISettingsContext'

// Wrap with required providers
function renderSidebar() {
  return render(
    <MemoryRouter>
      <AISettingsProvider>
        <Sidebar />
      </AISettingsProvider>
    </MemoryRouter>
  )
}

describe('Sidebar', () => {
  it('renders all five navigation links', () => {
    renderSidebar()
    expect(screen.getByText('Kubernetes')).toBeInTheDocument()
    expect(screen.getByText('Base64')).toBeInTheDocument()
    expect(screen.getByText('Cron')).toBeInTheDocument()
  })

  it('renders the app title', () => {
    renderSidebar()
    expect(screen.getByText('DevOps')).toBeInTheDocument()
    expect(screen.getByText('Command Center')).toBeInTheDocument()
  })

  it('renders AI feature links', () => {
    renderSidebar()
    expect(screen.getByText('Error Explainer')).toBeInTheDocument()
    expect(screen.getByText('Docker Optimizer')).toBeInTheDocument()
    expect(screen.getByText('DevOps Chat')).toBeInTheDocument()
  })

  it('renders Configure AI button when not configured', () => {
    renderSidebar()
    expect(screen.getByText('Configure AI')).toBeInTheDocument()
  })
})
