// ─────────────────────────────────────────────
//  Stringified JSON, in both directions
//
//  JSON that travelled through a log line, a database text column or a message
//  envelope arrives as a string *containing* JSON: `"{\"a\":1}"`. Worse, a
//  payload that crossed two such boundaries is escaped twice and needs peeling
//  more than once, which is why unwrapping loops instead of parsing once.
// ─────────────────────────────────────────────

export interface UnescapeResult {
  ok: boolean
  text?: string
  /** How many string wrappers were peeled off; 0 when the input was plain JSON. */
  layers?: number
  error?: string
}

export interface EscapeResult {
  ok: boolean
  text?: string
  error?: string
}

/**
 * Peeling is bounded so a pathological input — a string of a string of a
 * string… — cannot spin. Anything nested deeper than this was not written by a
 * pipeline anyone is trying to debug.
 */
const MAX_LAYERS = 16

/**
 * Unwraps a stringified JSON payload.
 *
 * Each round parses the text; as long as the result is itself a string, that
 * string was another wrapper and the loop continues. The moment a round yields
 * a non-string, the real document has been reached and is pretty-printed. If
 * the innermost value is plain text rather than JSON, that text is returned as
 * it stands — unwrapping succeeded even though the payload was never JSON.
 */
export function unescapeJsonString(raw: string): UnescapeResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'Input is empty' }

  let current = trimmed
  let layers = 0

  while (layers < MAX_LAYERS) {
    let parsed: unknown
    try {
      parsed = JSON.parse(current)
    } catch {
      break
    }
    if (typeof parsed !== 'string') {
      return { ok: true, text: JSON.stringify(parsed, null, 2), layers }
    }
    current = parsed
    layers += 1
  }

  if (layers === 0) {
    return { ok: false, error: 'Input is neither JSON nor a quoted JSON string' }
  }
  return { ok: true, text: current, layers }
}

/**
 * Wraps JSON as a single-line escaped string literal, ready to paste into
 * another JSON document. The payload is re-serialised compactly first, so the
 * result never carries the indentation of the source.
 */
export function escapeJsonString(raw: string): EscapeResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'Input is empty' }

  try {
    const parsed: unknown = JSON.parse(trimmed)
    return { ok: true, text: JSON.stringify(JSON.stringify(parsed)) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
