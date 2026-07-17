// ─────────────────────────────────────────────
//  JSON error location helpers
//
//  Native `JSON.parse` errors are often unhelpful: some messages omit the
//  position entirely (e.g. "Unexpected token '', "{ "taxR"... is not valid
//  JSON") and only echo the *start* of the document, which makes it look like
//  the problem is at the beginning even when it is buried deep in a large file.
//
//  These helpers recover the exact offending offset — from the native message
//  when it exposes one, otherwise by scanning the text ourselves — and turn it
//  into a clear, line/column-aware message with a caret pointing at the break.
// ─────────────────────────────────────────────

export interface JsonErrorLocation {
  /** 0-based character offset of the offending token. */
  position: number
  /** 1-based line number. */
  line: number
  /** 1-based column number. */
  column: number
}

/**
 * Scan `text` and return the 0-based index of the first character that violates
 * JSON grammar, or -1 when the text is valid JSON. The positions produced match
 * V8's own `JSON.parse` positions for the common error classes.
 */
export function findFirstInvalidIndex(text: string): number {
  let i = 0
  const n = text.length
  const isWs = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r'
  const isDigit = (c: string) => c >= '0' && c <= '9'

  function skipWs() {
    while (i < n && isWs(text[i])) i++
  }

  function parseString(): number {
    i++ // opening quote
    while (i < n) {
      const c = text[i]
      if (c === '"') {
        i++
        return -1
      }
      if (c === '\\') {
        i++
        if (i >= n) return i
        const e = text[i]
        if (e === '"' || e === '\\' || e === '/' || e === 'b' || e === 'f' || e === 'n' || e === 'r' || e === 't') {
          i++
          continue
        }
        if (e === 'u') {
          for (let k = 1; k <= 4; k++) {
            const h = text[i + k]
            if (!h || !/[0-9a-fA-F]/.test(h)) return Math.min(i + k, n)
          }
          i += 5
          continue
        }
        return i
      }
      if (c.charCodeAt(0) < 0x20) return i // unescaped control character
      i++
    }
    return i // unterminated string
  }

  function parseNumber(): number {
    const start = i
    if (text[i] === '-') i++
    while (i < n && isDigit(text[i])) i++
    if (text[i] === '.') {
      i++
      while (i < n && isDigit(text[i])) i++
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++
      if (text[i] === '+' || text[i] === '-') i++
      while (i < n && isDigit(text[i])) i++
    }
    return i === start ? start : -1
  }

  function parseObject(): number {
    i++ // {
    skipWs()
    if (text[i] === '}') {
      i++
      return -1
    }
    while (i < n) {
      skipWs()
      if (text[i] !== '"') return i
      const s = parseString()
      if (s !== -1) return s
      skipWs()
      if (text[i] !== ':') return i
      i++
      const v = parseValue()
      if (v !== -1) return v
      skipWs()
      if (text[i] === ',') {
        i++
        continue
      }
      if (text[i] === '}') {
        i++
        return -1
      }
      return i
    }
    return i
  }

  function parseArray(): number {
    i++ // [
    skipWs()
    if (text[i] === ']') {
      i++
      return -1
    }
    while (i < n) {
      const v = parseValue()
      if (v !== -1) return v
      skipWs()
      if (text[i] === ',') {
        i++
        continue
      }
      if (text[i] === ']') {
        i++
        return -1
      }
      return i
    }
    return i
  }

  function parseValue(): number {
    skipWs()
    if (i >= n) return i
    const c = text[i]
    if (c === '{') return parseObject()
    if (c === '[') return parseArray()
    if (c === '"') return parseString()
    if (c === '-' || isDigit(c)) return parseNumber()
    if (text.startsWith('true', i)) {
      i += 4
      return -1
    }
    if (text.startsWith('false', i)) {
      i += 5
      return -1
    }
    if (text.startsWith('null', i)) {
      i += 4
      return -1
    }
    return i
  }

  const r = parseValue()
  if (r !== -1) return r
  skipWs()
  if (i < n) return i // trailing garbage after a complete value
  return -1
}

/**
 * Determine where a JSON parse failed. Prefers the offset embedded in the
 * native error message (V8 exposes one for many errors) and falls back to
 * scanning the source when the message omits it.
 */
export function locateJsonError(raw: string, message: string): JsonErrorLocation | null {
  let position: number | null = null

  const posMatch = /position (\d+)/.exec(message)
  if (posMatch) {
    position = Number(posMatch[1])
  } else if (/Unexpected end of JSON input/i.test(message)) {
    position = raw.length
  } else if (/Unexpected token|not valid JSON/i.test(message)) {
    const idx = findFirstInvalidIndex(raw)
    if (idx !== -1) position = idx
  }

  if (position === null) return null
  if (position > raw.length) position = raw.length

  let line = 1
  let lineStart = 0
  for (let i = 0; i < position; i++) {
    if (raw[i] === '\n') {
      line++
      lineStart = i + 1
    }
  }
  return { position, line, column: position - lineStart + 1 }
}

/** Render a control/invisible character as a visible single-width placeholder. */
function visible(ch: string): string {
  const code = ch.charCodeAt(0)
  if (code < 0x20 || code === 0x7f || code === 0xfeff || code === 0x200b) return '·'
  return ch
}

/**
 * Strip the noisy tail V8 appends to parse errors so we can prepend our own
 * precise location. Turns e.g.
 *   `Unexpected token '', "{ "taxR"... is not valid JSON`
 * into `Unexpected token ''`.
 */
function cleanReason(message: string): string {
  return message
    .replace(/\s*in JSON at position \d+(?: \(line \d+ column \d+\))?/i, '')
    .replace(/,\s*"[\s\S]*?"(?:\.\.\.)? is not valid JSON$/i, '')
    .replace(/\s*is not valid JSON$/i, '')
    .trim()
}

/**
 * Build a clear, location-aware error message with a caret pointing at the
 * exact spot where the JSON breaks. Falls back to the native message when the
 * location cannot be determined.
 */
export function formatJsonError(raw: string, message: string): string {
  const loc = locateJsonError(raw, message)
  if (!loc) return message

  const reason = cleanReason(message) || 'Invalid JSON'
  const header = `${reason} at line ${loc.line}, column ${loc.column}`

  const lines = raw.split('\n')
  const lineText = lines[loc.line - 1] ?? ''
  const rendered = Array.from(lineText).map(visible).join('')

  const gutter = `${loc.line} | `
  const caretPad = ' '.repeat(gutter.length + Math.max(0, loc.column - 1))
  const snippet = `${gutter}${rendered}\n${caretPad}^`

  return `${header}\n\n${snippet}`
}
