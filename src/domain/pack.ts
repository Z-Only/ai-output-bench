import { byteLength, checkSuiteLimits, LIMITS } from './limits'
import type { TestPack } from './types'

export type PackImportResult = { ok: true; pack: TestPack } | { ok: false; errors: string[] }
const packKeys = ['version', 'title', 'dialect', 'schemaText', 'fixtures']
const fixtureKeys = ['id', 'name', 'inputText', 'expected']
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}
function boundedName(value: unknown, length: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= length
}

/** Import is atomic: callers replace their current pack only when ok is true. */
export function importPack(text: string): PackImportResult {
  if (text.length > LIMITS.packBytes || byteLength(text) > LIMITS.packBytes) return { ok: false, errors: ['Pack file exceeds its maximum encoded size.'] }
  let value: unknown
  try { value = JSON.parse(text) } catch { return { ok: false, errors: ['Pack must be a JSON document.'] } }
  if (!isRecord(value) || !exactKeys(value, packKeys)) return { ok: false, errors: ['Pack must contain exactly version, title, dialect, schemaText and fixtures.'] }
  const errors: string[] = []
  if (value.version !== 1) errors.push('Only pack version 1 is supported.')
  if (value.dialect !== '2020-12') errors.push('Only JSON Schema draft 2020-12 is supported.')
  if (!boundedName(value.title, LIMITS.titleLength)) errors.push('Pack title must contain 1–120 characters.')
  if (typeof value.schemaText !== 'string') errors.push('schemaText must be a string.')
  if (!Array.isArray(value.fixtures)) errors.push('fixtures must be an array.')
  if (errors.length) return { ok: false, errors }
  const ids = new Set<string>()
  const rows = value.fixtures as unknown[]
  if (rows.length > LIMITS.fixtures) return { ok: false, errors: [`At most ${LIMITS.fixtures} fixtures are allowed.`] }
  rows.forEach((row, index) => {
    if (!isRecord(row) || !exactKeys(row, fixtureKeys)) {
      errors.push(`Fixture ${index + 1} must contain exactly id, name, inputText and expected.`)
      return
    }
    if (!boundedName(row.id, LIMITS.idLength)) errors.push(`Fixture ${index + 1} needs an id of 1–64 characters.`)
    if (!boundedName(row.name, LIMITS.nameLength)) errors.push(`Fixture ${index + 1} needs a name of 1–120 characters.`)
    if (typeof row.inputText !== 'string') errors.push(`Fixture ${index + 1} inputText must be a string.`)
    if (row.expected !== 'valid' && row.expected !== 'invalid') errors.push(`Fixture ${index + 1} expected must be valid or invalid.`)
    if (typeof row.id === 'string') {
      if (ids.has(row.id)) errors.push(`Duplicate fixture id: ${row.id}`)
      ids.add(row.id)
    }
  })
  if (errors.length) return { ok: false, errors }
  const pack = value as unknown as TestPack
  errors.push(...checkSuiteLimits(pack))
  return errors.length ? { ok: false, errors } : { ok: true, pack }
}

export function exportPack(pack: TestPack): string {
  return JSON.stringify(pack, null, 2) + '\n'
}
