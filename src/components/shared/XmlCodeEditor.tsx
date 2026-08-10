import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { xml } from '@codemirror/lang-xml'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { oneDark } from '@codemirror/theme-one-dark'
import { codeSearch } from './codeSearch'

const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-code)',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--bg-hover)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--bg-hover)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--accent)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--accent-bg)',
  },
})

const darkThemeOverride = EditorView.theme({
  '&': { height: '100%' },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
  },
})

interface Props {
  value: string
  onChange: (val: string) => void
  readOnly?: boolean
  theme?: 'dark' | 'light'
}

export function XmlCodeEditor({ value, onChange, readOnly = false, theme = 'dark' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // Last string this editor emitted upward. When it comes straight back in as
  // `value`, the sync effect can bail on pointer equality instead of
  // re-serialising the whole document.
  const lastEmittedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      foldGutter(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightSelectionMatches(),
      codeSearch,
      history(),
      xml(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...closeBracketsKeymap,
        ...searchKeymap,
        ...foldKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const next = update.state.doc.toString()
          lastEmittedRef.current = next
          onChangeRef.current(next)
        }
      }),
      EditorState.readOnly.of(readOnly),
      theme === 'dark' ? oneDark : lightTheme,
      theme === 'dark' ? darkThemeOverride : [],
    ].flat()

    const state = EditorState.create({ doc: value, extensions })
    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view
    // Fresh view, so nothing has been emitted from it yet.
    lastEmittedRef.current = null

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, theme])

  useEffect(() => {
    // Echo of our own keystroke: the same string instance is coming back, so
    // the document is already up to date and serialising it would be wasted
    // work on every key press.
    if (value === lastEmittedRef.current) return
    const view = viewRef.current
    if (!view) return
    const currentDoc = view.state.doc.toString()
    if (currentDoc !== value) {
      view.dispatch({ changes: { from: 0, to: currentDoc.length, insert: value } })
    }
  }, [value])

  return <div ref={containerRef} className="code-editor-wrap" />
}
