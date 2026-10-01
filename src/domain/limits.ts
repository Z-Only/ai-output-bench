import type { SuiteRequest } from './types'

export const LIMITS = Object.freeze({
  schemaBytes: 128 * 1024,
  fixtureBytes: 256 * 1024,
  suiteBytes: 2 * 1024 * 1024,
  fixtures: 50,
  depth: 64,
  schemaNodes: 10_000,
  inputNodes: 100_000,
  timeoutMs: 2_000,
  titleLength: 120,
  nameLength: 120,
  idLength: 64,
  // JSON escaping can expand raw text by six; include bounded metadata overhead.
  packBytes: 12 * 1024 * 1024 + 64 * 1024,
})

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength
}

/** Cheap bounded checks run on the main thread before structured-cloning text. */
export function checkSuiteLimits(request: Pick<SuiteRequest, 'schemaText' | 'fixtures'>): string[] {
  if (request.fixtures.length > LIMITS.fixtures) return [`At most ${LIMITS.fixtures} fixtures are allowed.`]
  const errors: string[] = []
  let total = request.schemaText.length > LIMITS.schemaBytes ? request.schemaText.length : byteLength(request.schemaText)
  if (total > LIMITS.schemaBytes) errors.push('Schema exceeds 128 KiB of UTF-8 text.')
  for (const fixture of request.fixtures) {
    const bytes = fixture.inputText.length > LIMITS.fixtureBytes ? fixture.inputText.length : byteLength(fixture.inputText)
    total += bytes
    if (bytes > LIMITS.fixtureBytes) errors.push(`Fixture “${fixture.name}” exceeds 256 KiB of UTF-8 text.`)
  }
  if (total > LIMITS.suiteBytes) errors.push('Schema and fixture text exceed the 2 MiB suite limit.')
  return errors
}
