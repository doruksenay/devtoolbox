// ─────────────────────────────────────────────
//  Repair for loose, hand-edited or copy-pasted JSON
//
//  Pasted JSON is rarely strict: it arrives with trailing commas, JSONC
//  comments, single or smart quotes, bare keys, non-JSON literals like `NaN`,
//  or still wrapped in the log line it was copied out of. This rewrites such
//  input into strict JSON and reports, in plain words, everything it changed —
//  a repair the user cannot inspect is a repair they cannot trust.
//
//  The pass is string-aware from end to end: a quoted run is consumed as a
//  single atom, so a `//`, a comma or a brace *inside* a string is never read
//  as syntax. That is the one rule the repair must never break; silently
//  editing a URL inside a string is far worse than declining to repair at all.
// ─────────────────────────────────────────────

export interface RepairResult {
  ok: boolean
  /** The strict JSON. Present only when `ok`. */
  text?: string
  /** Human-readable list of what was fixed, empty when the input was already valid. */
  changes?: string[]
  error?: string
}

const SMART_DOUBLE = ['“', '”']
const SMART_SINGLE = ['‘', '’']

/** Every character that can open a string in the dialects accepted here. */
const QUOTES = new Set(['"', "'", ...SMART_DOUBLE, ...SMART_SINGLE])

/** Characters that always terminate a bare (unquoted) token. */
const TOKEN_BREAKS = new Set([',', ':', '{', '}', '[', ']'])

/** The escapes JSON actually defines, minus `\u` which is checked separately. */
const VALID_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't'])

/** Literals other languages and REPLs emit that JSON has no spelling for. */
const NON_JSON_LITERALS = new Set(['NaN', 'Infinity', '-Infinity', '+Infinity', 'undefined'])

/** A number exactly as the JSON grammar allows it — anything else needs work. */
const JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'
}

/** The quote characters that can close a string opened with `open`. */
function closersFor(open: string): Set<string> {
  if (SMART_DOUBLE.includes(open)) return new Set([...SMART_DOUBLE, '"'])
  if (SMART_SINGLE.includes(open)) return new Set([...SMART_SINGLE, "'"])
  return new Set([open])
}

/** Renders one character as it must appear inside a JSON string literal. */
function escapeChar(ch: string): string {
  if (ch === '"') return '\\"'
  if (ch === '\\') return '\\\\'
  if (ch === '\n') return '\\n'
  if (ch === '\r') return '\\r'
  if (ch === '\t') return '\\t'
  if (ch === '\b') return '\\b'
  if (ch === '\f') return '\\f'
  if (ch < ' ') return `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
  return ch
}

/** Index of the first character after any run of whitespace and comments. */
function skipTrivia(src: string, from: number): number {
  let i = from
  for (;;) {
    while (i < src.length && isSpace(src[i])) i += 1
    if (src[i] === '/' && src[i + 1] === '/') {
      const newline = src.indexOf('\n', i)
      i = newline === -1 ? src.length : newline + 1
      continue
    }
    if (src[i] === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2)
      i = close === -1 ? src.length : close + 2
      continue
    }
    return i
  }
}

/**
 * Where the JSON actually starts.
 *
 * When the first real character already opens a container we return 0 and let
 * the main pass walk the leading trivia itself, so a leading comment is
 * reported as a stripped comment rather than as discarded junk. Otherwise, if
 * the text contains a container anywhere, everything before it is prose — a log
 * prefix, a shell prompt — and gets dropped. Only when there is no container at
 * all do we treat the whole input as a bare scalar.
 */
function findJsonStart(src: string): number {
  const first = src[skipTrivia(src, 0)]
  if (first === '{' || first === '[') return 0
  const container = src.search(/[[{]/)
  return container === -1 ? 0 : container
}

interface StringScan {
  /** The rewritten literal, double quotes included. */
  value: string
  /** Index just past the closing quote. */
  end: number
  fromSingle: boolean
  fromSmart: boolean
  fixedEscape: boolean
  rawControl: boolean
  unterminated: boolean
}

/**
 * Consumes one string literal starting at `start`, whatever quote style opened
 * it, and re-emits it as a strict JSON string. Content is copied verbatim apart
 * from what JSON refuses to carry: raw control characters, an inner `"` that
 * was safe under single quotes, and escapes JSON does not define.
 */
function scanString(src: string, start: number): StringScan {
  const open = src[start]
  const closers = closersFor(open)
  const body: string[] = []
  let i = start + 1
  let unterminated = true
  let fixedEscape = false
  let rawControl = false

  while (i < src.length) {
    const ch = src[i]

    if (ch === '\\') {
      const next = src[i + 1]
      if (next === undefined) {
        // A backslash with nothing to escape; dropping it is the only option.
        fixedEscape = true
        i += 1
        break
      }
      if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(src.slice(i + 2, i + 6))) {
        body.push(src.slice(i, i + 6))
        i += 6
        continue
      }
      if (VALID_ESCAPES.has(next)) {
        body.push(`\\${next}`)
        i += 2
        continue
      }
      // `\'` in a single-quoted string, `\x41`, a stray `\d` in a regex someone
      // pasted: JSON has no such escape, so keep the character, lose the slash.
      body.push(escapeChar(next))
      fixedEscape = true
      i += 2
      continue
    }

    if (closers.has(ch)) {
      unterminated = false
      i += 1
      break
    }

    if (ch === '"') {
      // Only reachable inside a single- or smart-quoted string, where a bare
      // double quote is ordinary content that must now be escaped.
      body.push('\\"')
      i += 1
      continue
    }

    if (ch < ' ') {
      body.push(escapeChar(ch))
      rawControl = true
      i += 1
      continue
    }

    body.push(ch)
    i += 1
  }

  return {
    value: `"${body.join('')}"`,
    end: i,
    fromSingle: open === "'",
    fromSmart: SMART_DOUBLE.includes(open) || SMART_SINGLE.includes(open),
    fixedEscape,
    rawControl,
    unterminated,
  }
}

/** Index just past a bare token: a run that is neither quoted nor punctuation. */
function scanBareToken(src: string, start: number): number {
  let i = start
  while (i < src.length) {
    const ch = src[i]
    if (isSpace(ch) || TOKEN_BREAKS.has(ch) || QUOTES.has(ch)) break
    if (ch === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) break
    i += 1
  }
  return i
}

/** Collects the change log, keeping the first mention of each distinct fix. */
class ChangeLog {
  private readonly seen = new Set<string>()
  readonly entries: string[] = []

  note(message: string): void {
    if (this.seen.has(message)) return
    this.seen.add(message)
    this.entries.push(message)
  }
}

/** Turns a bare token into the JSON text it most plausibly meant. */
function renderBareToken(token: string, isKey: boolean, log: ChangeLog): string {
  if (isKey) {
    log.note('quoted an unquoted key')
    return JSON.stringify(token)
  }
  if (token === 'true' || token === 'false' || token === 'null') return token
  if (NON_JSON_LITERALS.has(token)) {
    log.note(`replaced ${token} with null`)
    return 'null'
  }
  if (JSON_NUMBER.test(token)) return token
  const asNumber = Number(token)
  if (Number.isFinite(asNumber)) {
    // `.5`, `1.`, `+7`, `0x1f`: real numbers written in a spelling JSON rejects.
    log.note('normalised a number literal')
    return String(asNumber)
  }
  log.note('quoted a bare value as a string')
  return JSON.stringify(token)
}

interface RepairPass {
  text: string
  changes: string[]
}

function runRepair(src: string): RepairPass {
  const out: string[] = []
  const log = new ChangeLog()
  /** Closing brackets still owed, innermost last. */
  const stack: string[] = []

  /** Index in `out` of the last chunk that is not pure whitespace. */
  const lastSignificant = (): number => {
    for (let k = out.length - 1; k >= 0; k -= 1) {
      if (out[k].trim() !== '') return k
    }
    return -1
  }

  /** Drops a comma that ended up directly before a closing bracket. */
  const dropTrailingComma = (): void => {
    const index = lastSignificant()
    if (index >= 0 && out[index] === ',') {
      out.splice(index, 1)
      log.note('removed a trailing comma')
    }
  }

  const start = findJsonStart(src)
  if (start > 0 && src.slice(0, start).trim() !== '') log.note('discarded text before the JSON')

  let i = start
  while (i < src.length) {
    const ch = src[i]

    if (isSpace(ch)) {
      out.push(ch)
      i += 1
      continue
    }

    if (ch === '/' && src[i + 1] === '/') {
      const newline = src.indexOf('\n', i)
      i = newline === -1 ? src.length : newline
      log.note('stripped a line comment')
      continue
    }

    if (ch === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2)
      i = close === -1 ? src.length : close + 2
      log.note('stripped a block comment')
      continue
    }

    if (QUOTES.has(ch)) {
      const scan = scanString(src, i)
      if (scan.fromSingle) log.note('converted a single-quoted string to double quotes')
      if (scan.fromSmart) log.note('replaced smart quotes with straight quotes')
      if (scan.fixedEscape) log.note('fixed an invalid string escape')
      if (scan.rawControl) log.note('escaped a control character inside a string')
      if (scan.unterminated) log.note('closed an unterminated string')
      out.push(scan.value)
      i = scan.end
      if (stack.length === 0) break
      continue
    }

    if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']')
      out.push(ch)
      i += 1
      continue
    }

    if (ch === '}' || ch === ']') {
      dropTrailingComma()
      i += 1
      if (stack.length === 0) {
        log.note('discarded an unmatched closing bracket')
        continue
      }
      const expected = stack.pop() as string
      if (expected !== ch) log.note('corrected a mismatched closing bracket')
      out.push(expected)
      if (stack.length === 0) break
      continue
    }

    if (ch === ',') {
      const index = lastSignificant()
      const previous = index === -1 ? '' : out[index]
      if (
        previous === '' ||
        previous === ',' ||
        previous === '[' ||
        previous === '{' ||
        previous === ':'
      ) {
        log.note('removed a stray comma')
      } else {
        out.push(',')
      }
      i += 1
      continue
    }

    if (ch === ':') {
      out.push(':')
      i += 1
      continue
    }

    const end = scanBareToken(src, i)
    if (end === i) {
      log.note('discarded an unexpected character')
      i += 1
      continue
    }
    const token = src.slice(i, end)
    const insideObject = stack[stack.length - 1] === '}'
    const isKey = insideObject && src[skipTrivia(src, end)] === ':'
    out.push(renderBareToken(token, isKey, log))
    i = end
    if (stack.length === 0) break
  }

  if (i < src.length && src.slice(i).trim() !== '') log.note('discarded text after the JSON')

  while (stack.length > 0) {
    dropTrailingComma()
    out.push(stack.pop() as string)
    log.note('added a missing closing bracket')
  }

  return { text: out.join(''), changes: log.entries }
}

/**
 * Rewrites loose JSON as strict JSON.
 *
 * Input that already parses is returned byte for byte with an empty change
 * list: formatting is the user's business, not the repairer's. Input the pass
 * cannot rescue comes back with the parser's own message, so the caller can
 * show why rather than just that it failed.
 */
export function repairJson(raw: string): RepairResult {
  if (!raw.trim()) return { ok: false, error: 'Input is empty' }

  try {
    JSON.parse(raw)
    return { ok: true, text: raw, changes: [] }
  } catch {
    // Not valid yet — that is the whole point; fall through to the repair pass.
  }

  const { text, changes } = runRepair(raw)
  try {
    JSON.parse(text)
  } catch (e) {
    return { ok: false, changes, error: (e as Error).message }
  }
  return { ok: true, text, changes }
}
