import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, fireEvent, within } from '@testing-library/react'
import { TreeView } from '../components/Tree/TreeView'
import { renderWithProviders, resetAppEnvironment } from './testUtils'

const SAMPLE = {
  name: 'Alice',
  address: { city: 'Paris', zip: '75001' },
  tags: ['admin', 'user'],
  active: true,
  score: null,
}

/** The row wrapper a rendered key/value belongs to. */
function rowOf(text: string): HTMLElement {
  const el = screen.getByText(text).closest('.tree-leaf, .tree-node')
  if (!el) throw new Error(`No tree row found for ${text}`)
  return el as HTMLElement
}

function searchBox() {
  return screen.getByPlaceholderText('Search keys and values…')
}

function search(query: string) {
  fireEvent.change(searchBox(), { target: { value: query } })
}

/** Toggle buttons in document order; the first one belongs to the root node. */
function toggles(name: 'Collapse node' | 'Expand node') {
  return screen.getAllByRole('button', { name })
}

describe('TreeView rendering', () => {
  beforeEach(() => {
    resetAppEnvironment()
  })

  it('renders keys and typed values for the whole document', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)

    expect(screen.getByText('"name"')).toBeInTheDocument()
    expect(screen.getByText('"Alice"')).toBeInTheDocument()
    expect(screen.getByText('"city"')).toBeInTheDocument()
    expect(screen.getByText('"Paris"')).toBeInTheDocument()
    expect(screen.getByText('true')).toBeInTheDocument()
    expect(screen.getByText('null')).toBeInTheDocument()
  })

  it('colour-codes leaves by JSON type', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)

    expect(screen.getByText('"Alice"').className).toContain('tree-value--string')
    expect(screen.getByText('true').className).toContain('tree-value--boolean')
    expect(screen.getByText('null').className).toContain('tree-value--null')
  })

  it('renders array items positionally, without keys', () => {
    renderWithProviders(<TreeView data={{ tags: ['admin', 'user'] }} />)

    expect(screen.getByText('"admin"')).toBeInTheDocument()
    expect(screen.getByText('"user"')).toBeInTheDocument()
    expect(screen.queryByText('"0"')).not.toBeInTheDocument()
  })

  it('renders empty containers inline', () => {
    renderWithProviders(<TreeView data={{ items: [], meta: {} }} />)

    expect(screen.getByText('[]')).toBeInTheDocument()
    expect(screen.getByText('{}')).toBeInTheDocument()
  })

  it('collapses deep levels automatically but keeps the first two open', () => {
    renderWithProviders(<TreeView data={{ a: { b: { c: { deep: 'value' } } } }} />)

    expect(screen.getByText('"b"')).toBeInTheDocument()
    // `c` sits at depth 2, so it starts collapsed and its child is hidden.
    expect(screen.queryByText('"deep"')).not.toBeInTheDocument()
    expect(screen.getByText(/1 prop/)).toBeInTheDocument()
  })
})

describe('TreeView expand and collapse', () => {
  beforeEach(() => {
    resetAppEnvironment()
  })

  it('hides children when a node is collapsed and shows a summary badge', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)

    fireEvent.click(toggles('Collapse node')[0])

    expect(screen.queryByText('"Alice"')).not.toBeInTheDocument()
    expect(screen.getByText(/5 props/)).toBeInTheDocument()
  })

  it('reopens a collapsed node from its summary badge', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)

    fireEvent.click(toggles('Collapse node')[0])
    fireEvent.click(screen.getByText(/5 props/))

    expect(screen.getByText('"Alice"')).toBeInTheDocument()
  })

  it('reopens a collapsed node from its caret', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)

    fireEvent.click(toggles('Collapse node')[0])
    fireEvent.click(toggles('Expand node')[0])

    expect(screen.getByText('"Alice"')).toBeInTheDocument()
  })

  it('collapses only the node that was clicked', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)
    const addressToggle = within(rowOf('"address"')).getAllByRole('button', {
      name: 'Collapse node',
    })[0]

    fireEvent.click(addressToggle)

    expect(screen.queryByText('"Paris"')).not.toBeInTheDocument()
    expect(screen.getByText('"Alice"')).toBeInTheDocument()
    expect(screen.getByText('"admin"')).toBeInTheDocument()
  })

  it('reports its open state through aria-expanded', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)

    const root = toggles('Collapse node')[0]
    expect(root).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(root)

    expect(toggles('Expand node')[0]).toHaveAttribute('aria-expanded', 'false')
  })

  it('honours forceOpen for deeply nested documents', () => {
    renderWithProviders(<TreeView data={{ a: { b: { c: { deep: 'value' } } } }} forceOpen />)

    expect(screen.getByText('"deep"')).toBeInTheDocument()
  })

  it('pages long arrays and loads more on demand', () => {
    const many = Array.from({ length: 150 }, (_, i) => `item-${i}`)
    renderWithProviders(<TreeView data={many} />)

    expect(screen.getByText('"item-99"')).toBeInTheDocument()
    expect(screen.queryByText('"item-100"')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Show more \(50 remaining\)/ }))

    expect(screen.getByText('"item-149"')).toBeInTheDocument()
  })
})

describe('TreeView search', () => {
  beforeEach(() => {
    resetAppEnvironment()
  })

  it('is shown by default and can be turned off', () => {
    const { unmount } = renderWithProviders(<TreeView data={SAMPLE} />)
    expect(searchBox()).toBeInTheDocument()
    unmount()

    renderWithProviders(<TreeView data={SAMPLE} enableSearch={false} />)
    expect(screen.queryByPlaceholderText('Search keys and values…')).not.toBeInTheDocument()
  })

  it('highlights matching values and reports the match count', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)

    search('paris')

    const marks = screen.getAllByText('Paris')
    expect(marks[0].tagName).toBe('MARK')
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
  })

  it('matches keys as well as values', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)

    search('zip')

    expect(screen.getByText('zip').tagName).toBe('MARK')
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
  })

  it('reports zero matches without breaking the tree', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)

    search('nothing-matches-this')

    expect(screen.getByText('0 / 0')).toBeInTheDocument()
    expect(screen.getByText('"Alice"')).toBeInTheDocument()
  })

  it('expands collapsed ancestors so a match becomes visible', () => {
    renderWithProviders(<TreeView data={{ a: { b: { c: { needle: 'found' } } } }} />)

    expect(screen.queryByText('"needle"')).not.toBeInTheDocument()

    search('needle')

    expect(screen.getByText('needle').tagName).toBe('MARK')
  })

  it('cycles through matches with the next and previous buttons', () => {
    renderWithProviders(<TreeView data={{ a: 'x', b: 'x', c: 'x' }} />)

    search('x')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Next match (Enter)'))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    // Wraps around past the end…
    fireEvent.click(screen.getByTitle('Next match (Enter)'))
    fireEvent.click(screen.getByTitle('Next match (Enter)'))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    // …and past the start.
    fireEvent.click(screen.getByTitle('Previous match (Shift+Enter)'))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('advances with Enter and steps back with Shift+Enter', () => {
    renderWithProviders(<TreeView data={{ a: 'x', b: 'x', c: 'x' }} />)

    search('x')
    fireEvent.keyDown(searchBox(), { key: 'Enter' })
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    fireEvent.keyDown(searchBox(), { key: 'Enter', shiftKey: true })
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('marks exactly one match as the active one', () => {
    const { container } = renderWithProviders(<TreeView data={{ a: 'x', b: 'x', c: 'x' }} />)

    search('x')

    expect(container.querySelectorAll('.tree-node--search-match')).toHaveLength(3)
    expect(container.querySelectorAll('.tree-node--search-active')).toHaveLength(1)
  })

  it('resets the match position when the query changes', () => {
    renderWithProviders(<TreeView data={{ a: 'x', b: 'x', c: 'x' }} />)

    search('x')
    fireEvent.click(screen.getByTitle('Next match (Enter)'))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    search('xx')
    search('x')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('clears the query from the clear button and from Escape', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)

    search('paris')
    fireEvent.click(screen.getByTitle('Clear search'))
    expect(searchBox()).toHaveValue('')
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument()

    search('paris')
    fireEvent.keyDown(searchBox(), { key: 'Escape' })
    expect(searchBox()).toHaveValue('')
  })

  it('hides the navigation controls while the query is blank', () => {
    renderWithProviders(<TreeView data={SAMPLE} />)

    expect(screen.queryByTitle('Next match (Enter)')).not.toBeInTheDocument()

    search('paris')

    expect(screen.getByTitle('Next match (Enter)')).toBeInTheDocument()
  })
})

describe('TreeView editing', () => {
  beforeEach(() => {
    resetAppEnvironment()
  })

  it('renders read-only rows when no onChange is supplied', () => {
    renderWithProviders(<TreeView data={{ name: 'Alice' }} enableSearch={false} />)

    expect(screen.queryByTitle('Click to edit')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Click to rename')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('edits a string value in place', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TreeView data={{ name: 'Alice' }} enableSearch={false} onChange={onChange} />,
    )

    fireEvent.click(screen.getByText('"Alice"'))
    const input = screen.getByLabelText('Edit value')
    // Strings are edited bare, without their display quotes.
    expect(input).toHaveValue('Alice')

    fireEvent.change(input, { target: { value: 'Bob' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith({ name: 'Bob' })
  })

  it('parses non-string values as JSON literals', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TreeView data={{ count: 1 }} enableSearch={false} onChange={onChange} />,
    )

    fireEvent.click(screen.getByText('1'))
    const input = screen.getByLabelText('Edit value')
    fireEvent.change(input, { target: { value: '42' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith({ count: 42 })
  })

  it('rejects an unparseable literal and keeps the editor open', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TreeView data={{ count: 1 }} enableSearch={false} onChange={onChange} />,
    )

    fireEvent.click(screen.getByText('1'))
    const input = screen.getByLabelText('Edit value')
    fireEvent.change(input, { target: { value: 'not-json' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Edit value').className).toContain('tree-edit-input--invalid')
  })

  it('discards an edit on Escape', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TreeView data={{ name: 'Alice' }} enableSearch={false} onChange={onChange} />,
    )

    fireEvent.click(screen.getByText('"Alice"'))
    fireEvent.change(screen.getByLabelText('Edit value'), { target: { value: 'Bob' } })
    fireEvent.keyDown(screen.getByLabelText('Edit value'), { key: 'Escape' })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('"Alice"')).toBeInTheDocument()
  })

  it('does not fire onChange when the value is unchanged', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TreeView data={{ name: 'Alice' }} enableSearch={false} onChange={onChange} />,
    )

    fireEvent.click(screen.getByText('"Alice"'))
    fireEvent.keyDown(screen.getByLabelText('Edit value'), { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('renames an object key', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TreeView data={{ name: 'Alice' }} enableSearch={false} onChange={onChange} />,
    )

    fireEvent.click(screen.getByTitle('Click to rename'))
    const input = screen.getByLabelText('Edit key')
    fireEvent.change(input, { target: { value: 'firstName' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith({ firstName: 'Alice' })
  })

  it('refuses a duplicate key and warns instead of changing the document', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TreeView data={{ a: 1, b: 2 }} enableSearch={false} onChange={onChange} />,
    )

    fireEvent.click(screen.getAllByTitle('Click to rename')[1])
    const input = screen.getByLabelText('Edit key')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
    expect(await screen.findByText('Key "a" already exists')).toBeInTheDocument()
  })

  it('never offers renaming for array indices', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TreeView data={['admin', 'user']} enableSearch={false} onChange={onChange} />,
    )

    expect(screen.queryByTitle('Click to rename')).not.toBeInTheDocument()
    expect(screen.getAllByTitle('Click to edit')).toHaveLength(2)
  })

  it('removes an entry', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TreeView data={{ a: 1, b: 2 }} enableSearch={false} onChange={onChange} />,
    )

    // Editable keys render inside a rename button, so the row is located from it.
    const rowA = screen.getAllByTitle('Click to rename')[0].closest('.tree-leaf') as HTMLElement
    fireEvent.click(within(rowA).getByRole('button', { name: 'Remove' }))

    expect(onChange).toHaveBeenCalledWith({ b: 2 })
  })

  it('never offers to remove the root', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TreeView data={{ a: 1 }} enableSearch={false} onChange={onChange} />,
    )

    // One remove button, and it belongs to the child rather than the root.
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1)
  })

  it('appends a child to a container', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <TreeView data={{ a: 1 }} enableSearch={false} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(next)).toHaveLength(2)
    expect(next.a).toBe(1)
  })
})

describe('TreeView copy', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>()

  beforeEach(() => {
    resetAppEnvironment()
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: { writeText },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('copies a string leaf without its display quotes and confirms with a toast', async () => {
    renderWithProviders(<TreeView data={{ name: 'Alice' }} enableSearch={false} />)

    fireEvent.click(within(rowOf('"Alice"')).getByRole('button', { name: 'Copy value' }))

    expect(writeText).toHaveBeenCalledWith('Alice')
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument()
  })

  it('copies a subtree as formatted JSON', async () => {
    renderWithProviders(<TreeView data={{ address: { city: 'Paris' } }} enableSearch={false} />)

    fireEvent.click(within(rowOf('"address"')).getAllByRole('button', { name: 'Copy value' })[0])

    expect(writeText).toHaveBeenCalledWith(JSON.stringify({ city: 'Paris' }, null, 2))
    await screen.findByText('Copied to clipboard')
  })

  it('reports a failed copy as an error toast', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    renderWithProviders(<TreeView data={{ name: 'Alice' }} enableSearch={false} />)

    fireEvent.click(within(rowOf('"Alice"')).getByRole('button', { name: 'Copy value' }))

    expect(await screen.findByText('Could not copy to clipboard')).toBeInTheDocument()
  })
})
