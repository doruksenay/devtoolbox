import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent, within } from '@testing-library/react'
import { Sidebar } from '../components/Sidebar/Sidebar'
import { useAppSelector } from '../context/AppContext'
import { renderWithProviders, resetAppEnvironment, STORAGE_KEY } from './testUtils'

const TOOL_LABELS = [
  'JSON Editor',
  'JSON Compare',
  'XML Editor',
  'Grid View',
  'Diagram',
  'JSONPath',
  'HAR Viewer',
  'Cron',
  'JWT Decoder',
  'Text Cleaner',
  'Tax Calculator',
]

function StateProbe() {
  const activeTab = useAppSelector((state) => state.activeTab)
  const collapsed = useAppSelector((state) => state.sidebarCollapsed)
  return (
    <>
      <span data-testid="active-tab">{activeTab}</span>
      <span data-testid="collapsed">{String(collapsed)}</span>
    </>
  )
}

function Harness() {
  return (
    <>
      <StateProbe />
      <Sidebar />
    </>
  )
}

function activeTab() {
  return screen.getByTestId('active-tab').textContent
}

function nav() {
  return screen.getByRole('navigation')
}

describe('Sidebar', () => {
  beforeEach(() => {
    resetAppEnvironment()
  })

  it('lists every tool, grouped under its section heading', () => {
    renderWithProviders(<Harness />)

    for (const label of TOOL_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(within(nav()).getAllByRole('button')).toHaveLength(TOOL_LABELS.length)

    expect(screen.getByText('Edit & View')).toBeInTheDocument()
    expect(screen.getByText('Analyze')).toBeInTheDocument()
    expect(screen.getByText('Utilities')).toBeInTheDocument()
  })

  it('marks the editor as the current page on first render', () => {
    renderWithProviders(<Harness />)

    expect(screen.getByRole('button', { name: 'JSON Editor' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'HAR Viewer' })).not.toHaveAttribute('aria-current')
  })

  it('switches the active tab when a tool is clicked', () => {
    renderWithProviders(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'HAR Viewer' }))

    expect(activeTab()).toBe('har')
    expect(screen.getByRole('button', { name: 'HAR Viewer' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'HAR Viewer' }).className).toContain(
      'sidebar__item--active',
    )
  })

  it('moves the active marker off the previous tool', () => {
    renderWithProviders(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Cron' }))
    fireEvent.click(screen.getByRole('button', { name: 'JWT Decoder' }))

    expect(activeTab()).toBe('jwt')
    expect(screen.getByRole('button', { name: 'Cron' })).not.toHaveAttribute('aria-current')
    expect(screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-current'))).toHaveLength(
      1,
    )
  })

  it('collapses and expands, hiding the labels while collapsed', () => {
    renderWithProviders(<Harness />)
    const aside = screen.getByLabelText('Tool navigation')

    expect(screen.getByText('JSON Editor')).toBeInTheDocument()
    expect(aside.className).not.toContain('sidebar--collapsed')

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(screen.getByTestId('collapsed').textContent).toBe('true')
    expect(aside.className).toContain('sidebar--collapsed')
    // Labels disappear, but the buttons stay reachable by their accessible name.
    expect(screen.queryByText('JSON Editor')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'JSON Editor' })).toBeInTheDocument()
    expect(screen.queryByText('by doruksenay')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))

    expect(screen.getByTestId('collapsed').textContent).toBe('false')
    expect(aside.className).not.toContain('sidebar--collapsed')
    expect(screen.getByText('JSON Editor')).toBeInTheDocument()
  })

  it('adds a tooltip to each tool only while collapsed', () => {
    renderWithProviders(<Harness />)

    expect(screen.getByRole('button', { name: 'Grid View' })).not.toHaveAttribute('title')

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(screen.getByRole('button', { name: 'Grid View' })).toHaveAttribute('title', 'Grid View')
  })

  it('keeps tools clickable while collapsed', () => {
    renderWithProviders(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Text Cleaner' }))

    expect(activeTab()).toBe('clean')
  })

  it('persists the collapsed preference so it survives a reload', () => {
    const { unmount } = renderWithProviders(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    // Unmounting flushes the debounced write, the same way closing the tab does.
    unmount()

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      sidebarCollapsed?: boolean
    }
    expect(saved.sidebarCollapsed).toBe(true)

    renderWithProviders(<Harness />)
    expect(screen.getByTestId('collapsed').textContent).toBe('true')
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })
})
