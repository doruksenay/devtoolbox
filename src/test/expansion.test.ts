import { describe, it, expect } from 'vitest'
import {
  initialExpansion,
  isExpanded,
  setExpanded,
  setExpansionMode,
  AUTO_EXPAND_DEPTH,
} from '../utils/expansion'

describe('initialExpansion', () => {
  it('starts in auto mode with nothing overridden', () => {
    const state = initialExpansion()
    expect(state.mode).toBe('auto')
    expect(state.overrides.size).toBe(0)
  })

  it('hands out a fresh override map each time', () => {
    const first = initialExpansion()
    const second = initialExpansion()
    expect(first.overrides).not.toBe(second.overrides)
  })
})

describe('auto mode', () => {
  // The tree relies on these exact depths for its default view: two levels of
  // structure visible, everything deeper folded away.
  it('expands depth 0 and 1 but not depth 2', () => {
    const state = initialExpansion()
    expect(AUTO_EXPAND_DEPTH).toBe(2)
    expect(isExpanded(state, '$', 0)).toBe(true)
    expect(isExpanded(state, '$.a', 1)).toBe(true)
    expect(isExpanded(state, '$.a.b', 2)).toBe(false)
    expect(isExpanded(state, '$.a.b.c', 3)).toBe(false)
  })
})

describe('mode: all / none', () => {
  it('all expands at any depth', () => {
    const state = setExpansionMode('all')
    expect(isExpanded(state, '$.a.b.c', 99)).toBe(true)
  })

  it('none collapses even the root', () => {
    const state = setExpansionMode('none')
    expect(isExpanded(state, '$', 0)).toBe(false)
  })

  it('drops overrides so the mode really applies', () => {
    const withOverride = setExpanded(initialExpansion(), '$.a', true)
    expect(setExpansionMode('none').overrides.size).toBe(0)
    expect(withOverride.overrides.size).toBe(1)
  })
})

describe('overrides', () => {
  it('beat the depth default in both directions', () => {
    expect(isExpanded(setExpanded(initialExpansion(), '$.a', false), '$.a', 0)).toBe(false)
    expect(isExpanded(setExpanded(initialExpansion(), '$.a', true), '$.a', 9)).toBe(true)
  })

  it('beat an explicit mode in both directions', () => {
    const openInNone = setExpanded(setExpansionMode('none'), '$.a', true)
    expect(isExpanded(openInNone, '$.a', 0)).toBe(true)

    const closedInAll = setExpanded(setExpansionMode('all'), '$.a', false)
    expect(isExpanded(closedInAll, '$.a', 0)).toBe(false)
  })

  it('only affect the node they name', () => {
    const state = setExpanded(setExpansionMode('none'), '$.a', true)
    expect(isExpanded(state, '$.b', 0)).toBe(false)
  })

  it('are replaced, not stacked, when the same node is toggled twice', () => {
    const state = setExpanded(setExpanded(initialExpansion(), '$.a', true), '$.a', false)
    expect(state.overrides.size).toBe(1)
    expect(isExpanded(state, '$.a', 0)).toBe(false)
  })

  it('leave the previous state untouched', () => {
    const state = initialExpansion()
    setExpanded(state, '$.a', false)
    expect(state.overrides.size).toBe(0)
  })
})

describe('search expansion', () => {
  it('overrides an explicit collapse and a none mode', () => {
    const collapsed = setExpanded(setExpansionMode('none'), '$.a', false)
    expect(isExpanded(collapsed, '$.a', 0, new Set(['$.a']))).toBe(true)
  })

  it('does not expand nodes outside the match set', () => {
    const collapsed = setExpansionMode('none')
    expect(isExpanded(collapsed, '$.b', 0, new Set(['$.a']))).toBe(false)
  })

  it('treats null and undefined as no search at all', () => {
    const state = initialExpansion()
    expect(isExpanded(state, '$.a.b', 2, null)).toBe(false)
    expect(isExpanded(state, '$.a.b', 2, undefined)).toBe(false)
  })
})
