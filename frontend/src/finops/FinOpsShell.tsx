/**
 * FinOpsShell — enterprise platform shell.
 * Full-screen layout: TopNavbar + LeftSidebar + CenterWorkspace + RightCopilot + BottomEventBar
 */
import React, { useEffect, useCallback } from 'react'
import useFinOpsStore from '../store/useFinOpsStore'
import FinOpsTopNavbar from './shell/FinOpsTopNavbar'
import FinOpsLeftSidebar from './shell/FinOpsLeftSidebar'
import FinOpsRightCopilot from './shell/FinOpsRightCopilot'
import FinOpsBottomEventBar from './shell/FinOpsBottomEventBar'
import FinOpsCommandPalette from './shell/FinOpsCommandPalette'
import FinOpsWorkspace from './workspace/FinOpsWorkspace'

export default function FinOpsShell() {
  const { commandPaletteOpen, setCommandPaletteOpen, copilotOpen, copilotWidth, sidebarCollapsed } = useFinOpsStore()

  // Global Ctrl+K handler
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      setCommandPaletteOpen(true)
    }
    if (e.key === 'Escape' && commandPaletteOpen) {
      setCommandPaletteOpen(false)
    }
  }, [commandPaletteOpen, setCommandPaletteOpen])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const sidebarW = sidebarCollapsed ? 52 : 220

  return (
    <div
      className="flex flex-col h-screen overflow-hidden select-none"
      style={{ background: '#0b0f1a', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* ── Top Navbar ── */}
      <FinOpsTopNavbar />

      {/* ── Body row: sidebar + workspace + copilot ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <FinOpsLeftSidebar />

        {/* Center workspace */}
        <main
          className="flex-1 min-w-0 overflow-hidden flex flex-col"
          style={{ transition: 'margin 0.2s ease' }}
        >
          <FinOpsWorkspace />
        </main>

        {/* Right copilot panel */}
        {copilotOpen && (
          <div
            className="flex-shrink-0 border-l border-white/[0.06] overflow-hidden"
            style={{ width: copilotWidth, transition: 'width 0.2s ease' }}
          >
            <FinOpsRightCopilot />
          </div>
        )}
      </div>

      {/* ── Bottom event bar ── */}
      <FinOpsBottomEventBar />

      {/* ── Command palette overlay ── */}
      {commandPaletteOpen && <FinOpsCommandPalette />}
    </div>
  )
}
