/**
 * Computes a set of JSON paths that differ between two values.
 * Returns a Map<string, 'added' | 'removed' | 'changed'>
 */
export type DiffType = 'added' | 'removed' | 'changed'

export function computeJsonDiff(
  left: unknown,
  right: unknown,
  path = '$'
): Map<string, DiffType> {
  const diffs = new Map<string, DiffType>()

  function walk(l: unknown, r: unknown, currentPath: string) {
    if (l === r) return
    if (l === null || r === null || typeof l !== typeof r) {
      diffs.set(currentPath, 'changed')
      return
    }

    if (typeof l !== 'object') {
      // primitive comparison
      if (l !== r) {
        diffs.set(currentPath, 'changed')
      }
      return
    }

    const lIsArr = Array.isArray(l)
    const rIsArr = Array.isArray(r)

    if (lIsArr !== rIsArr) {
      diffs.set(currentPath, 'changed')
      return
    }

    if (lIsArr && rIsArr) {
      const lArr = l as unknown[]
      const rArr = r as unknown[]
      const maxLen = Math.max(lArr.length, rArr.length)
      for (let i = 0; i < maxLen; i++) {
        const childPath = `${currentPath}[${i}]`
        if (i >= lArr.length) {
          diffs.set(childPath, 'added')
        } else if (i >= rArr.length) {
          diffs.set(childPath, 'removed')
        } else {
          walk(lArr[i], rArr[i], childPath)
        }
      }
      return
    }

    // Both are objects
    const lObj = l as Record<string, unknown>
    const rObj = r as Record<string, unknown>
    const allKeys = new Set([...Object.keys(lObj), ...Object.keys(rObj)])

    for (const key of allKeys) {
      const childPath = `${currentPath}.${key}`
      if (!(key in lObj)) {
        diffs.set(childPath, 'added')
      } else if (!(key in rObj)) {
        diffs.set(childPath, 'removed')
      } else {
        walk(lObj[key], rObj[key], childPath)
      }
    }
  }

  walk(left, right, path)
  return diffs
}

/**
 * Check if a given path or any of its children are in the diff set
 */
export function pathHasDiff(diffs: Map<string, DiffType>, path: string): DiffType | null {
  if (diffs.has(path)) return diffs.get(path)!

  // Check if any child path starts with this path
  for (const [diffPath] of diffs) {
    if (diffPath.startsWith(path + '.') || diffPath.startsWith(path + '[')) {
      return 'changed'
    }
  }
  return null
}
