// ─────────────────────────────────────────────
//  CSV import: the inverse of `csv.ts`
//
//  Reading follows the same RFC 4180 rules the exporter writes: a field may be
//  wrapped in double quotes, an embedded quote is doubled, and a quoted field
//  may span lines. Anything the exporter produces must come back through here
//  unchanged, so the two files have to agree character for character.
//
//  The parser is deliberately forgiving about everything RFC 4180 leaves open —
//  LF or CRLF endings, blank lines, ragged records — because a CSV that came
//  out of a spreadsheet, a shell pipeline or a bug tracker is never clean, and
//  refusing to read it teaches the user nothing.
// ─────────────────────────────────────────────

export interface CsvParseOptions {
  /** Field separator. Detected from the first record when omitted. */
  delimiter?: string
  /** Turn `42`, `true` and `null` into real JSON values. Defaults to true. */
  inferTypes?: boolean
}

export interface CsvParseResult {
  rows: Record<string, unknown>[]
  /** Column names in header order, kept even when there are no data rows. */
  columns: string[]
  error?: string
}

/** Separators worth guessing between; comma wins any tie. */
const DELIMITERS = [',', ';', '\t']

/** A number spelled exactly as JSON spells it — nothing else is converted. */
const NUMBER_LITERAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

/**
 * Counts candidate separators across the first record only, skipping quoted
 * runs so a comma inside `"Smith, John"` cannot outvote the real separator.
 */
function detectDelimiter(text: string): string {
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]))
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch !== '"') continue
      if (text[i + 1] === '"') i += 1
      else quoted = false
      continue
    }
    if (ch === '"') {
      quoted = true
      continue
    }
    if (ch === '\n' || ch === '\r') break
    const seen = counts.get(ch)
    if (seen !== undefined) counts.set(ch, seen + 1)
  }

  let best = ','
  let bestCount = 0
  for (const delimiter of DELIMITERS) {
    const count = counts.get(delimiter) ?? 0
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }
  return best
}

interface SplitResult {
  records: string[][]
  error?: string
}

/** Splits the text into records of raw field strings. */
function splitRecords(text: string, delimiter: string): SplitResult {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false
  /** No character has landed in the current field yet, so a `"` can open it. */
  let atFieldStart = true

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
        continue
      }
      field += ch
      continue
    }

    if (ch === '"' && atFieldStart) {
      quoted = true
      atFieldStart = false
      continue
    }

    if (ch === delimiter) {
      record.push(field)
      field = ''
      atFieldStart = true
      continue
    }

    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      record.push(field)
      records.push(record)
      record = []
      field = ''
      atFieldStart = true
      continue
    }

    field += ch
    atFieldStart = false
  }

  if (quoted) {
    return { records: [], error: 'Unterminated quoted field: a closing double quote is missing' }
  }

  // Flush the final record unless the text simply ended with a line break.
  if (field !== '' || record.length > 0) {
    record.push(field)
    records.push(record)
  }

  return { records }
}

/** A record that is one empty field — a blank line, not a row of data. */
function isBlankRecord(record: string[]): boolean {
  return record.length === 1 && record[0].trim() === ''
}

/**
 * Turns header cells into usable keys: blanks become positional names and
 * repeats get a numeric suffix, so no column can silently overwrite another
 * when the records are folded into objects.
 */
function buildColumns(header: string[]): string[] {
  const used = new Set<string>()
  return header.map((cell, index) => {
    const base = cell.trim() === '' ? `column${index + 1}` : cell.trim()
    let name = base
    let suffix = 2
    while (used.has(name)) {
      name = `${base}_${suffix}`
      suffix += 1
    }
    used.add(name)
    return name
  })
}

/**
 * Reads a cell as the JSON value it spells, or leaves it as text.
 *
 * Matching is done on the trimmed cell but the *original* string is returned
 * when nothing matches, so padding inside a genuine text field survives.
 */
function convertField(raw: string): unknown {
  const text = raw.trim()
  if (text === '') return raw

  const lower = text.toLowerCase()
  if (lower === 'true') return true
  if (lower === 'false') return false
  if (lower === 'null') return null

  if (!NUMBER_LITERAL.test(text)) return raw
  const value = Number(text)
  // A long digit run — an account number, a snowflake id, a barcode — does not
  // survive a round trip through a double, so it stays text rather than coming
  // back subtly wrong.
  if (!/[.eE]/.test(text) && !Number.isSafeInteger(value)) return raw
  return value
}

/**
 * Parses CSV into an array of objects keyed by the header row.
 *
 * A header-only file is not an error: it yields no rows but still reports its
 * columns, which is what a grid needs to render an empty table.
 */
export function parseCsv(text: string, options: CsvParseOptions = {}): CsvParseResult {
  // A spreadsheet export usually leads with a BOM; left in place it would
  // become part of the first column's name.
  const source = text.startsWith('\uFEFF') ? text.slice(1) : text
  if (!source.trim()) return { rows: [], columns: [], error: 'Input is empty' }

  const delimiter = options.delimiter ?? detectDelimiter(source)
  const inferTypes = options.inferTypes ?? true

  const { records, error } = splitRecords(source, delimiter)
  if (error) return { rows: [], columns: [], error }

  const populated = records.filter((record) => !isBlankRecord(record))
  const header = populated[0]
  if (!header) return { rows: [], columns: [], error: 'Input is empty' }

  // Ragged records are common; widening the header first means every cell has
  // a column to land in and column names stay unique by construction.
  const width = populated.reduce((max, record) => Math.max(max, record.length), 0)
  const padded = [...header, ...Array.from({ length: width - header.length }, () => '')]
  const columns = buildColumns(padded)

  const rows = populated.slice(1).map((record) => {
    const row: Record<string, unknown> = {}
    for (let i = 0; i < columns.length; i += 1) {
      const cell = record[i] ?? ''
      row[columns[i]] = inferTypes ? convertField(cell) : cell
    }
    return row
  })

  return { rows, columns }
}
