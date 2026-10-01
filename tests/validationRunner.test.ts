import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createValidationRunner } from '../src/services/validationRunner'
import type { ValidationWorker } from '../src/services/validationRunner'
import type { SuiteRequest, SuiteResponse } from '../src/domain/types'
import { LIMITS } from '../src/domain/limits'

const request = (runId = 'one'): SuiteRequest => ({ runId, schemaText: 'true', fixtures: [{ id: 'one', name: 'Test', inputText: '1', expected: 'invalid' }] })
const response = (runId = 'one'): SuiteResponse => ({ runId, schemaStatus: 'valid', schemaErrors: [], elapsedMs: 1, results: [{ id: 'one', status: 'valid', expectationMatched: false, errors: [] }] })
class FakeWorker implements ValidationWorker {
  onmessage: ValidationWorker['onmessage'] = null
  onerror: ValidationWorker['onerror'] = null
  onmessageerror: ValidationWorker['onmessageerror'] = null
  postMessage = vi.fn()
  terminate = vi.fn()
  reply(value: SuiteResponse) { this.onmessage?.({ data: value } as MessageEvent<SuiteResponse>) }
}

describe('disposable validation runner', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
  it('uses a fresh worker per run, returns the result, and terminates every completed worker', async () => {
    const workers: FakeWorker[] = []
    const runner = createValidationRunner({ workerFactory: () => { const worker = new FakeWorker(); workers.push(worker); return worker } })
    const pending = runner.runSuite(request())
    expect(workers[0]!.postMessage).toHaveBeenCalledWith(request())
    workers[0]!.reply(response())
    expect(await pending).toEqual(response())
    expect(workers[0]!.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    const next = runner.runSuite(request('two'))
    expect(workers).toHaveLength(2)
    workers[1]!.reply(response('two'))
    await next
    runner.cancel()
    expect(workers[1]!.terminate).toHaveBeenCalledOnce()
  })
  it('terminates at the fixed timeout and keeps negative fixtures indeterminate', async () => {
    const worker = new FakeWorker()
    const runner = createValidationRunner({ workerFactory: () => worker })
    const pending = runner.runSuite(request())
    await vi.advanceTimersByTimeAsync(LIMITS.timeoutMs - 1)
    expect(worker.terminate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toMatchObject({ schemaStatus: 'timeout', results: [{ status: 'not-run', expectationMatched: null }] })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('supports cancellation, repeated cancellation, and recovery after cancellation', async () => {
    const worker = new FakeWorker()
    const runner = createValidationRunner({ workerFactory: () => worker })
    runner.cancel()
    const pending = runner.runSuite(request())
    runner.cancel()
    runner.cancel()
    expect(await pending).toMatchObject({ schemaStatus: 'cancelled' })
    expect(worker.terminate).toHaveBeenCalledOnce()
    const fresh = runner.runSuite(request('fresh'))
    worker.reply(response('fresh'))
    expect((await fresh).schemaStatus).toBe('valid')
  })
  it('cancels an old run and ignores queued stale responses including reused run ids', async () => {
    const firstWorker = new FakeWorker(), secondWorker = new FakeWorker()
    const factory = vi.fn().mockReturnValueOnce(firstWorker).mockReturnValueOnce(secondWorker)
    const runner = createValidationRunner({ workerFactory: factory })
    const first = runner.runSuite(request())
    const stale = firstWorker.onmessage!
    const second = runner.runSuite(request())
    expect((await first).schemaStatus).toBe('cancelled')
    stale({ data: response() } as MessageEvent<SuiteResponse>)
    secondWorker.reply(response('wrong-id'))
    expect(secondWorker.terminate).not.toHaveBeenCalled()
    secondWorker.reply(response())
    expect(await second).toEqual(response())
    stale({ data: response() } as MessageEvent<SuiteResponse>)
    expect(firstWorker.terminate).toHaveBeenCalledOnce()
  })
  it('handles worker construction, postMessage, event errors and response-clone failures', async () => {
    expect((await createValidationRunner({ workerFactory: () => { throw new Error('CSP') } }).runSuite(request())).schemaStatus).toBe('runtime-error')
    const broken = new FakeWorker()
    broken.postMessage.mockImplementation(() => { throw new Error('cannot clone') })
    expect((await createValidationRunner({ workerFactory: () => broken }).runSuite(request())).schemaStatus).toBe('runtime-error')
    expect(broken.terminate).toHaveBeenCalledOnce()
    for (const event of ['onerror', 'onmessageerror'] as const) {
      const worker = new FakeWorker()
      const runner = createValidationRunner({ workerFactory: () => worker })
      const pending = runner.runSuite(request())
      worker[event]!({} as never)
      expect(await pending).toMatchObject({ schemaStatus: 'runtime-error', results: [{ expectationMatched: null }] })
      expect(worker.terminate).toHaveBeenCalledOnce()
    }
  })
  it('rejects oversized suite before creating workers and cancels old work first', async () => {
    const worker = new FakeWorker()
    const factory = vi.fn(() => worker)
    const runner = createValidationRunner({ workerFactory: factory })
    const first = runner.runSuite(request())
    const value = await runner.runSuite({ ...request('too-large'), schemaText: ' '.repeat(LIMITS.schemaBytes + 1) })
    expect((await first).schemaStatus).toBe('cancelled')
    expect(value).toMatchObject({ schemaStatus: 'limit-error', elapsedMs: 0, results: [{ status: 'not-run', expectationMatched: null }] })
    expect(factory).toHaveBeenCalledOnce()
  })
  it('constructs the Vite module worker through the default browser adapter', async () => {
    const worker = new FakeWorker()
    const MockWorker = vi.fn(function (_url: URL, _options: WorkerOptions) { return worker })
    vi.stubGlobal('Worker', MockWorker)
    const runner = createValidationRunner()
    const pending = runner.runSuite(request())
    expect(MockWorker).toHaveBeenCalledWith(expect.any(URL), { type: 'module' })
    expect(String(MockWorker.mock.calls[0]![0])).toContain('workers/validation.worker.ts')
    worker.reply(response())
    await pending
  })
  it('recovers cleanly after a timeout', async () => {
    const worker = new FakeWorker()
    const runner = createValidationRunner({ workerFactory: () => worker })
    const first = runner.runSuite(request())
    await vi.advanceTimersByTimeAsync(LIMITS.timeoutMs)
    expect((await first).schemaErrors[0]!.message).toContain('2000 ms')
    const second = runner.runSuite(request('recovery'))
    worker.reply(response('recovery'))
    expect((await second).schemaStatus).toBe('valid')
  })
})
