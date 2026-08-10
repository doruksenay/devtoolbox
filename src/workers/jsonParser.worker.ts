// Web Worker for parsing large JSON files without blocking main thread.
//
// The worker is long-lived and handles many requests, so every message carries
// an id and the reply echoes it back: callers can discard results belonging to
// a request they have already superseded.

interface ParseRequest {
  id: number
  raw: string
}

self.onmessage = function (e: MessageEvent<ParseRequest>) {
  const { id, raw } = e.data
  try {
    const parsed = JSON.parse(raw)
    self.postMessage({ id, success: true, data: parsed })
  } catch (err) {
    self.postMessage({ id, success: false, error: (err as Error).message })
  }
}

export {}
