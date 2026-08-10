// ─────────────────────────────────────────────
//  Immutable edits on parsed JSON, addressed by path segments
//
//  The tree renders string paths like `$.a[0].b` for search and diff lookups,
//  but those are ambiguous when a key itself contains `.` or `[`. Edits are
//  addressed by the segment array the tree already walks instead, so a key
//  named `a.b` is never confused with a nested `b` under `a`.
// ─────────────────────────────────────────────

export type PathSegment = string | number

export type RenameResult =
  | { ok: true; root: unknown }
  | { ok: false; reason: 'empty' | 'duplicate' | 'unsupported' }

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === 'object'
}

/**
 * Assigns an own property even when the key is `__proto__`, which plain
 * assignment would route to the prototype instead of the object itself.
 */
function defineOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  })
}

/** Reads the value at `segments`, or `undefined` if the path does not exist. */
export function getAtPath(root: unknown, segments: readonly PathSegment[]): unknown {
  let current = root
  for (const segment of segments) {
    if (!isContainer(current)) return undefined
    current = Array.isArray(current)
      ? current[Number(segment)]
      : (current as Record<string, unknown>)[String(segment)]
  }
  return current
}

/**
 * Returns a copy of `root` with the value at `segments` replaced. Only the
 * containers along the path are cloned; untouched subtrees keep their identity.
 * An empty path replaces the root. A path that does not exist is a no-op.
 */
export function setAtPath(root: unknown, segments: readonly PathSegment[], value: unknown): unknown {
  if (segments.length === 0) return value
  if (!isContainer(root)) return root

  const [head, ...rest] = segments

  if (Array.isArray(root)) {
    const index = Number(head)
    if (!Number.isInteger(index) || index < 0 || index >= root.length) return root
    const next = [...root]
    next[index] = setAtPath(root[index], rest, value)
    return next
  }

  const obj = root as Record<string, unknown>
  const key = String(head)
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return root
  const next = { ...obj }
  defineOwn(next, key, setAtPath(obj[key], rest, value))
  return next
}

/**
 * Renames the object key that `segments` points at, preserving key order so the
 * document does not reshuffle under the user. Array indices cannot be renamed,
 * and a rename onto an existing sibling key is rejected rather than silently
 * dropping that sibling.
 */
export function renameKeyAtPath(
  root: unknown,
  segments: readonly PathSegment[],
  newKey: string
): RenameResult {
  if (segments.length === 0) return { ok: false, reason: 'unsupported' }

  const oldKey = segments[segments.length - 1]
  if (typeof oldKey !== 'string') return { ok: false, reason: 'unsupported' }

  if (newKey === oldKey) return { ok: true, root }
  if (!newKey) return { ok: false, reason: 'empty' }

  const parentSegments = segments.slice(0, -1)
  const parent = getAtPath(root, parentSegments)
  if (!isContainer(parent) || Array.isArray(parent)) return { ok: false, reason: 'unsupported' }

  const parentObj = parent as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(parentObj, oldKey)) {
    return { ok: false, reason: 'unsupported' }
  }
  if (Object.prototype.hasOwnProperty.call(parentObj, newKey)) {
    return { ok: false, reason: 'duplicate' }
  }

  const renamed: Record<string, unknown> = {}
  for (const key of Object.keys(parentObj)) {
    defineOwn(renamed, key === oldKey ? newKey : key, parentObj[key])
  }

  return { ok: true, root: setAtPath(root, parentSegments, renamed) }
}

/**
 * Parses the text typed into a value editor.
 *
 * Strings stay strings so editing prose never needs quoting; every other type
 * is read back as a JSON literal, which is also how a value changes type
 * (typing `null` over a number, `{"a":1}` over a boolean, and so on).
 */
export function parseEditedValue(
  original: unknown,
  text: string
): { ok: true; value: unknown } | { ok: false } {
  if (typeof original === 'string') return { ok: true, value: text }
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false }
  }
}

/** The text a value editor starts with — the inverse of `parseEditedValue`. */
export function valueToEditText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/**
 * The text the copy button puts on the clipboard. Strings are copied bare
 * (copying a URL should not include quotes); everything else is copied as
 * formatted JSON so a whole subtree pastes back as valid JSON.
 */
export function valueToCopyText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}
