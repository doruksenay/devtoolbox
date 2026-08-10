import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent, within } from '@testing-library/react'
import { CommandPalette } from '../components/CommandPalette/CommandPalette'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useAppSelector } from '../context/AppContext'
import { renderWithProviders, resetAppEnvironment } from './testUtils'

/** Every tool the palette advertises, in the order it lists them. */
const TOOL_LABELS = [
  'JSON Editor',
  'Compare',
  'XML',
  'Grid View',
  'JSONPath Query',
  'HAR Viewer',
  'Cron',
  'JWT Decoder',
  'Diagram',
  'Text Cleaner',
  'Tax Calculator',
]

/** Surfaces the selected tab so selection can be asserted on real state. */
function ActiveTabProbe() {
  const activeTab = useAppSelector((state) => state.activeTab)
  return <span data-testid="active-tab">{activeTab}</span>
}

/**
 * Mirrors how `App` wires the palette: the Ctrl+K shortcut lives in
 * `useKeyboardShortcuts`, the palette itself only reads `commandPaletteOpen`.
 */
function Harness() {
  useKeyboardShortcuts()
  return (
    <>
      <ActiveTabProbe />
      <CommandPalette />
    </>
  )
}

function pressCtrlK() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
}

/** Returns the dialog panel; the backdrop is its parent element. */
function openPalette() {
  pressCtrlK()
  return screen.getByRole('dialog', { name: 'Command palette' })
}

function options() {
  return screen.getAllByRole('option')
}

function searchInput() {
  return screen.getByPlaceholderText('Search tools…')
}

function activeTab() {
  return screen.getByTestId('active-tab').textContent
}

function highlightedLabel() {
  const selected = options().find((o) => o.getAttribute('aria-selected') === 'true')
  return selected?.querySelector('.cmd-palette__item-label')?.textContent
}

describe('CommandPalette', () => {
  beforeEach(() => {
    resetAppEnvironment()
  })

  it('mounts closed and reads its open flag from the store', () => {
    // Regression guard: the palette resolves `open` through `useAppSelector`
    // during render, so a selector that referenced its own result would throw a
    // TDZ ReferenceError here instead of failing only in the browser.
    renderWithProviders(<Harness />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(activeTab()).toBe('editor')
  })

  it('opens on Ctrl+K and lists every tool', () => {
    renderWithProviders(<Harness />)

    openPalette()

    expect(options()).toHaveLength(TOOL_LABELS.length)
    expect(
      options().map((o) => o.querySelector('.cmd-palette__item-label')?.textContent),
    ).toEqual(TOOL_LABELS)
  })

  it('opens on Cmd+K for mac keyboards', () => {
    renderWithProviders(<Harness />)

    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('toggles closed when Ctrl+K is pressed again', () => {
    renderWithProviders(<Harness />)

    openPalette()
    pressCtrlK()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('filters the list by label as the user types', () => {
    renderWithProviders(<Harness />)
    openPalette()

    fireEvent.change(searchInput(), { target: { value: 'jwt' } })

    expect(options()).toHaveLength(1)
    expect(options()[0]).toHaveTextContent('JWT Decoder')
  })

  it('also matches against the tool description', () => {
    renderWithProviders(<Harness />)
    openPalette()

    // "cron expressions" appears only in the Cron tool's description.
    fireEvent.change(searchInput(), { target: { value: 'cron expressions' } })

    expect(options()).toHaveLength(1)
    expect(options()[0]).toHaveTextContent('Cron')
  })

  it('matches case-insensitively', () => {
    renderWithProviders(<Harness />)
    openPalette()

    fireEvent.change(searchInput(), { target: { value: 'GRID' } })

    expect(options()).toHaveLength(1)
    expect(options()[0]).toHaveTextContent('Grid View')
  })

  it('shows an empty state when nothing matches', () => {
    renderWithProviders(<Harness />)
    openPalette()

    fireEvent.change(searchInput(), { target: { value: 'zzzzz' } })

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No tools match "zzzzz"')).toBeInTheDocument()
  })

  it('highlights the first entry and moves the highlight with the arrow keys', () => {
    renderWithProviders(<Harness />)
    openPalette()

    expect(highlightedLabel()).toBe('JSON Editor')

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(highlightedLabel()).toBe('Compare')

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(highlightedLabel()).toBe('XML')

    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(highlightedLabel()).toBe('Compare')
  })

  it('clamps the highlight at both ends of the list', () => {
    renderWithProviders(<Harness />)
    openPalette()

    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(highlightedLabel()).toBe('JSON Editor')

    for (let i = 0; i < TOOL_LABELS.length + 5; i++) {
      fireEvent.keyDown(window, { key: 'ArrowDown' })
    }
    expect(highlightedLabel()).toBe(TOOL_LABELS[TOOL_LABELS.length - 1])
  })

  it('resets the highlight to the top when the query changes', () => {
    renderWithProviders(<Harness />)
    openPalette()

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(highlightedLabel()).toBe('XML')

    fireEvent.change(searchInput(), { target: { value: 'j' } })

    expect(options()[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('follows the mouse when hovering an entry', () => {
    renderWithProviders(<Harness />)
    openPalette()

    // React synthesises onMouseEnter from mouseover, so that is what we fire.
    fireEvent.mouseOver(options()[3])

    expect(highlightedLabel()).toBe('Grid View')
  })

  it('switches to the highlighted tool on Enter and closes', () => {
    renderWithProviders(<Harness />)
    openPalette()

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(activeTab()).toBe('compare')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Enter selects within the filtered results, not the unfiltered list', () => {
    renderWithProviders(<Harness />)
    openPalette()

    fireEvent.change(searchInput(), { target: { value: 'tax' } })
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(activeTab()).toBe('tax')
  })

  it('does nothing on Enter when no tool matches', () => {
    renderWithProviders(<Harness />)
    openPalette()

    fireEvent.change(searchInput(), { target: { value: 'zzzzz' } })
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(activeTab()).toBe('editor')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('switches tabs when an entry is clicked', () => {
    renderWithProviders(<Harness />)
    openPalette()

    fireEvent.click(screen.getByRole('option', { name: /HAR Viewer/ }))

    expect(activeTab()).toBe('har')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Escape without changing the active tab', () => {
    renderWithProviders(<Harness />)
    openPalette()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(activeTab()).toBe('editor')
  })

  it('closes when the backdrop is clicked but not when the panel is', () => {
    renderWithProviders(<Harness />)
    const panel = openPalette()
    const backdrop = panel.parentElement as HTMLElement

    fireEvent.click(within(panel).getByRole('listbox'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('badges the entry for the tab that is currently open', () => {
    renderWithProviders(<Harness />)
    openPalette()

    expect(within(screen.getByRole('option', { name: /JSON Editor/ })).getByText('current'))
      .toBeInTheDocument()
    expect(screen.getAllByText('current')).toHaveLength(1)

    fireEvent.click(screen.getByRole('option', { name: /XML/ }))
    openPalette()

    expect(within(screen.getByRole('option', { name: /XML/ })).getByText('current'))
      .toBeInTheDocument()
    expect(screen.getAllByText('current')).toHaveLength(1)
  })

  it('clears the query when reopened after a close', () => {
    renderWithProviders(<Harness />)
    openPalette()

    fireEvent.change(searchInput(), { target: { value: 'jwt' } })
    fireEvent.keyDown(window, { key: 'Escape' })
    openPalette()

    expect(searchInput()).toHaveValue('')
    expect(options()).toHaveLength(TOOL_LABELS.length)
  })

  it('ignores keyboard navigation while it is closed', () => {
    renderWithProviders(<Harness />)

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(activeTab()).toBe('editor')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
