// ─────────────────────────────────────────────
//  JSON Schema inference (draft 2020-12)
//
//  Given a sample document, describe the shape it implies: property types,
//  which keys every record carries, and what the elements of an array have in
//  common. The output is deliberately permissive — a schema inferred from one
//  sample is a starting point a human edits, so it never invents constraints
//  (formats, lengths, enums) the data merely happens to satisfy.
//
//  Unions are expressed the cheapest way that stays correct: scalars collapse
//  into `type: [...]`, and only genuinely different kinds (an object *or* a
//  string) fall back to `anyOf`.
// ─────────────────────────────────────────────

export type JsonSchema = Record<string, unknown>

export interface InferOptions {
  /** Nesting beyond this depth is described as "anything". */
  maxDepth?: number
  /** How many array elements are inspected before the rest are assumed alike. */
  maxArraySamples?: number
  /** How many keys of a single object are described. */
  maxProperties?: number
}

const SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema'

// A deeply recursive document (or a wide one full of records) would otherwise
// make inference quadratic in the size of the paste. These bounds keep a
// pathological input slow-but-finite instead of hanging the tab.
const DEFAULT_MAX_DEPTH = 12
const DEFAULT_MAX_ARRAY_SAMPLES = 200
const DEFAULT_MAX_PROPERTIES = 200

/** Fixed order so the same data always yields byte-identical output. */
const TYPE_ORDER = ['boolean', 'integer', 'number', 'string', 'null']

interface Limits {
  maxDepth: number
  maxArraySamples: number
  maxProperties: number
}

function describeObject(value: Record<string, unknown>, depth: number, limits: Limits): JsonSchema {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []

  for (const key of Object.keys(value).slice(0, limits.maxProperties)) {
    // `undefined` never survives serialisation, so the key is not really there.
    if (value[key] === undefined) continue
    properties[key] = describe(value[key], depth + 1, limits)
    required.push(key)
  }

  const schema: JsonSchema = { type: 'object', properties }
  if (required.length > 0) schema.required = required
  return schema
}

function describe(value: unknown, depth: number, limits: Limits): JsonSchema {
  if (depth > limits.maxDepth) return {}
  if (value === null) return { type: 'null' }

  if (Array.isArray(value)) {
    if (value.length === 0) return { type: 'array' }
    const samples = value
      .slice(0, limits.maxArraySamples)
      .map((item) => describe(item, depth + 1, limits))
    return { type: 'array', items: mergeSchemas(samples) }
  }

  switch (typeof value) {
    case 'string':
      return { type: 'string' }
    case 'boolean':
      return { type: 'boolean' }
    case 'number':
      // `integer` is the narrower claim and the one a reader expects for ids
      // and counts; a merge widens it back to `number` if a fraction shows up.
      return { type: Number.isInteger(value) ? 'integer' : 'number' }
    case 'object':
      return describeObject(value as Record<string, unknown>, depth, limits)
    default:
      // Functions, symbols, bigint: nothing JSON can carry, so claim nothing.
      return {}
  }
}

/** Unions object schemas: keys are pooled, `required` survives only if universal. */
function mergeObjects(list: JsonSchema[]): JsonSchema {
  const grouped = new Map<string, JsonSchema[]>()
  for (const schema of list) {
    const properties = (schema.properties ?? {}) as Record<string, JsonSchema>
    for (const [key, sub] of Object.entries(properties)) {
      const bucket = grouped.get(key)
      if (bucket) bucket.push(sub)
      else grouped.set(key, [sub])
    }
  }

  const properties: Record<string, JsonSchema> = {}
  for (const [key, bucket] of grouped) {
    properties[key] = bucket.length === 1 ? bucket[0] : mergeSchemas(bucket)
  }

  const required = Array.from(grouped.keys()).filter((key) =>
    list.every((schema) => Array.isArray(schema.required) && schema.required.includes(key)),
  )

  const merged: JsonSchema = { type: 'object', properties }
  if (required.length > 0) merged.required = required
  return merged
}

function mergeArrays(list: JsonSchema[]): JsonSchema {
  const items = list
    .map((schema) => schema.items)
    .filter((item): item is JsonSchema => item !== undefined)
  if (items.length === 0) return { type: 'array' }
  return { type: 'array', items: items.length === 1 ? items[0] : mergeSchemas(items) }
}

/**
 * Combines the schemas of sibling values into one that accepts them all.
 *
 * An empty schema in the list means "anything" — it came from the depth guard —
 * and a union with anything is anything, so it short-circuits the whole merge.
 */
function mergeSchemas(list: JsonSchema[]): JsonSchema {
  const scalars = new Set<string>()
  const objects: JsonSchema[] = []
  const arrays: JsonSchema[] = []

  for (const schema of list) {
    const type = schema.type
    if (type === 'object') objects.push(schema)
    else if (type === 'array') arrays.push(schema)
    else if (typeof type === 'string') scalars.add(type)
    else if (Array.isArray(type)) for (const entry of type) scalars.add(String(entry))
    else return {}
  }

  const branches: JsonSchema[] = []

  if (scalars.size > 0) {
    // Every integer is already a number, so keeping both would only mislead.
    if (scalars.has('number')) scalars.delete('integer')
    const types = TYPE_ORDER.filter((type) => scalars.has(type))
    branches.push({ type: types.length === 1 ? types[0] : types })
  }
  if (objects.length > 0) branches.push(mergeObjects(objects))
  if (arrays.length > 0) branches.push(mergeArrays(arrays))

  if (branches.length === 0) return {}
  if (branches.length === 1) return branches[0]
  return { anyOf: branches }
}

/** Infers a draft 2020-12 schema describing `data`. */
export function inferSchema(data: unknown, options: InferOptions = {}): JsonSchema {
  const limits: Limits = {
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxArraySamples: options.maxArraySamples ?? DEFAULT_MAX_ARRAY_SAMPLES,
    maxProperties: options.maxProperties ?? DEFAULT_MAX_PROPERTIES,
  }
  return { $schema: SCHEMA_DIALECT, ...describe(data, 0, limits) }
}

/** Exposed so callers can label the dialect without hard-coding the URL. */
export const JSON_SCHEMA_DIALECT = SCHEMA_DIALECT
