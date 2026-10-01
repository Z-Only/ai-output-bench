import { evaluateSuite } from '../domain/validation'
import type { SuiteRequest, SuiteResponse } from '../domain/types'

interface WorkerScope {
  onmessage: ((event: MessageEvent<SuiteRequest>) => void) | null
  postMessage(response: SuiteResponse): void
}
const scope = globalThis as unknown as WorkerScope
scope.onmessage = (event: MessageEvent<SuiteRequest>) => {
  scope.postMessage(evaluateSuite(event.data))
}
