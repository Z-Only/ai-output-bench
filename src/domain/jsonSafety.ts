import { LIMITS } from './limits'
import type { ValidationIssue } from './types'

export function issue(keyword: string, message: string, instancePath = '', schemaPath = ''): ValidationIssue {
  return { instancePath, schemaPath, keyword, message }
}
export type SafeParseResult = { ok: true; value: unknown } | { ok: false; kind: 'parse' | 'safety'; error: ValidationIssue }

/** Bound nesting before JSON.parse; strings and escaped quotes are not structure. */
export function parseBounded(text: string, maxNodes: number): SafeParseResult {
  let depth = 0
  let inString = false
  let escaped = false
  for (const char of text) {
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === '{' || char === '[') {
      depth++
      if (depth > LIMITS.depth) return { ok: false, kind: 'safety', error: issue('depth', `JSON nesting exceeds ${LIMITS.depth} levels; this input was not validated.`) }
    } else if (char === '}' || char === ']') depth--
  }
  let value: unknown
  try { value = JSON.parse(text) } catch (error) {
    return { ok: false, kind: 'parse', error: issue('parse', error instanceof Error ? error.message : 'Invalid JSON text.') }
  }
  const pending = [value]
  let nodes = 0
  while (pending.length) {
    const node = pending.pop()
    if (++nodes > maxNodes) return { ok: false, kind: 'safety', error: issue('nodes', `JSON exceeds ${maxNodes.toLocaleString('en-US')} values; this input was not validated.`) }
    if (typeof node === 'number' && (!Number.isFinite(node) || (Number.isInteger(node) && !Number.isSafeInteger(node)))) {
      return { ok: false, kind: 'safety', error: issue('numeric-safety', 'Non-finite numbers and integers outside JavaScript’s safe integer range are not validated. Decimal precision is not guaranteed.') }
    }
    if (node !== null && typeof node === 'object') {
      for (const child of Object.values(node)) pending.push(child)
    }
  }
  return { ok: true, value }
}

const singleSchemas = ['additionalProperties', 'unevaluatedProperties', 'propertyNames', 'contains', 'items', 'additionalItems', 'unevaluatedItems', 'not', 'if', 'then', 'else', 'contentSchema']
const schemaMaps = ['$defs', 'definitions', 'properties', 'patternProperties', 'dependentSchemas', 'dependencies']
const schemaArrays = ['allOf', 'anyOf', 'oneOf', 'prefixItems']
const pointer = (part: string) => part.replaceAll('~', '~0').replaceAll('/', '~1')

/** Walk schema positions only. enum/const/default/example payloads are data. */
export function checkSchemaPolicy(schema: unknown): ValidationIssue[] {
  const pending: { value: unknown; path: string }[] = [{ value: schema, path: '#' }]
  while (pending.length) {
    const { value, path } = pending.pop()!
    if (value === null || typeof value !== 'object' || Array.isArray(value)) continue
    const node = value as Record<string, unknown>
    for (const key of ['$ref', '$dynamicRef']) {
      const ref = node[key]
      if (typeof ref === 'string' && ref !== '' && !ref.startsWith('#')) {
        return [issue('external-ref', 'External references are disabled. Use a same-document # reference.', '', `${path}/${key}`)]
      }
    }
    if (Object.hasOwn(node, '$async')) return [issue('async', 'Asynchronous schemas are not supported.', '', `${path}/$async`)]
    for (const key of singleSchemas) if (Object.hasOwn(node, key)) pending.push({ value: node[key], path: `${path}/${key}` })
    for (const key of schemaMaps) {
      const map = node[key]
      if (map !== null && typeof map === 'object' && !Array.isArray(map)) {
        for (const [name, child] of Object.entries(map)) pending.push({ value: child, path: `${path}/${key}/${pointer(name)}` })
      }
    }
    for (const key of schemaArrays) {
      const children = node[key]
      if (Array.isArray(children)) children.forEach((child, index) => pending.push({ value: child, path: `${path}/${key}/${index}` }))
    }
  }
  return []
}
