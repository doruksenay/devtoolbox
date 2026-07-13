/**
 * Search helpers for the JSON tree view.
 *
 * `computeTreeMatches` walks a parsed JSON value and returns every path whose
 * key or leaf value contains the query (case-insensitive), in depth-first
 * (visual) order, plus the set of ancestor paths that must be expanded so each
 * match becomes visible.
 */

export interface TreeSearchResult {
  /** Paths that match the query, in depth-first (visual tree) order. */
  matches: string[]
  /** Ancestor paths that must be expanded so every match is visible. */
  expandPaths: Set<string>
}

function isContainer(val: unknown): val is Record<string, unknown> | unknown[] {
  return val !== null && typeof val === 'object'
}

export function computeTreeMatches(data: unknown, rawQuery: string): TreeSearchResult {
  const query = rawQuery.trim().toLowerCase()
  const matches: string[] = []
  const expandPaths = new Set<string>()

  if (!query) return { matches, expandPaths }

  function record(path: string, ancestors: string[]) {
    matches.push(path)
    for (const ancestor of ancestors) expandPaths.add(ancestor)
  }

  function walk(value: unknown, path: string, keyName: string | null, ancestors: string[]) {
    const keyMatches = keyName !== null && keyName.toLowerCase().includes(query)

    if (isContainer(value)) {
      if (keyMatches) record(path, ancestors)
      const nextAncestors = [...ancestors, path]
      if (Array.isArray(value)) {
        value.forEach((child, i) => walk(child, `${path}[${i}]`, null, nextAncestors))
      } else {
        for (const [k, child] of Object.entries(value)) {
          walk(child, `${path}.${k}`, k, nextAncestors)
        }
      }
      return
    }

    const valueText = value === null ? 'null' : String(value)
    if (keyMatches || valueText.toLowerCase().includes(query)) {
      record(path, ancestors)
    }
  }

  walk(data, '$', null, [])
  return { matches, expandPaths }
}

export interface HighlightSegment {
  text: string
  match: boolean
}

/**
 * Splits `text` into consecutive segments, flagging the ones that match
 * `query` (case-insensitive) so they can be highlighted. Returns a single
 * non-matching segment when the query is empty or absent.
 */
export function splitHighlight(text: string, rawQuery: string): HighlightSegment[] {
  const query = rawQuery.trim()
  if (!query) return [{ text, match: false }]

  const segments: HighlightSegment[] = []
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  let index = 0

  while (index < text.length) {
    const found = lowerText.indexOf(lowerQuery, index)
    if (found === -1) {
      segments.push({ text: text.slice(index), match: false })
      break
    }
    if (found > index) {
      segments.push({ text: text.slice(index, found), match: false })
    }
    segments.push({ text: text.slice(found, found + query.length), match: true })
    index = found + query.length
  }

  return segments
}
