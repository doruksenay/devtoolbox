// ─────────────────────────────────────────────
//  JSONL / NDJSON
//
//  One JSON value per line, no enclosing array — the format log pipelines,
//  BigQuery exports and LLM datasets ship in. Every function here tolerates
//  blank lines and a trailing newline, because every producer emits them
//  differently and none of that is an error the user should have to fix.
//
//  When a line does not parse, the line *number* is what makes the report
//  useful: in a 50k-line export, "unexpected token" alone is unactionable.
// ─────────────────────────────────────────────

export interface JsonlParseResult {
  ok: boolean
  rows?: unknown[]
  /** 1-based number of the offending line. Present only when `ok` is false. */
  line?: number
  error?: string
}

/**
 * How many lines `looksLikeJsonl` inspects. Detection runs on every keystroke
 * in a paste box, so it samples rather than validating the whole document.
 */
const SNIFF_LINES = 20

/** Splits on any line ending, keeping blank lines so numbering stays true. */
function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/)
}

function parses(line: string): boolean {
  try {
    JSON.parse(line)
    return true
  } catch {
    return false
  }
}

/**
 * True when the text is best read as JSONL rather than as one JSON document.
 *
 * A single line is deliberately not enough: `{"a":1}` on its own is ordinary
 * JSON, and calling it JSONL would send it down the wrong path. From two lines
 * up, every sampled line parsing on its own is a shape no pretty-printed JSON
 * document has — its lines are fragments like `{` or `"a": 1,`.
 */
export function looksLikeJsonl(text: string): boolean {
  const lines = splitLines(text).filter((line) => line.trim() !== '')
  if (lines.length < 2) return false
  return lines.slice(0, SNIFF_LINES).every((line) => parses(line.trim()))
}

/** Parses JSONL into one value per non-blank line. */
export function parseJsonl(text: string): JsonlParseResult {
  const lines = splitLines(text)
  const rows: unknown[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (line === '') continue
    try {
      rows.push(JSON.parse(line))
    } catch (e) {
      return { ok: false, line: index + 1, error: `Line ${index + 1}: ${(e as Error).message}` }
    }
  }

  if (rows.length === 0) return { ok: false, error: 'Input is empty' }
  return { ok: true, rows }
}

/**
 * Renders values as JSONL. No trailing newline is added, so the result round
 * trips through `parseJsonl` unchanged; `undefined` — which `JSON.stringify`
 * would drop entirely, silently shortening the file — is written as `null`.
 */
export function toJsonl(rows: readonly unknown[]): string {
  return rows
    .map((row) => {
      const text = JSON.stringify(row)
      return typeof text === 'string' ? text : 'null'
    })
    .join('\n')
}
