// Guard rails for the two ways bytes get into the app: a file the user picks
// and a URL the app fetches. Both paths materialise the whole payload as a
// string in memory, so without a cap an oversized input freezes the tab long
// before any parser gets a chance to complain.

/**
 * Text documents (JSON, XML, HAR). Real-world HAR captures and API dumps run to
 * a few hundred MB in pathological cases, but anything past 50 MB already makes
 * the editor unusable — better to refuse it than to hang.
 */
export const MAX_TEXT_FILE_BYTES = 50 * 1024 * 1024

/**
 * Diagram JSON is produced by the Draw tool's own Export, where even a busy
 * canvas stays well under a megabyte. A much tighter cap here means picking the
 * wrong file fails fast instead of stalling on a parse that cannot succeed.
 */
export const MAX_DIAGRAM_FILE_BYTES = 5 * 1024 * 1024

/** Same reasoning as MAX_TEXT_FILE_BYTES, applied to fetched responses. */
export const MAX_FETCH_BYTES = MAX_TEXT_FILE_BYTES

/** A URL that has not answered in 30s is hung, not slow. */
export const FETCH_TIMEOUT_MS = 30_000

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

/**
 * Returns the message to show the user, or null when the file is within limits.
 * Callers check this *before* handing the file to FileReader.
 */
export function checkFileSize(file: File, limit: number): string | null {
  if (file.size <= limit) return null
  return `File is too large (${formatBytes(file.size)}). The limit is ${formatBytes(limit)}.`
}
