import { afterEach, expect, it, vi } from 'vitest'
import type { SuiteRequest } from '../src/domain/types'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
it('worker entrypoint parses, compiles and returns an actual validation response', async () => {
  const postMessage = vi.fn()
  vi.stubGlobal('postMessage', postMessage)
  vi.stubGlobal('onmessage', null)
  await import('../src/workers/validation.worker')
  const request: SuiteRequest = {
    runId: 'worker-integration', schemaText: '{"type":"integer","minimum":0}',
    fixtures: [{ id: 'good', name: 'Good', inputText: '2', expected: 'valid' }, { id: 'bad', name: 'Bad', inputText: '-1', expected: 'invalid' }],
  }
  const onmessage = globalThis.onmessage as (event: MessageEvent<SuiteRequest>) => void
  onmessage({ data: request } as MessageEvent<SuiteRequest>)
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ runId: request.runId, schemaStatus: 'valid', results: [expect.objectContaining({ status: 'valid', expectationMatched: true }), expect.objectContaining({ status: 'invalid', expectationMatched: true })] }))
})
