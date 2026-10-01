import Ajv2020 from 'ajv/dist/2020'
import type { ErrorObject } from 'ajv'
import { checkSuiteLimits, LIMITS } from './limits'
import { checkSchemaPolicy, issue, parseBounded } from './jsonSafety'
import type { FixtureResult, SchemaStatus, SuiteRequest, SuiteResponse, ValidationIssue } from './types'

export function blockedSuite(request: SuiteRequest, schemaStatus: SchemaStatus, schemaErrors: ValidationIssue[], elapsedMs = 0): SuiteResponse {
  return {
    runId: request.runId, schemaStatus, schemaErrors, elapsedMs,
    results: request.fixtures.map(fixture => ({ id: fixture.id, status: 'not-run', expectationMatched: null, errors: [] })),
  }
}

export function normalizeErrors(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map(error => ({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? 'Validation failed.',
  }))
}

const createEngine = () => new Ajv2020({
  logger: false,
  validateSchema: true,
  allErrors: false,
  strict: false,
  validateFormats: false,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  ownProperties: true,
})
type Engine = Pick<Ajv2020, 'validateSchema' | 'compile' | 'errors'>

/** Called only in a disposable Worker in the application; synchronous for testability. */
export function evaluateSuite(request: SuiteRequest, engineFactory: () => Engine = createEngine): SuiteResponse {
  const start = performance.now()
  const fail = (status: SchemaStatus, errors: ValidationIssue[]) => blockedSuite(request, status, errors, performance.now() - start)
  const limits = checkSuiteLimits(request)
  if (limits.length) return fail('limit-error', limits.map(message => issue('limit', message)))
  const parsed = parseBounded(request.schemaText, LIMITS.schemaNodes)
  if (!parsed.ok) return fail(parsed.kind === 'parse' ? 'parse-error' : 'limit-error', [parsed.error])
  const policyErrors = checkSchemaPolicy(parsed.value)
  if (policyErrors.length) return fail('invalid', policyErrors)
  try {
    const engine = engineFactory()
    let validate
    try {
      if (!engine.validateSchema(parsed.value as object | boolean)) return fail('invalid', normalizeErrors(engine.errors))
      validate = engine.compile(parsed.value as object | boolean)
    } catch (error) {
      // CSP denial and resource exhaustion do not establish schema invalidity.
      if (error instanceof EvalError || error instanceof RangeError) throw error
      return fail('invalid', [issue('schema', error instanceof Error ? error.message : 'Schema compilation failed.')])
    }
    const results: FixtureResult[] = []
    for (const fixture of request.fixtures) {
      const input = parseBounded(fixture.inputText, LIMITS.inputNodes)
      if (!input.ok) {
        const status = input.kind === 'parse' ? 'parse-error' : 'not-run'
        results.push({ id: fixture.id, status, expectationMatched: status === 'parse-error' ? fixture.expected === 'invalid' : null, errors: [input.error] })
        continue
      }
      const valid = validate(input.value)
      if (typeof valid !== 'boolean') throw new Error('The validator returned an asynchronous or unsupported result.')
      const status = valid ? 'valid' : 'invalid'
      results.push({ id: fixture.id, status, expectationMatched: status === fixture.expected, errors: valid ? [] : normalizeErrors(validate.errors) })
    }
    return { runId: request.runId, schemaStatus: 'valid', schemaErrors: [], results, elapsedMs: performance.now() - start }
  } catch (error) {
    return fail('runtime-error', [issue('runtime', error instanceof Error ? error.message : 'Validation could not finish.')])
  }
}
