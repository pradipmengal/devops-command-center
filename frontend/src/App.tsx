import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import AISettingsModal from './components/AISettingsModal'
import HomePage from './pages/HomePage'

// Original tools
import K8sPage       from './pages/K8sPage'
import Base64Page    from './pages/Base64Page'
import CronPage      from './pages/CronPage'

// New tools
import JwtPage       from './pages/JwtPage'
import HashPage      from './pages/HashPage'
import ConverterPage from './pages/ConverterPage'
import RegexPage     from './pages/RegexPage'
import TimestampPage from './pages/TimestampPage'
import SubnetPage    from './pages/SubnetPage'
import GitignorePage from './pages/GitignorePage'
import CurlPage      from './pages/CurlPage'
import UuidPage      from './pages/UuidPage'
import CicdPage      from './pages/CicdPage'

// AI tools
import AiErrorPage   from './pages/AiErrorPage'
import AiDockerPage  from './pages/AiDockerPage'
import AiChatPage    from './pages/AiChatPage'
import AIOptimizationCenter from './pages/AIOptimizationCenter'

// Cloud tools
import CloudCostPage from './pages/CloudCostPage'

// Docker Intelligence Center
import DockerIntelligencePage from './pages/DockerIntelligencePage'

// Multi-Cloud Cost Intelligence Platform
import MultiCloudDashboard from './pages/MultiCloudDashboard'

// Application Containerization Suite
import ContainerizePage from './pages/ContainerizePage'

// SSL/TLS Certificate Inspector
import SslPage from './pages/SslPage'

// Terraform Visual Builder
import TerraformBuilderPage from './pages/TerraformBuilderPage'

/**
 * MainLayout — the standard app shell with sidebar + top bar.
 * All regular tools render inside this layout.
 */
function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0f1a 0%, #0f172a 50%, #0d1424 100%)' }}>
      {/* Ambient background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-80 h-80 bg-violet-600/4 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-blue-600/3 rounded-full blur-3xl" />
      </div>

      {/* AI Settings Modal — rendered at root level so it overlays everything */}
      <AISettingsModal />

      <Sidebar />

      <main className="flex-1 overflow-y-auto relative">
        {/* Top bar */}
        <div className="sticky top-0 z-10 h-12 border-b border-gray-800/40 bg-gray-900/60 backdrop-blur-xl flex items-center px-8 gap-3">
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>All systems operational</span>
          </div>
        </div>

        {/* Page content */}
        <div className="p-8">
          <Routes>
            <Route path="/"           element={<HomePage />} />
            {/* Original */}
            <Route path="/k8s"        element={<K8sPage />} />
            <Route path="/base64"     element={<Base64Page />} />
            <Route path="/cron"       element={<CronPage />} />
            {/* New */}
            <Route path="/jwt"        element={<JwtPage />} />
            <Route path="/hash"       element={<HashPage />} />
            <Route path="/converter"  element={<ConverterPage />} />
            <Route path="/regex"      element={<RegexPage />} />
            <Route path="/timestamp"  element={<TimestampPage />} />
            <Route path="/subnet"     element={<SubnetPage />} />
            <Route path="/gitignore"  element={<GitignorePage />} />
            <Route path="/curl"       element={<CurlPage />} />
            <Route path="/uuid"       element={<UuidPage />} />
            <Route path="/cicd"       element={<CicdPage />} />
            {/* AI */}
            <Route path="/ai-error"   element={<AiErrorPage />} />
            <Route path="/ai-docker"  element={<AiDockerPage />} />
            <Route path="/ai-chat"    element={<AiChatPage />} />
            <Route path="/ai-optimization" element={<AIOptimizationCenter />} />
            {/* Cloud */}
            <Route path="/cloud-cost" element={<CloudCostPage />} />
            {/* Docker Intelligence Center */}
            <Route path="/docker-intelligence" element={<DockerIntelligencePage />} />
            {/* Multi-Cloud Cost Intelligence Platform */}
            <Route path="/multi-cloud" element={<MultiCloudDashboard />} />
            {/* Application Containerization Suite */}
            <Route path="/containerize" element={<ContainerizePage />} />
            {/* SSL/TLS Certificate Inspector */}
            <Route path="/ssl" element={<SslPage />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

/**
 * BuilderLayout — full-screen layout for the Terraform Visual Builder.
 * No padding, no overflow-y-auto — required for correct drag-and-drop.
 */
function BuilderLayout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0f1a 0%, #0f172a 50%, #0d1424 100%)' }}>
      <AISettingsModal />
      <Sidebar />
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-10 h-12 border-b border-gray-800/40 bg-gray-900/60 backdrop-blur-xl flex items-center px-8 gap-3">
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>All systems operational</span>
          </div>
        </div>
        {/* Builder fills remaining height with no padding */}
        <div className="flex-1 overflow-hidden">
          <TerraformBuilderPage />
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Terraform Visual Builder — full-screen, no padding, no scroll */}
      <Route path="/terraform-builder" element={<BuilderLayout />} />
      {/* Everything else uses the standard layout */}
      <Route path="/*" element={<MainLayout />} />
    </Routes>
  )
}