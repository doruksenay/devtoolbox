// Web Worker for parsing large JSON files without blocking main thread

self.onmessage = function (e: MessageEvent<string>) {
  try {
    const parsed = JSON.parse(e.data)
    self.postMessage({ success: true, data: parsed })
  } catch (err) {
    self.postMessage({ success: false, error: (err as Error).message })
  }
}

export {}
