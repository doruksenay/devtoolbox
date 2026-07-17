import { ViewPlugin, type ViewUpdate, type EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { search, getSearchQuery } from '@codemirror/search'

// Stop counting after this many matches to keep large documents responsive.
const MAX_COUNT = 100000

function countMatches(view: EditorView): number {
  const query = getSearchQuery(view.state)
  if (!query.search || !query.valid) return 0
  const cursor = query.getCursor(view.state.doc)
  let count = 0
  while (!cursor.next().done) {
    count++
    if (count >= MAX_COUNT) break
  }
  return count
}

function formatCount(count: number): string {
  if (count >= MAX_COUNT) return `${MAX_COUNT}+ matches`
  if (count === 0) return 'No matches'
  return count === 1 ? '1 match' : `${count} matches`
}

// Injects a live match-count badge into the CodeMirror search panel and keeps
// it in sync with the current query and document.
const matchCountPlugin = ViewPlugin.fromClass(
  class {
    private badge: HTMLElement | null = null
    private signature = ''

    constructor(private readonly view: EditorView) {
      this.sync()
    }

    update(_update: ViewUpdate) {
      this.sync()
    }

    private sync() {
      const view = this.view
      const panel = view.dom.querySelector('.cm-panel.cm-search') as HTMLElement | null
      if (!panel) {
        this.badge = null
        this.signature = ''
        return
      }

      const query = getSearchQuery(view.state)
      const signature = JSON.stringify([
        query.search,
        query.caseSensitive,
        query.regexp,
        query.wholeWord,
        query.valid,
        view.state.doc.length,
      ])
      if (this.signature === signature && this.badge && this.badge.isConnected) return
      this.signature = signature

      if (!this.badge || !this.badge.isConnected) {
        this.badge = document.createElement('span')
        this.badge.className = 'cm-search-count'
        const input = panel.querySelector('input[name="search"]')
        if (input && input.parentNode) {
          input.parentNode.insertBefore(this.badge, input.nextSibling)
        } else {
          panel.appendChild(this.badge)
        }
      }

      this.badge.textContent = query.search ? formatCount(countMatches(view)) : ''
    }
  }
)

// Search configuration shared by all code editors: the panel is anchored to the
// top of the editor and augmented with a live match counter.
export const codeSearch: Extension = [search({ top: true }), matchCountPlugin]
