import { checkSuiteLimits, LIMITS } from '../domain/limits'
import { issue } from '../domain/jsonSafety'
import type { SuiteRequest, SuiteResponse, SchemaStatus } from '../domain/types'

// Keep Ajv and parsing out of the main-thread bundle.
function blocked(request: SuiteRequest, status: SchemaStatus, messages: string[], elapsedMs: number): SuiteResponse {
  return {
    runId: request.runId, schemaStatus: status,
    schemaErrors: messages.map(message => issue(status, message)), elapsedMs,
    results: request.fixtures.map(fixture => ({ id: fixture.id, status: 'not-run', expectationMatched: null, errors: [] })),
  }
}
export interface ValidationWorker {
  onmessage: ((event: MessageEvent<SuiteResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
  postMessage(request: SuiteRequest): void
  terminate(): void
}
export interface ValidationRunnerOptions {
  workerFactory?: () => ValidationWorker
}
export interface ValidationRunner {
  runSuite(request: SuiteRequest): Promise<SuiteResponse>
  cancel(): void
}

export function createValidationRunner(options: ValidationRunnerOptions = {}): ValidationRunner {
  const workerFactory = options.workerFactory ?? (() => new Worker(new URL('../workers/validation.worker.ts', import.meta.url), { type: 'module' }))
  const timeoutMs = LIMITS.timeoutMs
  let active: { cancel(): void } | undefined
  function cancel() { active?.cancel() }
  function runSuite(request: SuiteRequest): Promise<SuiteResponse> {
    cancel()
    const limits = checkSuiteLimits(request)
    if (limits.length) return Promise.resolve(blocked(request, 'limit-error', limits, 0))
    const start = performance.now()
    return new Promise(resolve => {
      let worker: ValidationWorker | undefined
      let timer: ReturnType<typeof setTimeout> | undefined
      let finished = false
      const current = { cancel: () => finish(blocked(request, 'cancelled', ['Validation was cancelled.'], performance.now() - start)) }
      const finish = (response: SuiteResponse) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        worker?.terminate()
        if (active === current) active = undefined
        resolve(response)
      }
      active = current
      try {
        worker = workerFactory()
        worker.onmessage = event => {
          if (event.data.runId === request.runId) finish(event.data)
        }
        worker.onerror = () => finish(blocked(request, 'runtime-error', ['The validation worker could not finish. You can try again.'], performance.now() - start))
        worker.onmessageerror = () => finish(blocked(request, 'runtime-error', ['The validation worker returned an unreadable response.'], performance.now() - start))
        timer = setTimeout(() => finish(blocked(request, 'timeout', [`Validation exceeded ${timeoutMs} ms and the worker was terminated. Simplify the schema or fixture.`], performance.now() - start)), timeoutMs)
        worker.postMessage(request)
      } catch {
        finish(blocked(request, 'runtime-error', ['The validation worker could not start. Check browser support and try again.'], performance.now() - start))
      }
    })
  }
  return { runSuite, cancel }
}
