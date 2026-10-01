import { describe, expect, it, vi } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import { evaluateSuite, normalizeErrors } from '../src/domain/validation'
import { checkSchemaPolicy, issue, parseBounded } from '../src/domain/jsonSafety'
import { byteLength, checkSuiteLimits, LIMITS } from '../src/domain/limits'
import { EXAMPLE_PACKS } from '../src/domain/examples'
import type { Fixture, SuiteRequest } from '../src/domain/types'

const fixture = (inputText: string, expected: 'valid' | 'invalid' = 'valid', id = 'one'): Fixture => ({ id, name: id, inputText, expected })
const request = (schema: unknown, fixtures = [fixture('{}')]): SuiteRequest => ({ runId: 'test', schemaText: JSON.stringify(schema), fixtures })
const result = (schema: unknown, input: unknown, expected: 'valid' | 'invalid' = 'valid') => evaluateSuite(request(schema, [fixture(JSON.stringify(input), expected)])).results[0]!

describe('JSON Schema 2020-12 validation', () => {
  it('handles positive/negative expectations and errors with JSON Pointer paths', () => {
    const schema = { type: 'object', properties: { 'a/b': { type: 'string' } }, required: ['a/b'] }
    const response = evaluateSuite(request(schema, [fixture('{"a/b":"ok"}'), fixture('{"a/b":1}', 'invalid', 'two'), fixture('{}', 'valid', 'three')]))
    expect(response.schemaStatus).toBe('valid')
    expect(response.results.map(row => row.expectationMatched)).toEqual([true, true, false])
    expect(response.results[1]!.errors[0]).toMatchObject({ instancePath: '/a~1b', schemaPath: '#/properties/a~1b/type', keyword: 'type' })
    expect(response.results[2]!.errors[0]!.message).toContain('required')
    expect(response.elapsedMs).toBeGreaterThanOrEqual(0)
  })
  it.each([true, false])('supports boolean schema %s and JSON primitives', schema => {
    for (const input of [null, false, 0, 2.5, 'text', [], {}]) expect(result(schema, input).status).toBe(schema ? 'valid' : 'invalid')
  })
  it('does not coerce, supply defaults, remove extra properties, or repair text', () => {
    expect(result({ type: 'number' }, '42').status).toBe('invalid')
    expect(result({ type: 'object', required: ['x'], properties: { x: { default: 'filled' } } }, {}).status).toBe('invalid')
    expect(result({ type: 'object', properties: { x: true }, additionalProperties: false }, { x: 1, extra: 2 }).status).toBe('invalid')
    const response = evaluateSuite(request(true, [fixture('```json\n{}\n```', 'invalid'), fixture('{"x":1,}', 'valid', 'other')]))
    expect(response.results.map(row => row.status)).toEqual(['parse-error', 'parse-error'])
    expect(response.results.map(row => row.expectationMatched)).toEqual([true, false])
  })
  it('treats format as annotation, including unknown formats', () => {
    expect(result({ type: 'string', format: 'email' }, 'not-an-email').status).toBe('valid')
    expect(result({ format: 'unknown-format' }, 'x').status).toBe('valid')
  })
  it('supports draft-specific prefixItems and unevaluatedProperties', () => {
    expect(result({ type: 'array', prefixItems: [{ type: 'string' }, { type: 'number' }], items: false }, ['x', 1]).status).toBe('valid')
    expect(result({ type: 'array', prefixItems: [{ type: 'string' }], items: false }, ['x', 1]).status).toBe('invalid')
    const schema = { allOf: [{ properties: { x: true } }], unevaluatedProperties: false }
    expect(result(schema, { x: 1 }).status).toBe('valid')
    expect(result(schema, { y: 1 }).status).toBe('invalid')
  })
  it('applies combinators, conditions, contains, numeric and array constraints', () => {
    expect(result({ anyOf: [{ type: 'null' }, { type: 'string' }] }, null).status).toBe('valid')
    expect(result({ oneOf: [{ type: 'number' }, { minimum: 0 }] }, 1).status).toBe('invalid')
    expect(result({ not: { type: 'null' } }, null).status).toBe('invalid')
    expect(result({ if: { type: 'number' }, then: { minimum: 3 }, else: { const: 'ok' } }, 2).status).toBe('invalid')
    expect(result({ if: { type: 'number' }, then: { minimum: 3 }, else: { const: 'ok' } }, 'ok').status).toBe('valid')
    expect(result({ type: 'array', contains: { const: 1 }, minContains: 1, uniqueItems: true }, [1, 1]).status).toBe('invalid')
    expect(result({ type: 'number', multipleOf: 2, exclusiveMaximum: 10 }, 8).status).toBe('valid')
  })
  it('supports local defs, anchors, and finite recursive values without network access', () => {
    const schema = { $defs: { node: { type: 'object', properties: { next: { $ref: '#/$defs/node' } }, additionalProperties: false } }, $ref: '#/$defs/node' }
    expect(result(schema, { next: { next: {} } }).status).toBe('valid')
    expect(result(schema, { next: 4 }).status).toBe('invalid')
    expect(result({ $defs: { label: { $anchor: 'label', type: 'string' } }, $ref: '#label' }, 'yes').status).toBe('valid')
    expect(result({ $dynamicAnchor: 'node', type: 'object', properties: { next: { $dynamicRef: '#node' } } }, { next: {} }).status).toBe('valid')
  })
  it.each([
    42, null, [], { type: 'not-a-type' }, { required: 'x' }, { pattern: '[' },
    { $schema: 'http://json-schema.org/draft-07/schema#' }, { $ref: '#/$defs/missing' }, { $async: true },
    { $ref: 'https://example.com/schema' }, { $dynamicRef: 'other.json#anchor' },
  ])('schema error is indeterminate for negative fixtures: %j', schema => {
    const response = evaluateSuite(request(schema, [fixture('1', 'invalid')]))
    expect(response.schemaStatus).toBe('invalid')
    expect(response.schemaErrors.length).toBeGreaterThan(0)
    expect(response.results[0]).toMatchObject({ status: 'not-run', expectationMatched: null })
  })
  it('schema parse failure and empty suite have explicit outcomes', () => {
    const bad = evaluateSuite({ runId: 'bad', schemaText: '', fixtures: [fixture('{}', 'invalid')] })
    expect(bad.schemaStatus).toBe('parse-error')
    expect(bad.results[0]!.expectationMatched).toBeNull()
    expect(evaluateSuite(request(true, [])).results).toEqual([])
  })
  it('does not mistake ref-looking instance data for schema references', () => {
    for (const key of ['const', 'enum', 'default', 'examples', 'customAnnotation']) {
      const value = { $ref: 'https://example.com/', $async: true }
      const schema = { [key]: key === 'enum' || key === 'examples' ? [value] : value }
      expect(checkSchemaPolicy(schema)).toEqual([])
      expect(result(schema, value).status).toBe('valid')
    }
  })
  it('handles schema maps and pointer escaping, while ignoring malformed map/array data', () => {
    for (const key of ['$defs', 'definitions', 'properties', 'patternProperties', 'dependentSchemas', 'dependencies']) {
      expect(checkSchemaPolicy({ [key]: { 'a/b~c': { $ref: 'remote' } } })[0]!.schemaPath).toBe(`#/${key}/a~1b~0c/$ref`)
      for (const value of [null, 'wrong', []]) expect(checkSchemaPolicy({ [key]: value })).toEqual([])
    }
    for (const key of ['not', 'if', 'then', 'else', 'items', 'additionalItems', 'unevaluatedItems', 'contains', 'propertyNames', 'additionalProperties', 'unevaluatedProperties', 'contentSchema']) {
      expect(checkSchemaPolicy({ [key]: { $dynamicRef: 'remote' } })).toHaveLength(1)
    }
    for (const key of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) {
      expect(checkSchemaPolicy({ [key]: [{ $ref: 'remote' }] })[0]!.schemaPath).toBe(`#/${key}/0/$ref`)
      expect(checkSchemaPolicy({ [key]: false })).toEqual([])
    }
    expect(checkSchemaPolicy({ $ref: '', properties: { bool: false, null: null, bad: [] } })).toEqual([])
  })
  it('runtime exceptions and non-boolean validator results never pass negatives', () => {
    const throwing = new Ajv2020()
    vi.spyOn(throwing, 'compile').mockImplementation(() => { const validate = () => { throw new Error('runtime broke') }; return validate as never })
    const runtime = evaluateSuite(request(true, [fixture('1', 'invalid')]), () => throwing)
    expect(runtime.schemaStatus).toBe('runtime-error')
    expect(runtime.results[0]!.expectationMatched).toBeNull()
    vi.spyOn(throwing, 'compile').mockImplementation(() => (() => Promise.resolve(true)) as never)
    expect(evaluateSuite(request(true), () => throwing).schemaErrors[0]!.message).toContain('asynchronous')
    expect(evaluateSuite(request(true), () => { throw 'failure' }).schemaErrors[0]!.message).toBe('Validation could not finish.')
    vi.spyOn(throwing, 'compile').mockImplementation(() => { throw 'failure' })
    expect(evaluateSuite(request(true), () => throwing).schemaErrors[0]!.message).toBe('Schema compilation failed.')
  })
  it('never logs schema source when CSP prevents generated function compilation', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('Function', function () { throw new EvalError('CSP blocks generated functions') })
    try {
      const response = evaluateSuite(request({ const: 'private-schema-content' }, [fixture('1', 'invalid')]))
      expect(response.schemaStatus).toBe('runtime-error')
      expect(response.results[0]!.expectationMatched).toBeNull()
      expect(log).not.toHaveBeenCalled()
      expect(warn).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals(); log.mockRestore(); warn.mockRestore(); error.mockRestore() }
  })
  it.each(['validateSchema', 'compile'] as const)('classifies %s resource exhaustion as runtime failure', method => {
    const engine = new Ajv2020()
    vi.spyOn(engine, method).mockImplementation(() => { throw new RangeError('Maximum call stack size exceeded') })
    const response = evaluateSuite(request(true, [fixture('1', 'invalid')]), () => engine)
    expect(response.schemaStatus).toBe('runtime-error')
    expect(response.schemaErrors[0]).toMatchObject({ keyword: 'runtime', message: 'Maximum call stack size exceeded' })
    expect(response.results[0]).toMatchObject({ status: 'not-run', expectationMatched: null })
  })
  it('normalizes missing validator errors and messages', () => {
    expect(normalizeErrors(null)).toEqual([])
    expect(normalizeErrors(undefined)).toEqual([])
    expect(normalizeErrors([{ keyword: 'test', instancePath: '', schemaPath: '#', params: {} }])[0]!.message).toBe('Validation failed.')
    expect(issue('x', 'y', '/a', '#/b')).toEqual({ keyword: 'x', message: 'y', instancePath: '/a', schemaPath: '#/b' })
  })
  it('example packs are runnable and demonstrate matching positive and negative expectations', () => {
    expect(EXAMPLE_PACKS).toHaveLength(2)
    for (const { pack } of EXAMPLE_PACKS) expect(evaluateSuite({ runId: 'example', ...pack }).schemaStatus).toBe('valid')
    const first = evaluateSuite({ runId: 'example', ...EXAMPLE_PACKS[0]!.pack })
    expect(first.results.every(row => row.expectationMatched === true)).toBe(true)
    expect(first.results.some(row => row.status === 'invalid')).toBe(true)
    expect(first.results.some(row => row.status === 'valid')).toBe(true)
  })
})

describe('bounded JSON and resources', () => {
  it('counts UTF-8 bytes accurately', () => { expect(byteLength('A中😀')).toBe(8) })
  it('checks exact schema, fixture, count, and aggregate boundaries', () => {
    const schemaText = ' '.repeat(LIMITS.schemaBytes - 4) + 'true'
    const inputText = ' '.repeat(LIMITS.fixtureBytes - 1) + '0'
    expect(checkSuiteLimits({ schemaText, fixtures: [fixture(inputText)] })).toEqual([])
    expect(checkSuiteLimits({ schemaText: schemaText + ' ', fixtures: [] })).toHaveLength(1)
    expect(checkSuiteLimits({ schemaText: 'true', fixtures: [fixture(inputText + ' ')] })).toHaveLength(1)
    expect(checkSuiteLimits({ schemaText: 'true', fixtures: Array.from({ length: 50 }, (_, i) => fixture('0', 'valid', String(i))) })).toEqual([])
    expect(checkSuiteLimits({ schemaText: 'true', fixtures: Array.from({ length: 51 }, () => fixture('0')) })).toHaveLength(1)
    const fixtures = Array.from({ length: 8 }, (_, i) => fixture(i === 0 ? inputText.slice(4) : inputText))
    expect(checkSuiteLimits({ schemaText: 'true', fixtures })).toEqual([])
    fixtures[0]!.inputText += ' '
    expect(checkSuiteLimits({ schemaText: 'true', fixtures })).toHaveLength(1)
    const response = evaluateSuite({ runId: 'cap', schemaText: schemaText + ' ', fixtures: [fixture('1', 'invalid')] })
    expect(response.schemaStatus).toBe('limit-error')
    expect(response.results[0]!.expectationMatched).toBeNull()
  })
  it('bounds nesting before parse but does not count escaped string content', () => {
    expect(parseBounded('['.repeat(64) + '0' + ']'.repeat(64), 100).ok).toBe(true)
    expect(parseBounded('['.repeat(65) + '0' + ']'.repeat(65), 100)).toMatchObject({ ok: false, kind: 'safety', error: { keyword: 'depth' } })
    expect(parseBounded(JSON.stringify('[[[{{{\\"\"\\foo'), 10).ok).toBe(true)
    expect(parseBounded('{"one":[1],"two":null}', 5).ok).toBe(true)
    expect(parseBounded(']}', 5)).toMatchObject({ ok: false, kind: 'parse' })
  })
  it('bounds all schema/input nodes, including primitive values', () => {
    const atLimit = JSON.stringify(Array.from({ length: LIMITS.schemaNodes - 1 }, () => 0))
    expect(parseBounded(atLimit, LIMITS.schemaNodes).ok).toBe(true)
    expect(parseBounded(atLimit.replace(']', ',0]'), LIMITS.schemaNodes)).toMatchObject({ ok: false, kind: 'safety', error: { keyword: 'nodes' } })
    const schema = { enum: Array.from({ length: LIMITS.schemaNodes }, () => 0) }
    expect(evaluateSuite(request(schema)).schemaStatus).toBe('limit-error')
    const hugeArray = '[' + '0,'.repeat(LIMITS.inputNodes) + '0]'
    expect(evaluateSuite(request(true, [fixture(hugeArray, 'invalid')])).results[0]).toMatchObject({ status: 'not-run', expectationMatched: null })
  })
  it.each(['9007199254740992', '-9007199254740992', '1e400', '-1e400'])('rejects unsafe numbers %s without treating rejection as invalid expectation success', text => {
    expect(parseBounded(text, 10)).toMatchObject({ ok: false, kind: 'safety', error: { keyword: 'numeric-safety' } })
    const response = evaluateSuite(request(true, [fixture(text, 'invalid')]))
    expect(response.results[0]).toMatchObject({ status: 'not-run', expectationMatched: null })
  })
  it('accepts safe integers and ordinary decimals; schema unsafe numbers remain indeterminate', () => {
    for (const text of ['9007199254740991', '-9007199254740991', '0.1', 'null', 'true', '"9007199254740992"']) expect(parseBounded(text, 10).ok).toBe(true)
    expect(evaluateSuite({ runId: 'unsafe', schemaText: '{"minimum":1e999}', fixtures: [] }).schemaStatus).toBe('limit-error')
  })
  it('handles unusual parser errors without leaking an unhandled rejection', () => {
    const spy = vi.spyOn(JSON, 'parse').mockImplementation(() => { throw 'broken' })
    expect(parseBounded('{}', 10)).toMatchObject({ error: { message: 'Invalid JSON text.' } })
    spy.mockRestore()
  })
})
