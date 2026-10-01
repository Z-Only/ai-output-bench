import { describe, expect, it } from 'vitest'
import { exportPack, importPack } from '../src/domain/pack'
import { EXAMPLE_PACKS } from '../src/domain/examples'
import { LIMITS } from '../src/domain/limits'
import type { TestPack } from '../src/domain/types'
const pack = (): TestPack => structuredClone(EXAMPLE_PACKS[0]!.pack)
const check = (value: unknown) => importPack(JSON.stringify(value))

describe('portable packs', () => {
  it('round-trips raw text exactly, including whitespace, malformed cases and escaped characters', () => {
    const value = pack()
    value.schemaText = '\n{ nope\r\n'
    value.fixtures[0]!.inputText = '\t"\\quoted\\"\n😀'
    expect(importPack(exportPack(value))).toEqual({ ok: true, pack: value })
    expect(exportPack(value).endsWith('\n')).toBe(true)
  })
  it.each([null, [], true, 1, 'x', {}, { ...pack(), extra: true }])('rejects malformed root or extra keys %j', value => {
    expect(check(value).ok).toBe(false)
  })
  it.each(['', 'not-json', '{', '```json\n{}\n```'])('rejects bad JSON %s', text => { expect(importPack(text).ok).toBe(false) })
  it('rejects incompatible metadata together', () => {
    const result = check({ ...pack(), version: 2, dialect: 'draft-07', title: ' ', schemaText: {}, fixtures: {} })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toHaveLength(5)
  })
  it.each([null, '', ' ', 'x'.repeat(121), 12])('rejects invalid title %j', title => { expect(check({ ...pack(), title }).ok).toBe(false) })
  it('accepts boundary title/name/id and empty fixture collection', () => {
    const value = pack()
    value.title = 't'.repeat(120)
    value.fixtures[0]!.name = 'n'.repeat(120)
    value.fixtures[0]!.id = 'i'.repeat(64)
    expect(check(value).ok).toBe(true)
    value.fixtures = []
    expect(check(value).ok).toBe(true)
  })
  it.each([null, [], {}, { id: 'x', name: 'x', inputText: '', expected: 'valid', extra: 1 }])('rejects wrong fixture shape %j', row => {
    expect(check({ ...pack(), fixtures: [row] }).ok).toBe(false)
  })
  it('validates fixture field types, names, expectations, duplicate ids and count', () => {
    const value = pack()
    const invalid = check({ ...value, fixtures: [{ id: 7, name: '', inputText: {}, expected: 'unknown' }] })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.errors).toHaveLength(4)
    expect(check({ ...value, fixtures: [{ ...value.fixtures[0], id: 'i'.repeat(65), name: 'n'.repeat(121) }] }).ok).toBe(false)
    value.fixtures[1]!.id = value.fixtures[0]!.id
    expect(check(value)).toMatchObject({ ok: false, errors: [expect.stringContaining('Duplicate')] })
    value.fixtures = Array.from({ length: 51 }, (_, i) => ({ id: String(i), name: 'case', expected: 'valid', inputText: '0' }))
    expect(check(value).ok).toBe(false)
  })
  it('validates encoded pack size and every suite limit before replacement', () => {
    expect(importPack(' '.repeat(LIMITS.packBytes + 1)).ok).toBe(false)
    expect(importPack('中'.repeat(Math.ceil(LIMITS.packBytes / 3))).ok).toBe(false)
    const value = pack()
    value.schemaText = ' '.repeat(LIMITS.schemaBytes + 1)
    expect(check(value).ok).toBe(false)
    value.schemaText = 'true'
    value.fixtures[0]!.inputText = ' '.repeat(LIMITS.fixtureBytes + 1)
    expect(check(value).ok).toBe(false)
    value.fixtures = Array.from({ length: 9 }, (_, i) => ({ id: String(i), name: 'large', expected: 'invalid', inputText: ' '.repeat(LIMITS.fixtureBytes) }))
    expect(check(value).ok).toBe(false)
  })
  it('rejects prototype-looking extra keys while preserving them in raw fixture JSON', () => {
    expect(importPack(exportPack(pack()).replace('"version": 1,', '"version": 1,"__proto__":{},')).ok).toBe(false)
    const value = pack()
    value.fixtures[0]!.inputText = '{"__proto__":{"polluted":true}}'
    expect(check(value).ok).toBe(true)
    expect(Object.hasOwn({}, 'polluted')).toBe(false)
  })
})
