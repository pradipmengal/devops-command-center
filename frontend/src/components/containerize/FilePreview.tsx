import React, { useState } from 'react'
import CopyButton from '../CopyButton'

const SECTION_ICONS = {
  core: '📦',
  k8s: '☸️',
  helm: '⛑️',
}

const FILE_ICONS = {
  Dockerfile: '🐳',
  'docker-compose.yml': '🐙',
}

function getFileIcon(filename) {
  if (FILE_ICONS[filename]) return FILE_ICONS[filename]
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return '📋'
  if (filename.endsWith('.tpl')) return '🔧'
  if (filename.endsWith('.json')) return '📊'
  return '📄'
}

function getFileLang(filename) {
  if (filename.endsWith('.yml') || filename.endsWith('.yaml')) return 'yaml'
  if (filename.endsWith('.dockerfile') || filename === 'Dockerfile') return 'dockerfile'
  if (filename.endsWith('.js')) return 'javascript'
  if (filename.endsWith('.ts')) return 'typescript'
  if (filename.endsWith('.py')) return 'python'
  if (filename.endsWith('.sh')) return 'bash'
  if (filename.endsWith('.tpl')) return 'gotmpl'
  if (filename.endsWith('.json')) return 'json'
  return 'yaml'
}

export default function FilePreview({ files }) {
  const fileEntries = Object.entries(files || {})
  const [expandedSections, setExpandedSections] = useState({ core: true })
  const [activeTab, setActiveTab] = useState(null)

  const sections = [
    { label: 'Core Files', key: 'core', icon: SECTION_ICONS.core, files: fileEntries.filter(([n]) => n === 'Dockerfile' || n === 'docker-compose.yml') },
    { label: 'Kubernetes', key: 'k8s', icon: SECTION_ICONS.k8s, files: fileEntries.filter(([n]) => n.startsWith('k8s/')) },
    { label: 'Helm', key: 'helm', icon: SECTION_ICONS.helm, files: fileEntries.filter(([n]) => n.startsWith('helm/')) },
    { label: 'Other', key: 'other', icon: '📄', files: fileEntries.filter(([n]) => !['Dockerfile', 'docker-compose.yml'].includes(n) && !n.startsWith('k8s/') && !n.startsWith('helm/')) },
  ].filter(s => s.files.length > 0)

  if (fileEntries.length === 0) return null

  const activeFile = activeTab && files[activeTab] ? { name: activeTab, content: files[activeTab] } : null
  const totalFiles = fileEntries.length

  function toggleSection(key) {
    setExpandedSections(prev => {
      const next = { ...prev }
      if (next[key]) {
        delete next[key]
      } else {
        next[key] = true
      }
      if (!next[key] && activeTab && sections.find(s => s.key === key)?.files.some(([n]) => n === activeTab)) {
        setActiveTab(null)
      }
      return next
    })
  }

  function handleTabClick(filename) {
    setActiveTab(filename)
    const section = sections.find(s => s.files.some(([n]) => n === filename))
    if (section && !expandedSections[section.key]) {
      setExpandedSections(prev => ({ ...prev, [section.key]: true }))
    }
  }

  return (
    <div className="rounded-2xl bg-gray-900/80 border border-gray-700/40 overflow-hidden shadow-xl shadow-black/20">
      <div className="px-4 py-3 border-b border-gray-700/40 bg-gray-800/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            </div>
            <span className="text-xs text-gray-500 font-medium ml-1">Generated Files ({totalFiles})</span>
          </div>
          {activeFile && (
            <CopyButton text={activeFile.content} />
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-700/30">
        {sections.map(section => {
          const isExpanded = !!expandedSections[section.key]

          return (
            <div key={section.key}>
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/40 transition-colors text-left"
              >
                <span className="text-sm">{section.icon}</span>
                <span className={`text-xs font-semibold uppercase tracking-wider ${isExpanded ? 'text-indigo-300' : 'text-gray-500'}`}>
                  {section.label}
                </span>
                <span className="text-[10px] text-gray-600 ml-auto">({section.files.length})</span>
                <svg
                  className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {section.files.map(([filename]) => (
                      <button
                        key={filename}
                        onClick={() => handleTabClick(filename)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                          activeTab === filename
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 border border-transparent'
                        }`}
                      >
                        <span>{getFileIcon(filename)}</span>
                        <span>{filename.replace(/^(k8s\/|helm\/)/, '')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {activeFile && (
        <pre className="p-5 text-sm text-gray-200 font-mono whitespace-pre-wrap break-words leading-relaxed max-h-[500px] overflow-y-auto border-t border-gray-700/40">
          <code>{activeFile.content}</code>
        </pre>
      )}
    </div>
  )
}
