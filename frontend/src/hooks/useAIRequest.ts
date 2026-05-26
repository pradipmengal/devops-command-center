import { useState, useRef, useCallback, useEffect } from 'react'
import axios from 'axios'

// Rotating status messages shown while waiting for a local model
const WAITING_MESSAGES = [
  'Sending request to model...',
  'Model is thinking...',
  'Generating response...',
  'Still working — local models take a moment...',
  'Almost there...',
  'Processing your request...',
  'Analyzing with AI...',
  'This may take up to 60s for local models...',
]

/**
 * useAIRequest — handles AI API calls with:
 * - elapsed timer (updates every second)
 * - rotating status messages
 * - AbortController for cancellation
 * - 120s timeout (generous for local models)
 */
export function useAIRequest() {
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [cancelled, setCancelled] = useState(false)

  const abortRef = useRef(null)
  const timerRef = useRef(null)
  const msgTimerRef = useRef(null)
  const msgIndexRef = useRef(0)

  const startTimers = useCallback(() => {
    setElapsed(0)
    msgIndexRef.current = 0
    setStatusMsg(WAITING_MESSAGES[0])

    // Elapsed counter — tick every second
    timerRef.current = setInterval(() => {
      setElapsed(s => s + 1)
    }, 1000)

    // Rotate status messages every 5 seconds
    msgTimerRef.current = setInterval(() => {
      msgIndexRef.current = (msgIndexRef.current + 1) % WAITING_MESSAGES.length
      setStatusMsg(WAITING_MESSAGES[msgIndexRef.current])
    }, 5000)
  }, [])

  const stopTimers = useCallback(() => {
    clearInterval(timerRef.current)
    clearInterval(msgTimerRef.current)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimers()
      abortRef.current?.abort()
    }
  }, [stopTimers])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    stopTimers()
    setLoading(false)
    setCancelled(true)
    setElapsed(0)
    setStatusMsg('')
  }, [stopTimers])

  /**
   * send — make an AI request
   * @param {string} url - API endpoint
   * @param {object} payload - request body
   * @returns {Promise<{data: any, error: string|null}>}
   */
  const send = useCallback(async (url, payload) => {
    // Create a new AbortController for this request
    abortRef.current = new AbortController()
    setCancelled(false)
    setLoading(true)
    startTimers()

    try {
      const response = await axios.post(url, payload, {
        signal: abortRef.current.signal,
        timeout: 180000, // 3 minutes — generous for local models
      })

      stopTimers()
      setLoading(false)
      setElapsed(0)
      setStatusMsg('')

      const { data } = response
      if (data.status === 'success') {
        return { data, error: null }
      }
      return { data: null, error: data.data?.message ?? 'AI request failed' }

    } catch (err) {
      stopTimers()
      setLoading(false)
      setElapsed(0)
      setStatusMsg('')

      if (axios.isCancel(err) || err.name === 'AbortError' || err.name === 'CanceledError') {
        return { data: null, error: null, cancelled: true }
      }

      const msg = err.response?.data?.data?.message
        ?? err.response?.data?.message
        ?? err.message
        ?? 'Request failed'

      return { data: null, error: msg }
    }
  }, [startTimers, stopTimers])

  return { loading, elapsed, statusMsg, cancelled, send, cancel }
}
