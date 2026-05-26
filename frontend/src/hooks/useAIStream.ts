import { useState, useRef, useCallback, useEffect } from 'react'

const WAITING_MESSAGES = [
  'Connecting to model...',
  'Waiting for first token...',
  'Model is generating...',
  'Streaming response...',
  'Local models take a moment — almost there...',
  'Still generating...',
]

/**
 * useAIStream — handles streaming AI responses via SSE (Server-Sent Events).
 *
 * The backend sends: data: {"chunk": "text"}\n\n
 * On done:           data: {"done": true}\n\n
 * On error:          data: {"error": "message"}\n\n
 *
 * Features:
 * - Text appears word-by-word as it streams in
 * - Elapsed timer
 * - Rotating status messages (tuned for local model wait times)
 * - Cancel support via AbortController
 * - firstTokenTime: ms until first token arrived (TTFT)
 */
export function useAIStream() {
  const [streaming, setStreaming] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [streamError, setStreamError] = useState(null)
  const [firstTokenTime, setFirstTokenTime] = useState(null)

  const abortRef = useRef(null)
  const timerRef = useRef(null)
  const msgTimerRef = useRef(null)
  const msgIndexRef = useRef(0)
  const startTimeRef = useRef(null)
  const gotFirstTokenRef = useRef(false)

  const startTimers = useCallback(() => {
    setElapsed(0)
    setFirstTokenTime(null)
    gotFirstTokenRef.current = false
    msgIndexRef.current = 0
    setStatusMsg(WAITING_MESSAGES[0])
    startTimeRef.current = Date.now()

    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    // Rotate messages faster at first (2s), then slower (5s)
    let rotateDelay = 2000
    const rotate = () => {
      msgIndexRef.current = (msgIndexRef.current + 1) % WAITING_MESSAGES.length
      setStatusMsg(WAITING_MESSAGES[msgIndexRef.current])
      rotateDelay = Math.min(rotateDelay + 1000, 6000)
      msgTimerRef.current = setTimeout(rotate, rotateDelay)
    }
    msgTimerRef.current = setTimeout(rotate, rotateDelay)
  }, [])

  const stopTimers = useCallback(() => {
    clearInterval(timerRef.current)
    clearTimeout(msgTimerRef.current)
  }, [])

  useEffect(() => {
    return () => {
      stopTimers()
      abortRef.current?.abort()
    }
  }, [stopTimers])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    stopTimers()
    setStreaming(false)
    setElapsed(0)
    setStatusMsg('')
  }, [stopTimers])

  const reset = useCallback(() => {
    setStreamedText('')
    setStreamError(null)
    setElapsed(0)
    setStatusMsg('')
    setFirstTokenTime(null)
  }, [])

  /**
   * stream — POST to a streaming endpoint and collect chunks.
   * @param {string} url
   * @param {object} payload
   * @returns {Promise<{text: string, error: string|null, cancelled: boolean}>}
   */
  const stream = useCallback(async (url, payload) => {
    abortRef.current = new AbortController()
    reset()
    setStreaming(true)
    startTimers()

    let fullText = ''

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        // Non-streaming error (e.g. 422 validation)
        const body = await response.json().catch(() => ({}))
        const msg = body?.data?.message ?? `HTTP ${response.status}`
        stopTimers()
        setStreaming(false)
        setStreamError(msg)
        return { text: null, error: msg, cancelled: false }
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const parsed = JSON.parse(jsonStr)

            if (parsed.chunk) {
              // Record time-to-first-token
              if (!gotFirstTokenRef.current) {
                gotFirstTokenRef.current = true
                const ttft = Date.now() - startTimeRef.current
                setFirstTokenTime(ttft)
                setStatusMsg('Receiving response...')
              }
              fullText += parsed.chunk
              setStreamedText(fullText)
            } else if (parsed.done) {
              // Stream complete
              stopTimers()
              setStreaming(false)
              setElapsed(0)
              setStatusMsg('')
              return { text: fullText, error: null, cancelled: false }
            } else if (parsed.error) {
              stopTimers()
              setStreaming(false)
              setStreamError(parsed.error)
              return { text: null, error: parsed.error, cancelled: false }
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }

      // Stream ended without explicit done signal
      stopTimers()
      setStreaming(false)
      setElapsed(0)
      setStatusMsg('')
      return { text: fullText || null, error: fullText ? null : 'Empty response', cancelled: false }

    } catch (err) {
      stopTimers()
      setStreaming(false)
      setElapsed(0)
      setStatusMsg('')

      if (err.name === 'AbortError') {
        return { text: null, error: null, cancelled: true }
      }

      const msg = err.message ?? 'Stream failed'
      setStreamError(msg)
      return { text: null, error: msg, cancelled: false }
    }
  }, [startTimers, stopTimers, reset])

  return {
    streaming,
    streamedText,
    elapsed,
    statusMsg,
    streamError,
    firstTokenTime,
    stream,
    cancel,
    reset,
  }
}
