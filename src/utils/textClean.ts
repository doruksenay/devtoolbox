// ─────────────────────────────────────────────
//  Text Cleaner
//  Decodes HTML entities (&amp;, &#10;, &nbsp; …) and detects / removes
//  invisible or "problematic" characters (nbsp, zero-width spaces, BOM …)
//  that frequently sneak into copy-pasted code.
// ─────────────────────────────────────────────

export interface CleanOptions {
  /** Decode HTML entities: &amp; → &, &#10; → \n, &nbsp; → (nbsp) */
  decodeEntities: boolean
  /** Replace non-breaking / special spaces with a regular space */
  replaceSpaces: boolean
  /** Remove zero-width & other invisible formatting characters */
  removeInvisibles: boolean
  /** Trim trailing whitespace at the end of every line */
  trimTrailing: boolean
}

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
  decodeEntities: true,
  replaceSpaces: true,
  removeInvisibles: true,
  trimTrailing: false,
}

export interface CharFinding {
  /** Human readable name of the character */
  label: string
  /** Unicode code point, e.g. "U+00A0" */
  code: string
  /** How many times it occurs in the input */
  count: number
  /** Which cleaning category the character belongs to */
  kind: 'space' | 'invisible'
}

export interface CleanResult {
  output: string
  /** Detected invisible / special-space characters in the *input* */
  findings: CharFinding[]
  /** Number of HTML entities detected in the *input* */
  entityCount: number
}

// A small, common set of named HTML entities. Numeric entities (&#nn; / &#xNN;)
// are handled generically, so this only needs the frequently-used names.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201C',
  rdquo: '\u201D',
  laquo: '\u00AB',
  raquo: '\u00BB',
  deg: '\u00B0',
  plusmn: '\u00B1',
  times: '\u00D7',
  divide: '\u00F7',
  euro: '\u20AC',
  pound: '\u00A3',
  cent: '\u00A2',
  sect: '\u00A7',
  para: '\u00B6',
  middot: '\u00B7',
}

const ENTITY_RE = /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g

/** Decode a single entity token (without surrounding & and ;). */
function decodeEntityToken(token: string): string | null {
  if (token[0] === '#') {
    let codePoint: number
    if (token[1] === 'x' || token[1] === 'X') {
      codePoint = parseInt(token.slice(2), 16)
    } else {
      codePoint = parseInt(token.slice(1), 10)
    }
    if (Number.isNaN(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return null
    try {
      return String.fromCodePoint(codePoint)
    } catch {
      return null
    }
  }
  const named = NAMED_ENTITIES[token]
  return named ?? null
}

/** Decode all recognised HTML entities in a string. */
export function decodeHtmlEntities(input: string): string {
  return input.replace(ENTITY_RE, (match, token: string) => {
    const decoded = decodeEntityToken(token)
    return decoded ?? match
  })
}

/** Count how many HTML entities would be decoded in the input. */
function countEntities(input: string): number {
  let count = 0
  for (const match of input.matchAll(ENTITY_RE)) {
    if (decodeEntityToken(match[1]) !== null) count++
  }
  return count
}

// Special-space characters that are usually meant to be a normal space.
const SPACE_CHARS: Record<string, string> = {
  '\u00A0': 'No-Break Space (NBSP)',
  '\u1680': 'Ogham Space Mark',
  '\u2000': 'En Quad',
  '\u2001': 'Em Quad',
  '\u2002': 'En Space',
  '\u2003': 'Em Space',
  '\u2004': 'Three-Per-Em Space',
  '\u2005': 'Four-Per-Em Space',
  '\u2006': 'Six-Per-Em Space',
  '\u2007': 'Figure Space',
  '\u2008': 'Punctuation Space',
  '\u2009': 'Thin Space',
  '\u200A': 'Hair Space',
  '\u202F': 'Narrow No-Break Space',
  '\u205F': 'Medium Mathematical Space',
  '\u3000': 'Ideographic Space',
}

// Zero-width / invisible formatting characters that should generally be removed.
const INVISIBLE_CHARS: Record<string, string> = {
  '\u200B': 'Zero-Width Space (ZWSP)',
  '\u200C': 'Zero-Width Non-Joiner (ZWNJ)',
  '\u200D': 'Zero-Width Joiner (ZWJ)',
  '\u2060': 'Word Joiner',
  '\uFEFF': 'Byte Order Mark / ZWNBSP',
  '\u00AD': 'Soft Hyphen',
  '\u180E': 'Mongolian Vowel Separator',
  '\u200E': 'Left-to-Right Mark',
  '\u200F': 'Right-to-Left Mark',
  '\u2028': 'Line Separator',
  '\u2029': 'Paragraph Separator',
  '\u0085': 'Next Line (NEL)',
}

function codePointLabel(ch: string): string {
  const cp = ch.codePointAt(0) ?? 0
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')
}

/** Detect special spaces and invisible characters present in the input. */
export function detectCharacters(input: string): CharFinding[] {
  const counts = new Map<string, number>()
  for (const ch of input) {
    if (SPACE_CHARS[ch] || INVISIBLE_CHARS[ch]) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1)
    }
  }

  const findings: CharFinding[] = []
  for (const [ch, count] of counts) {
    const isSpace = Boolean(SPACE_CHARS[ch])
    findings.push({
      label: isSpace ? SPACE_CHARS[ch] : INVISIBLE_CHARS[ch],
      code: codePointLabel(ch),
      count,
      kind: isSpace ? 'space' : 'invisible',
    })
  }
  // Stable order: highest count first, then by code point.
  findings.sort((a, b) => (b.count - a.count) || a.code.localeCompare(b.code))
  return findings
}

/** Clean the input text according to the provided options. */
export function cleanText(input: string, options: CleanOptions): CleanResult {
  const entityCount = countEntities(input)
  const findings = detectCharacters(input)

  let output = input

  // 1. Decode entities first so that e.g. "&nbsp;" becomes a real NBSP that
  //    can then be normalised by the space/invisible passes below.
  if (options.decodeEntities) {
    output = decodeHtmlEntities(output)
  }

  // 2. Replace special spaces with a regular space.
  if (options.replaceSpaces) {
    output = output.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
  }

  // 3. Strip zero-width / invisible characters.
  if (options.removeInvisibles) {
    output = output.replace(/[\u200B-\u200F\u2028\u2029\u2060\uFEFF\u00AD\u180E\u0085]/g, '')
  }

  // 4. Trim trailing whitespace on each line.
  if (options.trimTrailing) {
    output = output.replace(/[ \t]+$/gm, '')
  }

  return { output, findings, entityCount }
}
