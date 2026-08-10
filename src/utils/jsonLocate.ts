// ─────────────────────────────────────────────
//  Locating a JSON path inside the RAW document text
//
//  The grid renders parsed JSON while the editor next to it shows the text the
//  user actually typed. Clicking a cell has to select the matching characters
//  on the left, and `JSON.parse` throws every offset away — so this module
//  re-scans the raw text with a hand-written recursive-descent scanner that
//  tracks a cursor.
//
//  Re-serialising the parsed value and searching for that text would be wrong
//  twice over: the user's own spacing and key order would not match, and a
//  value like `1` or `"id"` occurs many times in a document.
//
//  Paths arrive as the same `PathSegment[]` the tree already walks, because a
//  string path such as `$.a.b` is ambiguous when a key itself contains `.` or
//  `[` (see jsonEdit.ts).
// ─────────────────────────────────────────────

import type { PathSegment } from './jsonEdit'

/** Half-open character range: `raw.slice(start, end)` is the value's text. */
export interface JsonRange {
  /** Offset of the value's first character. */
  start: number
  /** Offset just past the value's last character. */
  end: number
}

/** Returned by the scan helpers for "no valid JSON production starts here". */
const FAIL = -1

/**
 * Nesting ceiling for the scanner. The scan is recursive, so a pathological
 * input like `[[[[[…` would otherwise overflow the stack and throw where the
 * contract says to return `null`. Real documents nest a few dozen levels deep;
 * anything past this is reported as unlocatable rather than crashing the tab.
 */
const MAX_DEPTH = 512

const CH_TAB = 0x09
const CH_LF = 0x0a
const CH_CR = 0x0d
const CH_SPACE = 0x20
const CH_QUOTE = 0x22
const CH_COMMA = 0x2c
const CH_COLON = 0x3a
const CH_BACKSLASH = 0x5c
const CH_LBRACKET = 0x5b
const CH_RBRACKET = 0x5d
const CH_LBRACE = 0x7b
const CH_RBRACE = 0x7d

function isWhitespace(code: number): boolean {
  return code === CH_SPACE || code === CH_TAB || code === CH_LF || code === CH_CR
}

/** `charCodeAt` past the end yields NaN, so every comparison below is false. */
function isDigitAt(raw: string, i: number): boolean {
  const code = raw.charCodeAt(i)
  return code >= 0x30 && code <= 0x39
}

function isHexAt(raw: string, i: number): boolean {
  const code = raw.charCodeAt(i)
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x61 && code <= 0x66) ||
    (code >= 0x41 && code <= 0x46)
  )
}

/** Index of the first non-whitespace character at or after `from`. */
function skipWhitespace(raw: string, from: number): number {
  let i = from
  while (i < raw.length && isWhitespace(raw.charCodeAt(i))) i++
  return i
}

// ── Scanning ──────────────────────────────────
// Every scan function takes the offset of the production's first character and
// returns the offset just past its last character, or FAIL. None of them skip
// leading whitespace — callers do that — and each one advances its cursor on
// every loop iteration, so no input can make them spin.

/**
 * Scans the string starting at `from` (which must be the opening quote).
 * Escapes are consumed as a unit, which is what keeps a `{`, `,`, `:` or an
 * escaped `\"` inside a string from being mistaken for structure.
 */
function scanString(raw: string, from: number): number {
  if (raw.charCodeAt(from) !== CH_QUOTE) return FAIL

  let i = from + 1
  while (i < raw.length) {
    const code = raw.charCodeAt(i)

    if (code === CH_QUOTE) return i + 1

    if (code === CH_BACKSLASH) {
      if (i + 1 >= raw.length) return FAIL
      const escape = raw[i + 1]
      if (escape === 'u') {
        if (!isHexAt(raw, i + 2) || !isHexAt(raw, i + 3)) return FAIL
        if (!isHexAt(raw, i + 4) || !isHexAt(raw, i + 5)) return FAIL
        i += 6
        continue
      }
      if (escape !== '"' && escape !== '\\' && escape !== '/' && escape !== 'b' &&
        escape !== 'f' && escape !== 'n' && escape !== 'r' && escape !== 't') {
        return FAIL
      }
      i += 2
      continue
    }

    // Raw control characters are not legal inside a JSON string; rejecting
    // them here keeps us in step with JSON.parse.
    if (code < 0x20) return FAIL
    i++
  }

  return FAIL
}

/** Scans `-? int frac? exp?` — the JSON number grammar, no leniency. */
function scanNumber(raw: string, from: number): number {
  let i = from
  if (raw[i] === '-') i++

  if (raw[i] === '0') {
    i++
  } else if (isDigitAt(raw, i)) {
    while (isDigitAt(raw, i)) i++
  } else {
    return FAIL
  }

  if (raw[i] === '.') {
    i++
    if (!isDigitAt(raw, i)) return FAIL
    while (isDigitAt(raw, i)) i++
  }

  if (raw[i] === 'e' || raw[i] === 'E') {
    i++
    if (raw[i] === '+' || raw[i] === '-') i++
    if (!isDigitAt(raw, i)) return FAIL
    while (isDigitAt(raw, i)) i++
  }

  return i
}

function scanLiteral(raw: string, from: number, word: string): number {
  return raw.startsWith(word, from) ? from + word.length : FAIL
}

function scanObject(raw: string, from: number, depth: number): number {
  let i = skipWhitespace(raw, from + 1)
  if (raw.charCodeAt(i) === CH_RBRACE) return i + 1

  while (i < raw.length) {
    const keyEnd = scanString(raw, i)
    if (keyEnd === FAIL) return FAIL

    i = skipWhitespace(raw, keyEnd)
    if (raw.charCodeAt(i) !== CH_COLON) return FAIL

    const valueEnd = scanValue(raw, skipWhitespace(raw, i + 1), depth + 1)
    if (valueEnd === FAIL) return FAIL

    i = skipWhitespace(raw, valueEnd)
    const code = raw.charCodeAt(i)
    if (code === CH_RBRACE) return i + 1
    if (code !== CH_COMMA) return FAIL

    // A comma must be followed by another member: `{"a":1,}` is invalid.
    i = skipWhitespace(raw, i + 1)
  }

  return FAIL
}

function scanArray(raw: string, from: number, depth: number): number {
  let i = skipWhitespace(raw, from + 1)
  if (raw.charCodeAt(i) === CH_RBRACKET) return i + 1

  while (i < raw.length) {
    const valueEnd = scanValue(raw, i, depth + 1)
    if (valueEnd === FAIL) return FAIL

    i = skipWhitespace(raw, valueEnd)
    const code = raw.charCodeAt(i)
    if (code === CH_RBRACKET) return i + 1
    if (code !== CH_COMMA) return FAIL

    i = skipWhitespace(raw, i + 1)
  }

  return FAIL
}

/** Scans any JSON value beginning at `from`, which must not be whitespace. */
function scanValue(raw: string, from: number, depth: number): number {
  if (from >= raw.length) return FAIL
  if (depth > MAX_DEPTH) return FAIL

  switch (raw.charCodeAt(from)) {
    case CH_LBRACE:
      return scanObject(raw, from, depth)
    case CH_LBRACKET:
      return scanArray(raw, from, depth)
    case CH_QUOTE:
      return scanString(raw, from)
    default:
      break
  }

  const first = raw[from]
  if (first === 't') return scanLiteral(raw, from, 'true')
  if (first === 'f') return scanLiteral(raw, from, 'false')
  if (first === 'n') return scanLiteral(raw, from, 'null')
  return scanNumber(raw, from)
}

// ── Decoding ──────────────────────────────────

const HEX_QUAD = /^[0-9a-fA-F]{4}$/

/**
 * Decodes the string literal spanning `[start, end)` — quotes included — into
 * the value it denotes, so keys are compared the way `JSON.parse` compares
 * them: a segment `a.b` matches the raw key `"a.b"`, and equally the same key
 * spelled with escapes, where the dot is written as backslash-u002E. Returns
 * `null` if the literal is malformed.
 *
 * Surrogate pairs need no special handling — an emoji written as two
 * backslash-u escapes appends both code units in order, which is exactly the
 * string JSON.parse produces.
 */
function decodeString(raw: string, start: number, end: number): string | null {
  if (end - start < 2) return null

  const body = raw.slice(start + 1, end - 1)
  // Overwhelmingly the common case — no escapes means no work.
  if (!body.includes('\\')) return body

  let out = ''
  let i = 0
  while (i < body.length) {
    const char = body[i]
    if (char !== '\\') {
      out += char
      i++
      continue
    }

    const escape = body[i + 1]
    if (escape === 'u') {
      const hex = body.slice(i + 2, i + 6)
      if (!HEX_QUAD.test(hex)) return null
      out += String.fromCharCode(parseInt(hex, 16))
      i += 6
      continue
    }

    switch (escape) {
      case '"': out += '"'; break
      case '\\': out += '\\'; break
      case '/': out += '/'; break
      case 'b': out += '\b'; break
      case 'f': out += '\f'; break
      case 'n': out += '\n'; break
      case 'r': out += '\r'; break
      case 't': out += '\t'; break
      default: return null
    }
    i += 2
  }

  return out
}

// ── Descending ────────────────────────────────

/**
 * Range of the value held under `key` in the object starting at `objectStart`.
 *
 * Duplicate keys: the LAST occurrence wins, so the loop keeps overwriting its
 * candidate instead of returning early. That matches `JSON.parse`, which
 * defines each member in document order and lets a later definition overwrite
 * an earlier one — `JSON.parse('{"a":1,"a":2}').a === 2` (asserted in the
 * tests so the assumption is checked, not just claimed). It also means a
 * duplicate can *hide* a key: in `{"a":{"b":1},"a":{"c":2}}` the parsed
 * document has no `a.b`, and because we descend only into the winning member,
 * neither does this scanner.
 *
 * The object is assumed to be well formed — `locatePath` validates the whole
 * document first — but every exit is still guarded so bad input stops rather
 * than spins.
 */
function locateMember(raw: string, objectStart: number, key: string): JsonRange | null {
  let i = skipWhitespace(raw, objectStart + 1)
  let found: JsonRange | null = null

  while (i < raw.length && raw.charCodeAt(i) === CH_QUOTE) {
    const keyEnd = scanString(raw, i)
    if (keyEnd === FAIL) return found

    const decoded = decodeString(raw, i, keyEnd)

    i = skipWhitespace(raw, keyEnd)
    if (raw.charCodeAt(i) !== CH_COLON) return found

    const valueStart = skipWhitespace(raw, i + 1)
    const valueEnd = scanValue(raw, valueStart, 0)
    if (valueEnd === FAIL) return found

    if (decoded !== null && decoded === key) found = { start: valueStart, end: valueEnd }

    i = skipWhitespace(raw, valueEnd)
    if (raw.charCodeAt(i) !== CH_COMMA) return found
    i = skipWhitespace(raw, i + 1)
  }

  return found
}

/** Range of element `index` in the array starting at `arrayStart`. */
function locateElement(raw: string, arrayStart: number, index: number): JsonRange | null {
  if (!Number.isInteger(index) || index < 0) return null

  let i = skipWhitespace(raw, arrayStart + 1)
  if (raw.charCodeAt(i) === CH_RBRACKET) return null

  let position = 0
  while (i < raw.length) {
    const valueEnd = scanValue(raw, i, 0)
    if (valueEnd === FAIL) return null
    if (position === index) return { start: i, end: valueEnd }

    position++
    i = skipWhitespace(raw, valueEnd)
    if (raw.charCodeAt(i) !== CH_COMMA) return null
    i = skipWhitespace(raw, i + 1)
  }

  return null
}

/**
 * Returns the range of the value at `segments` inside `raw`.
 *
 * `raw.slice(start, end)` is the value's exact source text — quotes included
 * for strings, the whole subtree for objects and arrays, with the user's own
 * formatting untouched. An empty path returns the top-level value, trimmed of
 * surrounding whitespace.
 *
 * Returns `null` when the path does not exist or `raw` is not valid JSON.
 * Object keys are matched by their decoded value, array indices positionally.
 */
export function locatePath(raw: string, segments: readonly PathSegment[]): JsonRange | null {
  const rootStart = skipWhitespace(raw, 0)
  const rootEnd = scanValue(raw, rootStart, 0)
  if (rootEnd === FAIL) return null
  // Trailing garbage makes the document invalid, the same way `JSON.parse`
  // rejects `{"a":1} oops`.
  if (skipWhitespace(raw, rootEnd) !== raw.length) return null

  let current: JsonRange = { start: rootStart, end: rootEnd }

  for (const segment of segments) {
    const code = raw.charCodeAt(current.start)
    let next: JsonRange | null
    if (code === CH_LBRACE) {
      next = locateMember(raw, current.start, String(segment))
    } else if (code === CH_LBRACKET) {
      next = locateElement(raw, current.start, Number(segment))
    } else {
      // The path runs past a scalar.
      return null
    }
    if (next === null) return null
    current = next
  }

  return current
}
