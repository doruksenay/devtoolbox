// ─────────────────────────────────────────────
//  Shared expansion model for collapsible views
//
//  Lives outside any one view because both the grid and the tree need the same
//  answer to "is this node open?", and a virtualised tree has to answer it
//  without rendering the node first.
// ─────────────────────────────────────────────

/**
 * Expansion is stored as a base mode plus per-node overrides rather than a set
 * of open paths, because "expanded" has a default that depends on depth. A set
 * alone cannot distinguish "never touched" from "explicitly collapsed", so
 * Collapse All followed by expanding one node would be indistinguishable from
 * the initial state.
 */
export type ExpansionMode = 'auto' | 'all' | 'none'

export interface ExpansionState {
  mode: ExpansionMode
  overrides: Map<string, boolean>
}

/** Nodes shallower than this start expanded in 'auto' mode. */
export const AUTO_EXPAND_DEPTH = 2

export function initialExpansion(): ExpansionState {
  return { mode: 'auto', overrides: new Map() }
}

export function isExpanded(
  state: ExpansionState,
  path: string,
  depth: number,
  searchExpandPaths?: Set<string> | null
): boolean {
  // A search match inside this subtree wins over everything: the point of
  // searching is to see the hit.
  if (searchExpandPaths?.has(path)) return true

  const override = state.overrides.get(path)
  if (override !== undefined) return override

  if (state.mode === 'all') return true
  if (state.mode === 'none') return false
  return depth < AUTO_EXPAND_DEPTH
}

export function setExpanded(state: ExpansionState, path: string, open: boolean): ExpansionState {
  const overrides = new Map(state.overrides)
  overrides.set(path, open)
  return { mode: state.mode, overrides }
}

/** Expand All / Collapse All drop per-node overrides so the mode really applies. */
export function setExpansionMode(mode: ExpansionMode): ExpansionState {
  return { mode, overrides: new Map() }
}
