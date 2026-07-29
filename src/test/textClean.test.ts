import { describe, it, expect } from 'vitest'
import {
  cleanText,
  decodeHtmlEntities,
  detectCharacters,
  DEFAULT_CLEAN_OPTIONS,
} from '../utils/textClean'

describe('decodeHtmlEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHtmlEntities('a &amp; b')).toBe('a & b')
    expect(decodeHtmlEntities('&lt;div&gt;')).toBe('<div>')
    expect(decodeHtmlEntities('&quot;hi&quot;')).toBe('"hi"')
  })

  it('decodes numeric (decimal and hex) entities', () => {
    expect(decodeHtmlEntities('line&#10;break')).toBe('line\nbreak')
    expect(decodeHtmlEntities('&#x41;&#x42;')).toBe('AB')
  })

  it('decodes &nbsp; to a non-breaking space', () => {
    expect(decodeHtmlEntities('a&nbsp;b')).toBe('a\u00A0b')
  })

  it('leaves unknown entities untouched', () => {
    expect(decodeHtmlEntities('&notarealentity;')).toBe('&notarealentity;')
  })
})

describe('detectCharacters', () => {
  it('detects non-breaking spaces', () => {
    const findings = detectCharacters('a\u00A0b\u00A0c')
    expect(findings).toHaveLength(1)
    expect(findings[0].code).toBe('U+00A0')
    expect(findings[0].count).toBe(2)
    expect(findings[0].kind).toBe('space')
  })

  it('detects zero-width characters', () => {
    const findings = detectCharacters('a\u200Bb\uFEFF')
    expect(findings.map(f => f.code).sort()).toEqual(['U+200B', 'U+FEFF'])
    expect(findings.every(f => f.kind === 'invisible')).toBe(true)
  })

  it('returns nothing for clean text', () => {
    expect(detectCharacters('normal text 123')).toEqual([])
  })
})

describe('cleanText', () => {
  it('decodes entities and removes invisibles by default', () => {
    const { output, entityCount } = cleanText('a &amp; b\u200B', DEFAULT_CLEAN_OPTIONS)
    expect(output).toBe('a & b')
    expect(entityCount).toBe(1)
  })

  it('converts decoded &nbsp; into a normal space', () => {
    const { output } = cleanText('a&nbsp;b', DEFAULT_CLEAN_OPTIONS)
    expect(output).toBe('a b')
  })

  it('reports findings from the original input', () => {
    const { findings } = cleanText('x\u00A0y\u200Bz', DEFAULT_CLEAN_OPTIONS)
    expect(findings.map(f => f.code).sort()).toEqual(['U+00A0', 'U+200B'])
  })

  it('respects disabled options', () => {
    const { output } = cleanText('a &amp; b', {
      decodeEntities: false,
      replaceSpaces: false,
      removeInvisibles: false,
      trimTrailing: false,
    })
    expect(output).toBe('a &amp; b')
  })

  it('trims trailing whitespace only when enabled', () => {
    const input = 'foo   \nbar\t\n'
    expect(cleanText(input, DEFAULT_CLEAN_OPTIONS).output).toBe(input)
    const trimmed = cleanText(input, { ...DEFAULT_CLEAN_OPTIONS, trimTrailing: true }).output
    expect(trimmed).toBe('foo\nbar\n')
  })
})
