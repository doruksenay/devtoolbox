import { useCallback, useRef } from 'react'

const SIZE_THRESHOLD = 1024 * 1024 // 1MB

interface ParseResult {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Uses a Web Worker to parse JSON for payloads > 1MB,
 * falling back to synchronous JSON.parse for smaller payloads.
 */
export function useWorkerParse() {
  const workerRef = useRef<Worker | null>(null)

  const parse = useCallback((raw: string): Promise<ParseResult> => {
    if (raw.length < SIZE_THRESHOLD) {
      // Synchronous for small payloads
      try {
        const data = JSON.parse(raw)
        return Promise.resolve({ success: true, data })
      } catch (e) {
        return Promise.resolve({ success: false, error: (e as Error).message })
      }
    }

    // Use Web Worker for large payloads
    return new Promise((resolve) => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }

      const worker = new Worker(
        new URL('../workers/jsonParser.worker.ts', import.meta.url),
        { type: 'module' }
      )
      workerRef.current = worker

      worker.onmessage = (e: MessageEvent<ParseResult>) => {
        resolve(e.data)
        worker.terminate()
        workerRef.current = null
      }

      worker.onerror = () => {
        resolve({ success: false, error: 'Worker failed to parse JSON' })
        worker.terminate()
        workerRef.current = null
      }

      worker.postMessage(raw)
    })
  }, [])

  return { parse }
}
