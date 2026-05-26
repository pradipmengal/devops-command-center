/**
 * Tests for useAIStream hook.
 *
 * Covers:
 *   - Property 2: Chunk Accumulation Round-Trip (Requirements 2.2, 2.7)
 *   - Property 3: Error Frame Propagation (Requirements 2.4, 5.4)
 *   - Property 4: Non-2xx HTTP Error Extraction (Requirements 2.5)
 *   - Property 10: Fresh AbortController Per Stream Request (Requirements 4.5)
 *   - Unit: hook lifecycle examples (Requirements 2.3, 2.6, 4.1, 4.2, 5.5)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as fc from 'fast-check'
import { useAIStream } from '../useAIStream'

// ── SSE stream helpers ────────────────────────────────────────────────────────

/**
 * Build a ReadableStream that emits the given SSE frame strings then closes.
 * Each frame should already be in "data: {...}\n\n" format.
 */
function makeSSEStream(frames) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame))
      }
      controller.close()
    },
  })
}

function chunkFrame(text) {
  return `data: ${JSON.stringify({ chunk: text })}\n\n`
}

function doneFrame() {
  return `data: ${JSON.stringify({ done: true })}\n\n`
}

function errorFrame(msg) {
  return `data: ${JSON.stringify({ error: msg })}\n\n`
}

function mockFetchOk(frames) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: makeSSEStream(frames),
  })
}

function mockFetchError(status, message) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ data: { message } }),
  })
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ── Property 2: Chunk Accumulation Round-Trip ─────────────────────────────────
// Feature: ai-streaming-response, Property 2: Chunk Accumulation Round-Trip
// Validates: Requirements 2.2, 2.7

describe('Property 2: Chunk Accumulation Round-Trip', () => {
  it('final text equals concatenation of all chunks in order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 20 }),
        async (chunks) => {
          const frames = [...chunks.map(chunkFrame), doneFrame()]
          global.fetch = mockFetchOk(frames)

          const { result } = renderHook(() => useAIStream())
          let streamResult
          await act(async () => {
            streamResult = await result.current.stream('/api/ai/chat', {})
          })

          expect(streamResult.text).toBe(chunks.join(''))
          expect(streamResult.error).toBeNull()
          expect(streamResult.cancelled).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })
})

// ── Property 3: Error Frame Propagation ──────────────────────────────────────
// Feature: ai-streaming-response, Property 3: Error Frame Propagation
// Validates: Requirements 2.4, 5.4

describe('Property 3: Error Frame Propagation', () => {
  it('error message from SSE frame is exposed exactly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (msg) => {
          global.fetch = mockFetchOk([errorFrame(msg)])

          const { result } = renderHook(() => useAIStream())
          let streamResult
          await act(async () => {
            streamResult = await result.current.stream('/api/ai/chat', {})
          })

          expect(streamResult.error).toBe(msg)
          expect(streamResult.text).toBeNull()
          expect(streamResult.cancelled).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })
})

// ── Property 4: Non-2xx HTTP Error Extraction ─────────────────────────────────
// Feature: ai-streaming-response, Property 4: Non-2xx HTTP Error Extraction
// Validates: Requirements 2.5

describe('Property 4: Non-2xx HTTP Error Extraction', () => {
  it('extracts error message from JSON body for non-2xx responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }),
        fc.string({ minLength: 1 }),
        async (status, msg) => {
          global.fetch = mockFetchError(status, msg)

          const { result } = renderHook(() => useAIStream())
          let streamResult
          await act(async () => {
            streamResult = await result.current.stream('/api/ai/chat', {})
          })

          expect(streamResult.error).toBe(msg)
          expect(streamResult.text).toBeNull()
          expect(streamResult.cancelled).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })
})

// ── Property 10: Fresh AbortController Per Stream Request ─────────────────────
// Feature: ai-streaming-response, Property 10: Fresh AbortController Per Stream Request
// Validates: Requirements 4.5

describe('Property 10: Fresh AbortController Per Stream Request', () => {
  it('each stream() call uses a distinct AbortController', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (numCalls) => {
          const controllers = []
          const OriginalAbortController = globalThis.AbortController

          globalThis.AbortController = class extends OriginalAbortController {
            constructor() {
              super()
              controllers.push(this)
            }
          }

          global.fetch = mockFetchOk([doneFrame()])

          const { result } = renderHook(() => useAIStream())

          for (let i = 0; i < numCalls; i++) {
            await act(async () => {
              await result.current.stream('/api/ai/chat', {})
            })
            // Reset fetch mock for next call
            global.fetch = mockFetchOk([doneFrame()])
          }

          globalThis.AbortController = OriginalAbortController

          // Each call should have created a distinct controller
          expect(controllers.length).toBeGreaterThanOrEqual(numCalls)
          const uniqueControllers = new Set(controllers)
          expect(uniqueControllers.size).toBe(controllers.length)
        }
      ),
      { numRuns: 10 }
    )
  })
})

// ── Unit: hook lifecycle examples ─────────────────────────────────────────────
// Validates: Requirements 2.3, 2.6, 4.1, 4.2, 5.5

describe('useAIStream lifecycle', () => {
  it('firstTokenTime is null before first chunk, positive after', async () => {
    global.fetch = mockFetchOk([chunkFrame('hello'), doneFrame()])

    const { result } = renderHook(() => useAIStream())
    expect(result.current.firstTokenTime).toBeNull()

    await act(async () => {
      await result.current.stream('/api/ai/chat', {})
    })

    expect(result.current.firstTokenTime).toBeGreaterThanOrEqual(0)
  })

  it('done frame sets streaming to false and returns complete text', async () => {
    global.fetch = mockFetchOk([chunkFrame('hello '), chunkFrame('world'), doneFrame()])

    const { result } = renderHook(() => useAIStream())
    let streamResult

    await act(async () => {
      streamResult = await result.current.stream('/api/ai/chat', {})
    })

    expect(result.current.streaming).toBe(false)
    expect(streamResult.text).toBe('hello world')
    expect(streamResult.error).toBeNull()
    expect(streamResult.cancelled).toBe(false)
  })

  it('AbortError returns cancelled: true', async () => {
    global.fetch = vi.fn().mockRejectedValue(
      Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })
    )

    const { result } = renderHook(() => useAIStream())
    let streamResult

    await act(async () => {
      streamResult = await result.current.stream('/api/ai/chat', {})
    })

    expect(streamResult.cancelled).toBe(true)
    expect(streamResult.text).toBeNull()
    expect(streamResult.error).toBeNull()
    expect(result.current.streaming).toBe(false)
  })

  it('stream ending without done/error returns accumulated text if non-empty', async () => {
    // Stream closes without a done frame but has some text
    global.fetch = mockFetchOk([chunkFrame('partial text')])

    const { result } = renderHook(() => useAIStream())
    let streamResult

    await act(async () => {
      streamResult = await result.current.stream('/api/ai/chat', {})
    })

    expect(streamResult.text).toBe('partial text')
    expect(streamResult.error).toBeNull()
  })

  it('stream ending without done/error and no text returns Empty response error', async () => {
    global.fetch = mockFetchOk([]) // empty stream, no frames

    const { result } = renderHook(() => useAIStream())
    let streamResult

    await act(async () => {
      streamResult = await result.current.stream('/api/ai/chat', {})
    })

    expect(streamResult.text).toBeNull()
    expect(streamResult.error).toBe('Empty response')
  })

  it('cancel() aborts the connection and sets streaming to false', async () => {
    let resolveRead
    const readPromise = new Promise(resolve => { resolveRead = resolve })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: () => readPromise,
          cancel: vi.fn(),
        }),
      },
    })

    const { result } = renderHook(() => useAIStream())

    // Start streaming (don't await — it's in-flight)
    act(() => {
      result.current.stream('/api/ai/chat', {})
    })

    // Cancel while in-flight
    await act(async () => {
      result.current.cancel()
    })

    expect(result.current.streaming).toBe(false)
    expect(result.current.elapsed).toBe(0)
  })
})
