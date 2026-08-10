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
 * An empty path replaces the root.
 *
 * An edit that changes nothing — a missing key, an out-of-range index, or a
 * value that is already there — returns `root` itself rather than a fresh copy,
 * so a no-op never propagates as a document change.
 */
export function setAtPath(root: unknown, segments: readonly PathSegment[], value: unknown): unknown {
  if (segments.length === 0) return value
  if (!isContainer(root)) return root

  const [head, ...rest] = segments

  if (Array.isArray(root)) {
    const index = Number(head)
    if (!Number.isInteger(index) || index < 0 || index >= root.length) return root
    const nextChild = setAtPath(root[index], rest, value)
    if (Object.is(nextChild, root[index])) return root
    const next = [...root]
    next[index] = nextChild
    return next
  }

  const obj = root as Record<string, unknown>
  const key = String(head)
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return root
  const nextChild = setAtPath(obj[key], rest, value)
  if (Object.is(nextChild, obj[key])) return root
  const next = { ...obj }
  defineOwn(next, key, nextChild)
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
 * Removes the object key or array element that `segments` points at. Array
 * elements are spliced out, so the indices after them shift down. The root
 * itself cannot be removed — there would be no document left.
 */
export function deleteAtPath(root: unknown, segments: readonly PathSegment[]): unknown {
  if (segments.length === 0) return root

  const parentSegments = segments.slice(0, -1)
  const last = segments[segments.length - 1]
  const parent = getAtPath(root, parentSegments)
  if (!isContainer(parent)) return root

  if (Array.isArray(parent)) {
    const index = Number(last)
    if (!Number.isInteger(index) || index < 0 || index >= parent.length) return root
    return setAtPath(root, parentSegments, parent.filter((_, i) => i !== index))
  }

  const obj = parent as Record<string, unknown>
  const key = String(last)
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return root

  const next: Record<string, unknown> = {}
  for (const existing of Object.keys(obj)) {
    if (existing !== key) defineOwn(next, existing, obj[existing])
  }
  return setAtPath(root, parentSegments, next)
}

/** Base name for keys added to an object; numbered when it is already taken. */
const NEW_KEY_BASE = 'newKey'

function uniqueKey(obj: Record<string, unknown>): string {
  if (!Object.prototype.hasOwnProperty.call(obj, NEW_KEY_BASE)) return NEW_KEY_BASE
  let suffix = 2
  while (Object.prototype.hasOwnProperty.call(obj, `${NEW_KEY_BASE}${suffix}`)) suffix++
  return `${NEW_KEY_BASE}${suffix}`
}

/**
 * Appends an empty entry to the container at `segments` — a `null` item for an
 * array, a `null` under a fresh key for an object. Returns the new document
 * along with the path of the entry, so the caller can open its editor.
 * Returns `null` when the target is not a container.
 */
export function appendChildAtPath(
  root: unknown,
  segments: readonly PathSegment[]
): { root: unknown; segments: PathSegment[] } | null {
  const container = getAtPath(root, segments)
  if (!isContainer(container)) return null

  if (Array.isArray(container)) {
    const next = [...container, null]
    return {
      root: setAtPath(root, segments, next),
      segments: [...segments, container.length],
    }
  }

  const obj = container as Record<string, unknown>
  const key = uniqueKey(obj)
  const next = { ...obj }
  defineOwn(next, key, null)
  return {
    root: setAtPath(root, segments, next),
    segments: [...segments, key],
  }
}

/** True when both paths address the same node. */
export function segmentsEqual(a: readonly PathSegment[], b: readonly PathSegment[]): boolean {
  return a.length === b.length && segmentsStartWith(a, b)
}

/** True when `prefix` addresses `full` or one of its ancestors. */
export function segmentsStartWith(prefix: readonly PathSegment[], full: readonly PathSegment[]): boolean {
  if (prefix.length > full.length) return false
  return prefix.every((segment, i) => String(segment) === String(full[i]))
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
