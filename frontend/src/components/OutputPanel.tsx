import React from 'react'
import LoadingSpinner from './LoadingSpinner'
import CopyButton from './CopyButton'

export default function OutputPanel({ content, error, loading }) {
  if (loading) {
    return (
      <div className="mt-5 rounded-2xl bg-gray-800/40 border border-gray-700/40 p-6 animate-fade-in">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/30 p-5 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400 mb-1">Error</p>
            <p className="text-sm text-red-300/80 whitespace-pre-wrap leading-relaxed">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (content) {
    return (
      <div className="mt-5 rounded-2xl bg-gray-900/80 border border-gray-700/40 overflow-hidden animate-fade-in shadow-xl shadow-black/20">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40 bg-gray-800/40">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            </div>
            <span className="text-xs text-gray-500 font-medium ml-1">Output</span>
          </div>
          <CopyButton text={content} />
        </div>
        <pre className="p-5 text-sm text-gray-200 overflow-x-auto whitespace-pre-wrap break-words font-mono leading-relaxed max-h-[500px] overflow-y-auto">
          {content}
        </pre>
      </div>
    )
  }

  return (
    <div className="mt-5 rounded-2xl border border-dashed border-gray-700/40 bg-gray-800/20 p-10 text-center animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-gray-800/60 flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <p className="text-sm text-gray-500 font-medium">Output will appear here</p>
      <p className="text-xs text-gray-600 mt-1">Fill in the form above and click generate</p>
    </div>
  )
}
