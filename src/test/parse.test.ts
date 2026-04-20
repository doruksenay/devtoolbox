import { describe, it, expect } from 'vitest'
import { parseJson } from '../context/AppContext'
import { parseXml, formatXml } from '../context/AppContext'

describe('parseJson', () => {
  it('returns valid result for valid JSON', () => {
    const result = parseJson('{"name": "test", "value": 42}')
    expect(result.valid).toBe(true)
    expect(result.parsed).toEqual({ name: 'test', value: 42 })
    expect(result.error).toBeNull()
  })

  it('returns error for invalid JSON', () => {
    const result = parseJson('{invalid}')
    expect(result.valid).toBe(false)
    expect(result.parsed).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('returns error for empty input', () => {
    const result = parseJson('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Input is empty')
  })

  it('returns error for whitespace-only input', () => {
    const result = parseJson('   ')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Input is empty')
  })

  it('parses arrays', () => {
    const result = parseJson('[1, 2, 3]')
    expect(result.valid).toBe(true)
    expect(result.parsed).toEqual([1, 2, 3])
  })

  it('parses nested objects', () => {
    const result = parseJson('{"a": {"b": {"c": true}}}')
    expect(result.valid).toBe(true)
    expect(result.parsed).toEqual({ a: { b: { c: true } } })
  })

  it('parses null values', () => {
    const result = parseJson('null')
    expect(result.valid).toBe(true)
    expect(result.parsed).toBeNull()
  })
})

describe('parseXml', () => {
  it('returns valid for well-formed XML', () => {
    const result = parseXml('<root><item>hello</item></root>')
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
  })

  it('returns error for invalid XML', () => {
    const result = parseXml('<root><item></root>')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns error for empty input', () => {
    const result = parseXml('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Input is empty')
  })

  it('validates XML with attributes', () => {
    const result = parseXml('<root id="1" name="test"><child/></root>')
    expect(result.valid).toBe(true)
  })

  it('validates XML with declaration', () => {
    const result = parseXml('<?xml version="1.0"?><root/>')
    expect(result.valid).toBe(true)
  })
})

describe('formatXml', () => {
  it('formats compact XML with indentation', () => {
    const input = '<root><item>hello</item><item>world</item></root>'
    const output = formatXml(input)
    expect(output).toContain('  <item>')
    expect(output.split('\n').length).toBeGreaterThan(1)
  })

  it('handles self-closing tags', () => {
    const input = '<root><br/></root>'
    const output = formatXml(input)
    expect(output).toContain('<br/>')
  })

  it('preserves content', () => {
    const input = '<root><name>test</name></root>'
    const output = formatXml(input)
    expect(output).toContain('<name>test</name>')
  })
})
