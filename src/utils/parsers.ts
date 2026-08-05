import type { ParseResult } from '../types'

export function parseJson(raw: string): ParseResult {
  if (!raw.trim()) return { valid: false, parsed: null, error: 'Input is empty' }
  try {
    const parsed = JSON.parse(raw)
    return { valid: true, parsed, error: null }
  } catch (e) {
    return { valid: false, parsed: null, error: (e as Error).message }
  }
}

export function parseXml(raw: string): { valid: boolean; error: string | null } {
  if (!raw.trim()) return { valid: false, error: 'Input is empty' }
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(raw, 'application/xml')
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      return { valid: false, error: parseError.textContent?.trim() ?? 'Invalid XML' }
    }
    return { valid: true, error: null }
  } catch (e) {
    return { valid: false, error: (e as Error).message }
  }
}

export function formatXml(raw: string): string {
  const PADDING = '  '
  let formatted = ''
  let indent = 0
  const lines = raw
    .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
    .replace(/\r\n|\r/g, '\n')
    .split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('</')) {
      indent = Math.max(indent - 1, 0)
    }

    formatted += PADDING.repeat(indent) + line + '\n'

    if (
      line.startsWith('<') &&
      !line.startsWith('</') &&
      !line.startsWith('<?') &&
      !line.endsWith('/>') &&
      !line.includes('</')
    ) {
      indent++
    }
  }

  return formatted.trim()
}

export function beautifyJson(raw: string): string {
  return JSON.stringify(JSON.parse(raw), null, 2)
}
