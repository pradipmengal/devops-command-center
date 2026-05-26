import React, { useState } from 'react'

function CopyCodeButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text) } catch { const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el) }
        setCopied(true); setTimeout(() => setCopied(false), 2000)
      }}
      className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-medium bg-gray-800/80 border border-gray-700/60 text-gray-400 hover:text-gray-200 hover:bg-gray-700/80 transition-all opacity-0 group-hover:opacity-100"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function CodeBlock({ language, code }) {
  return (
    <div className="group relative my-3 rounded-xl overflow-hidden bg-gray-950 border border-gray-700/40">
      {language && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-gray-900/80 border-b border-gray-700/30">
          <span className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-wider">{language}</span>
        </div>
      )}
      <div className="relative">
        <pre className="p-4 overflow-x-auto text-sm leading-relaxed"><code className="text-gray-200 font-mono text-[13px]">{code}</code></pre>
        <CopyCodeButton text={code} />
      </div>
    </div>
  )
}

function InlineCode({ children }) {
  return (
    <code className="px-1.5 py-0.5 rounded-md bg-gray-800/80 border border-gray-700/50 text-cyan-300 font-mono text-[13px]">{children}</code>
  )
}

export default function MarkdownRenderer({ content }) {
  const lines = content.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(<CodeBlock key={`code-${elements.length}`} language={language} code={codeLines.join('\n')} />)
      continue
    }

    // Empty line
    if (line.trim() === '') {
      i++
      continue
    }

    // Heading ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2]
      const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
      elements.push(
        <Tag key={`h-${elements.length}`} className={`font-bold text-white mt-5 mb-2 ${level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm'}`}>
          {renderInline(text)}
        </Tag>
      )
      i++
      continue
    }

    // Unordered list
    if (line.match(/^[-*+]\s+/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^[-*+]\s+/)) {
        items.push(lines[i].replace(/^[-*+]\s+/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-2 text-sm text-gray-200">
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ul>
      )
      continue
    }

    // Ordered list
    if (line.match(/^\d+\.\s+/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      elements.push(
        <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 my-2 text-sm text-gray-200">
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ol>
      )
      continue
    }

    // Regular paragraph
    const paraLines = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('```') && !lines[i].match(/^[-*+]\s+/) && !lines[i].match(/^\d+\.\s+/) && !lines[i].match(/^#{1,3}\s+/)) {
      paraLines.push(lines[i])
      i++
    }
    elements.push(
      <p key={`p-${elements.length}`} className="text-sm text-gray-200 leading-relaxed mb-2">{renderInline(paraLines.join('\n'))}</p>
    )
  }

  return <div className="space-y-0">{elements}</div>
}

function renderInline(text) {
  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Inline code `...`
    const codeMatch = remaining.match(/`([^`]+)`/)
    if (codeMatch && codeMatch.index === 0) {
      parts.push(<InlineCode key={key++}>{codeMatch[1]}</InlineCode>)
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Bold **...**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    if (boldMatch && boldMatch.index === 0) {
      parts.push(<strong key={key++} className="font-semibold text-white">{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Line break
    const nlMatch = remaining.match(/^\\n/)
    if (nlMatch) {
      parts.push(<br key={key++} />)
      remaining = remaining.slice(nlMatch[0].length)
      continue
    }

    // Plain text up to next special char or end
    const nextSpecial = remaining.search(/[`*\\]/)
    if (nextSpecial === 0) {
      // Single special char that didn't match above — emit literally
      parts.push(remaining[0])
      remaining = remaining.slice(1)
    } else if (nextSpecial > 0) {
      parts.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    } else {
      parts.push(remaining)
      remaining = ''
    }
  }

  return parts
}
