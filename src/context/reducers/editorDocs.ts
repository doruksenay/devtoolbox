import type { AppState, EditorDoc } from '../../types'

let docCounter = 0

export function createDocId(): string {
  docCounter += 1
  return `doc-${Date.now().toString(36)}-${docCounter}`
}

export function makeDoc(name: string, raw = ''): EditorDoc {
  return { id: createDocId(), name, raw }
}

/** Next default name like "Tab 3", avoiding collisions with existing names. */
export function nextDocName(docs: EditorDoc[]): string {
  let n = docs.length + 1
  const names = new Set(docs.map((d) => d.name))
  while (names.has(`Tab ${n}`)) n += 1
  return `Tab ${n}`
}

/** Keep the active doc's raw content in sync with editorRaw. */
export function syncActiveDoc(state: AppState, raw: string): EditorDoc[] {
  return state.editorDocs.map((d) =>
    d.id === state.editorActiveDocId ? { ...d, raw } : d
  )
}

/**
 * Restore editor documents from a persisted payload, tolerating older payloads
 * that only stored `editorRaw`.
 */
export function restoreEditorDocs(
  state: AppState,
  s: Partial<AppState>
): Pick<AppState, 'editorRaw' | 'editorDocs' | 'editorActiveDocId'> {
  const docs = Array.isArray(s.editorDocs)
    ? s.editorDocs.filter(
        (d): d is EditorDoc =>
          !!d && typeof d.id === 'string' && typeof d.name === 'string' && typeof d.raw === 'string'
      )
    : []

  if (docs.length === 0) {
    const raw = s.editorRaw ?? state.editorRaw
    const doc = makeDoc(state.editorDocs[0]?.name ?? 'Tab 1', raw)
    return { editorRaw: raw, editorDocs: [doc], editorActiveDocId: doc.id }
  }

  const activeId = docs.some((d) => d.id === s.editorActiveDocId)
    ? (s.editorActiveDocId as string)
    : docs[0].id
  const active = docs.find((d) => d.id === activeId)!
  return { editorRaw: active.raw, editorDocs: docs, editorActiveDocId: activeId }
}
