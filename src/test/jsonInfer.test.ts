import { describe, it, expect } from 'vitest'
import { inferSchema, JSON_SCHEMA_DIALECT } from '../utils/jsonInfer'
import type { InferOptions, JsonSchema } from '../utils/jsonInfer'

/** The schema without the dialect marker, which every assertion would repeat. */
function shape(data: unknown, options?: InferOptions): JsonSchema {
  const schema = inferSchema(data, options)
  delete schema.$schema
  return schema
}

describe('inferSchema scalars', () => {
  it('declares the 2020-12 dialect at the root', () => {
    expect(inferSchema(1).$schema).toBe(JSON_SCHEMA_DIALECT)
    expect(JSON_SCHEMA_DIALECT).toBe('https://json-schema.org/draft/2020-12/schema')
  })

  it('infers string, boolean and null', () => {
    expect(shape('x')).toEqual({ type: 'string' })
    expect(shape(true)).toEqual({ type: 'boolean' })
    expect(shape(null)).toEqual({ type: 'null' })
  })

  it('separates integer from number', () => {
    expect(shape(7)).toEqual({ type: 'integer' })
    expect(shape(-7)).toEqual({ type: 'integer' })
    expect(shape(7.5)).toEqual({ type: 'number' })
  })
})

describe('inferSchema objects', () => {
  it('describes every property and marks them all required', () => {
    expect(shape({ id: 1, name: 'a', ok: false })).toEqual({
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        ok: { type: 'boolean' },
      },
      required: ['id', 'name', 'ok'],
    })
  })

  it('omits required entirely for an object with no keys', () => {
    expect(shape({})).toEqual({ type: 'object', properties: {} })
  })

  it('nests object schemas', () => {
    expect(shape({ user: { city: 'Paris' } })).toEqual({
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        },
      },
      required: ['user'],
    })
  })

  it('skips a key whose value is undefined, since it would not serialise', () => {
    expect(shape({ a: undefined, b: 1 })).toEqual({
      type: 'object',
      properties: { b: { type: 'integer' } },
      required: ['b'],
    })
  })

  it('keeps a null-valued property as a typed property', () => {
    expect(shape({ a: null })).toEqual({
      type: 'object',
      properties: { a: { type: 'null' } },
      required: ['a'],
    })
  })
})

describe('inferSchema arrays', () => {
  it('describes an empty array without claiming an element type', () => {
    expect(shape([])).toEqual({ type: 'array' })
  })

  it('describes uniform elements once', () => {
    expect(shape([1, 2, 3])).toEqual({ type: 'array', items: { type: 'integer' } })
  })

  it('unions scalar element types into a single type list', () => {
    expect(shape([1, 'a'])).toEqual({ type: 'array', items: { type: ['integer', 'string'] } })
  })

  it('models a nullable element as a type list', () => {
    expect(shape(['a', null])).toEqual({ type: 'array', items: { type: ['string', 'null'] } })
  })

  it('widens integer to number when a fraction appears', () => {
    expect(shape([1, 2.5])).toEqual({ type: 'array', items: { type: 'number' } })
  })

  it('orders the type list deterministically regardless of element order', () => {
    expect(shape([null, 'a'])).toEqual(shape(['a', null]))
    expect(shape([true, 1, 'a', null])).toEqual({
      type: 'array',
      items: { type: ['boolean', 'integer', 'string', 'null'] },
    })
  })

  it('merges nested arrays', () => {
    expect(shape([[1], ['a']])).toEqual({
      type: 'array',
      items: { type: 'array', items: { type: ['integer', 'string'] } },
    })
  })

  it('keeps an array of arrays where one is empty', () => {
    expect(shape([[], [1]])).toEqual({
      type: 'array',
      items: { type: 'array', items: { type: 'integer' } },
    })
  })
})

describe('inferSchema merging records', () => {
  const records = [
    { id: 1, name: 'a', tag: 'x' },
    { id: 2, name: 'b' },
    { id: 3, name: 'c', tag: null },
  ]

  it('pools every key, requires only the universal ones and unions shared types', () => {
    expect(shape(records)).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          tag: { type: ['string', 'null'] },
        },
        required: ['id', 'name'],
      },
    })
  })

  it('keeps the properties in first-appearance order', () => {
    const items = shape(records).items as { properties: Record<string, unknown> }
    expect(Object.keys(items.properties)).toEqual(['id', 'name', 'tag'])
  })

  it('falls back to anyOf when the kinds genuinely differ', () => {
    expect(shape([{ a: 1 }, 'x'])).toEqual({
      type: 'array',
      items: {
        anyOf: [
          { type: 'string' },
          { type: 'object', properties: { a: { type: 'integer' } }, required: ['a'] },
        ],
      },
    })
  })

  it('uses anyOf for a nullable object rather than losing the shape', () => {
    expect(shape([{ a: 1 }, null])).toEqual({
      type: 'array',
      items: {
        anyOf: [
          { type: 'null' },
          { type: 'object', properties: { a: { type: 'integer' } }, required: ['a'] },
        ],
      },
    })
  })

  it('merges an object and an array branch side by side', () => {
    const items = shape([{ a: 1 }, [1]]).items as { anyOf: unknown[] }
    expect(items.anyOf).toHaveLength(2)
  })

  it('merges nested objects recursively', () => {
    expect(shape([{ u: { a: 1 } }, { u: { b: 'x' } }])).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          u: {
            type: 'object',
            properties: { a: { type: 'integer' }, b: { type: 'string' } },
          },
        },
        required: ['u'],
      },
    })
  })
})

describe('inferSchema limits', () => {
  it('stops describing below maxDepth and accepts anything there', () => {
    expect(shape({ a: { b: { c: 1 } } }, { maxDepth: 1 })).toEqual({
      type: 'object',
      properties: {
        a: { type: 'object', properties: { b: {} }, required: ['b'] },
      },
      required: ['a'],
    })
  })

  it('only samples the first maxArraySamples elements', () => {
    expect(shape([1, 'a', true], { maxArraySamples: 1 })).toEqual({
      type: 'array',
      items: { type: 'integer' },
    })
  })

  it('only describes the first maxProperties keys', () => {
    expect(shape({ a: 1, b: 2 }, { maxProperties: 1 })).toEqual({
      type: 'object',
      properties: { a: { type: 'integer' } },
      required: ['a'],
    })
  })

  it('survives a document deeper than the default limit', () => {
    let deep: unknown = 1
    for (let i = 0; i < 500; i += 1) deep = { next: deep }
    expect(() => inferSchema(deep)).not.toThrow()
  })

  it('an unconstrained branch swallows the union it takes part in', () => {
    expect(shape([{ a: { b: 1 } }, { a: 2 }], { maxDepth: 1 })).toEqual({
      type: 'array',
      items: { type: 'object', properties: { a: {} }, required: ['a'] },
    })
  })
})

describe('inferSchema determinism', () => {
  it('produces byte-identical output for the same input', () => {
    const data = [
      { a: 1, b: null },
      { a: 2.5, c: 'x' },
    ]
    expect(JSON.stringify(inferSchema(data))).toBe(JSON.stringify(inferSchema(data)))
  })

  it('produces a schema that is itself valid JSON', () => {
    expect(() => JSON.stringify(inferSchema({ a: [1, { b: 'x' }] }))).not.toThrow()
  })
})
