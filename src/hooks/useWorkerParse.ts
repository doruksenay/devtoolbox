import { useCallback, useEffect, useRef } from 'react'

const SIZE_THRESHOLD = 1024 * 1024 // 1MB

interface ParseResult {
  success: boolean
  data?: unknown
  error?: string
}

interface WorkerReply extends ParseResult {
  id: number
}

/**
 * Parses JSON off the main thread for payloads above 1MB, falling back to a
 * synchronous `JSON.parse` below that (spinning up a worker costs more than it
 * saves for small documents).
 *
 * The worker is created once and reused. Live validation re-parses on every
 * typing pause, so the previous approach — a fresh worker per call, terminated
 * afterwards — paid worker startup and module loading on each keystroke pause.
 */
export function useWorkerParse() {
  const workerRef = useRef<Worker | null>(null)
  const nextIdRef = useRef(0)
  // Requests still waiting for a reply, keyed by the id sent to the worker.
  const pendingRef = useRef(new Map<number, (result: ParseResult) => void>())

  useEffect(() => {
    const pending = pendingRef.current
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
      pending.clear()
    }
  }, [])

  const getWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current

    const worker = new Worker(new URL('../workers/jsonParser.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      const { id, ...result } = e.data
      const resolve = pendingRef.current.get(id)
      if (!resolve) return // superseded by a newer request
      pendingRef.current.delete(id)
      resolve(result)
    }

    worker.onerror = () => {
      // The worker is unusable from here on: fail everything still waiting and
      // drop it so the next call builds a fresh one.
      for (const resolve of pendingRef.current.values()) {
        resolve({ success: false, error: 'Worker failed to parse JSON' })
      }
      pendingRef.current.clear()
      worker.terminate()
      workerRef.current = null
    }

    workerRef.current = worker
    return worker
  }, [])

  const parse = useCallback(
    (raw: string): Promise<ParseResult> => {
      if (raw.length < SIZE_THRESHOLD) {
        // Synchronous for small payloads
        try {
          const data = JSON.parse(raw)
          return Promise.resolve({ success: true, data })
        } catch (e) {
          return Promise.resolve({ success: false, error: (e as Error).message })
        }
      }

      return new Promise((resolve) => {
        const id = nextIdRef.current++
        pendingRef.current.set(id, resolve)
        getWorker().postMessage({ id, raw })
      })
    },
    [getWorker],
  )

  return { parse }
}
