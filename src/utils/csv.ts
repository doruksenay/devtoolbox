// ─────────────────────────────────────────────
//  CSV export for the array-of-objects grid
//
//  Columns are derived exactly the way GridTab builds its mini-table headers —
//  the union of every row's keys in first-appearance order — so a downloaded
//  file has the same columns, in the same order, as the table on screen.
//
//  Output follows RFC 4180: CRLF between records, fields quoted only when they
//  need it, embedded quotes doubled.
// ─────────────────────────────────────────────

/** Fields containing any of these cannot be written bare. */
const NEEDS_QUOTING = /[",\r\n]/

/**
 * Leading characters a spreadsheet may read as the start of a formula. TAB and
 * CR are included because Excel strips them and then evaluates what follows.
 */
const FORMULA_LEADERS = new Set(['=', '+', '@', '-', '\t', '\r'])

/**
 * A plain number literal — optional sign, digits, optional fraction/exponent.
 * Used to keep the injection guard away from ordinary negative numbers.
 */
const NUMBER_LITERAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

/**
 * True when a field must be escaped so a spreadsheet treats it as text.
 *
 * `-42` and `+1.5e3` start with a trigger character but are just numbers, and
 * prefixing them with `'` would import them as text and break sorting, sums and
 * charts — a real cost paid on almost every export, against no risk, since a
 * bare number literal has nothing left to evaluate. So anything that parses as
 * a complete number literal is left alone; a payload like `-2+3+cmd|'/C calc'`
 * is not a complete literal and is still guarded.
 */
function needsFormulaGuard(text: string): boolean {
  if (text.length === 0) return false
  if (!FORMULA_LEADERS.has(text[0])) return false
  return !NUMBER_LITERAL.test(text)
}

/** The text a value contributes to a cell, before escaping. */
function cellText(value: unknown): string {
  // `undefined` covers an absent key: a row that simply lacks this column.
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  // Objects and arrays go in compact, so one row stays on one line.
  return JSON.stringify(value)
}

/** Applies the formula guard, then RFC 4180 quoting. */
function escapeField(text: string): string {
  const guarded = needsFormulaGuard(text) ? `'${text}` : text
  if (!NEEDS_QUOTING.test(guarded)) return guarded
  return `"${guarded.replace(/"/g, '""')}"`
}

/**
 * The columns of an array of objects: every key that appears in any row, in the
 * order the keys are first seen. A `Set` keeps insertion order, which is what
 * makes this match the grid's header row.
 */
export function deriveColumns(rows: Record<string, unknown>[]): string[] {
  const columns = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) columns.add(key)
  }
  return Array.from(columns)
}

/**
 * Renders `rows` as CSV with `columns` as the header. Records are separated by
 * CRLF with no terminator after the last one, so an empty `rows` yields just
 * the header line rather than a stray blank record.
 */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.map(escapeField).join(',')]
  for (const row of rows) {
    lines.push(columns.map((column) => escapeField(cellText(row[column]))).join(','))
  }
  return lines.join('\r\n')
}

/** Saves `csv` to the user's downloads as `filename`. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
