import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import App from '../src/App.vue'
import CodeEditor from '../src/components/CodeEditor.vue'
import ConfirmDialog from '../src/components/ConfirmDialog.vue'
import FixtureTable from '../src/components/FixtureTable.vue'
import PackDialog from '../src/components/PackDialog.vue'
import ResultPanel from '../src/components/ResultPanel.vue'
import { messages, type MessageKey } from '../src/i18n'
import { useBench } from '../src/composables/useBench'
import { readPreference, usePreferences } from '../src/composables/usePreferences'
import { EXAMPLE_PACKS } from '../src/domain/examples'
import { exportPack } from '../src/domain/pack'
import type { Fixture, SuiteRequest, SuiteResponse } from '../src/domain/types'
const mocks = vi.hoisted(() => ({ run: vi.fn(), cancel: vi.fn() }))
vi.mock('../src/services/validationRunner', () => ({ createValidationRunner: () => ({ runSuite: mocks.run, cancel: mocks.cancel }) }))
const t = (key: MessageKey) => messages.en[key]
const fixture: Fixture = { id: 'a', name: 'Example', inputText: '{}', expected: 'invalid' }
const response = (overrides: Partial<SuiteResponse> = {}): SuiteResponse => ({ runId: '1', schemaStatus: 'valid', schemaErrors: [], results: [{ id: 'a', status: 'invalid', expectationMatched: true, errors: [] }], elapsedMs: 1, ...overrides })
const wrappers: VueWrapper[] = []
function keep<T extends VueWrapper>(wrapper: T): T { wrappers.push(wrapper); return wrapper }
function button(wrapper: VueWrapper, name: string) { const found = wrapper.findAll('button').find(item => item.text() === name); if (!found) throw new Error(`Button not found: ${name}`); return found }
const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); media.matches = false
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.open = false })
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true })
  mocks.run.mockImplementation(async (request: SuiteRequest) => response({ runId: request.runId, results: request.fixtures.map(item => ({ id: item.id, status: item.expected, expectationMatched: true, errors: [] })) }))
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('editor and dialogs', () => {
  it('edits plain text safely and caps visual line numbering', async () => {
    const wrapper = keep(mount(CodeEditor, { props: { id: 'code', label: 'JSON', modelValue: '{}\n[]' } }))
    expect(wrapper.findAll('.line-numbers span')).toHaveLength(2)
    await wrapper.get('textarea').setValue('<script>not executable</script>')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['<script>not executable</script>'])
    expect(wrapper.find('script').exists()).toBe(false)
    await wrapper.setProps({ modelValue: '\n'.repeat(1100), readonly: true })
    expect(wrapper.findAll('.line-numbers span')).toHaveLength(1000)
    expect(wrapper.get('textarea').attributes('readonly')).toBeDefined()
  })
  it('confirms or cancels with native modal focus containment', async () => {
    const wrapper = keep(mount(ConfirmDialog, { props: { title: 'Replace?', description: 'Content is replaced', cancelLabel: 'Keep', confirmLabel: 'Replace' } }))
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    await button(wrapper, 'Replace').trigger('click'); expect(wrapper.emitted('confirm')).toHaveLength(1)
    await button(wrapper, 'Keep').trigger('click'); await wrapper.get('dialog').trigger('cancel')
    expect(wrapper.emitted('cancel')).toHaveLength(2)
  })
  it('offers full export text, copy feedback, fallback, and download', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = keep(mount(PackDialog, { props: { mode: 'export', pack: EXAMPLE_PACKS[0]!.pack, t } }))
    expect(wrapper.get('textarea').element.value).toBe(exportPack(EXAMPLE_PACKS[0]!.pack))
    expect(wrapper.get('textarea').attributes('readonly')).toBeDefined()
    await button(wrapper, 'Copy JSON').trigger('click'); await flushPromises()
    expect(writeText).toHaveBeenCalledWith(exportPack(EXAMPLE_PACKS[0]!.pack))
    expect(button(wrapper, 'Copied')).toBeTruthy()
    writeText.mockRejectedValueOnce(new Error('Denied'))
    await button(wrapper, 'Copied').trigger('click'); await flushPromises()
    expect(wrapper.get('[role=status]').text()).toContain('Select and copy')
    vi.useFakeTimers()
    const revoke = vi.fn(); const create = vi.fn(() => 'blob:test')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await button(wrapper, 'Download JSON').trigger('click')
    expect(create).toHaveBeenCalled(); expect(click).toHaveBeenCalled(); expect(wrapper.text()).toContain('Download requested')
    vi.runAllTimers(); expect(revoke).toHaveBeenCalledWith('blob:test')
    click.mockImplementationOnce(() => { throw new Error('blocked') }); await button(wrapper, 'Download JSON').trigger('click'); expect(wrapper.text()).toContain('Download could not start'); vi.runAllTimers(); expect(revoke).toHaveBeenCalledTimes(2)
    create.mockImplementationOnce(() => { throw new Error('unsupported') }); await button(wrapper, 'Download JSON').trigger('click'); expect(wrapper.text()).toContain('Download could not start'); vi.runAllTimers(); expect(revoke).toHaveBeenCalledTimes(2)
    await button(wrapper, 'Close').trigger('click'); await wrapper.get('dialog').trigger('cancel'); await wrapper.get('[aria-label=Close]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(3)
  })
  it('blocks unusable exports without changing raw input', () => {
    const pack = { ...EXAMPLE_PACKS[0]!.pack, schemaText: 'x'.repeat(130 * 1024) }
    const wrapper = keep(mount(PackDialog, { props: { mode: 'export', pack, t } }))
    expect(wrapper.text()).toContain('cannot be re-imported'); expect(button(wrapper, 'Copy JSON').attributes('disabled')).toBeDefined(); expect(button(wrapper, 'Download JSON').attributes('disabled')).toBeDefined()
    expect(wrapper.get('textarea').element.value).toContain(pack.schemaText); expect(pack.schemaText).toHaveLength(130 * 1024)
  })
  it('validates import atomically and only emits a complete accepted pack', async () => {
    const wrapper = keep(mount(PackDialog, { props: { mode: 'import', pack: EXAMPLE_PACKS[0]!.pack, t } }))
    await wrapper.get('textarea').setValue('{broken')
    await button(wrapper, 'Validate & replace workspace').trigger('click')
    expect(wrapper.get('[role=alert]').text()).toBeTruthy(); expect(wrapper.emitted('imported')).toBeUndefined()
    await wrapper.get('textarea').setValue(exportPack(EXAMPLE_PACKS[1]!.pack))
    await button(wrapper, 'Validate & replace workspace').trigger('click')
    expect(wrapper.emitted('imported')?.[0]?.[0]).toEqual(EXAMPLE_PACKS[1]!.pack)
  })
})

describe('test verdicts and diagnostics', () => {
  it('distinguishes initial, running, stale, empty and result states', async () => {
    const wrapper = keep(mount(ResultPanel, { props: { response: null, fixture, running: false, stale: false, t } }))
    expect(wrapper.text()).toContain('Ready when you are')
    await button(wrapper, '▶Run all tests').trigger('click'); expect(wrapper.emitted('run')).toHaveLength(1)
    await wrapper.setProps({ running: true }); expect(wrapper.text()).toContain('Running tests')
    await button(wrapper, '■Cancel run').trigger('click'); expect(wrapper.emitted('cancel')).toHaveLength(1)
    await wrapper.setProps({ running: false, stale: true }); expect(wrapper.text()).toContain('Inputs changed')
    await wrapper.setProps({ stale: false, response: response() }); expect(wrapper.text()).toContain('Expectation met'); expect(wrapper.text()).toContain('Output is Invalid · Expected Invalid'); expect(wrapper.text()).toContain('No validation issues')
    await wrapper.setProps({ response: response({ results: [{ id: 'a', status: 'valid', expectationMatched: false, errors: [] }] }) })
    expect(wrapper.text()).toContain('Expectation not met'); expect(wrapper.find('.verdict-fail').exists()).toBe(true)
    await wrapper.setProps({ response: response({ results: [{ id: 'a', status: 'not-run', expectationMatched: null, errors: [] }] }) })
    expect(wrapper.text()).toContain('No test verdict'); expect(wrapper.find('.verdict-neutral').exists()).toBe(true)
    await wrapper.setProps({ fixture: undefined, response: response({ results: [] }) }); expect(wrapper.find('.selected-result').exists()).toBe(false)
  })
  it('shows exact pointers and indeterminate schema/runtime states without claiming a pass', async () => {
    const issue = { instancePath: '', schemaPath: '#/required', keyword: 'required', message: 'must have required property price' }
    const wrapper = keep(mount(ResultPanel, { props: { response: response({ results: [{ id: 'a', status: 'invalid', expectationMatched: true, errors: [issue, { ...issue, instancePath: '/items/0/name' }] }] }), fixture, running: false, stale: false, t } }))
    expect(wrapper.text()).toContain('(root, empty pointer)'); expect(wrapper.text()).toContain('/items/0/name'); expect(wrapper.text()).toContain('#/required')
    for (const schemaStatus of ['invalid', 'parse-error', 'limit-error', 'runtime-error', 'timeout', 'cancelled'] as const) {
      await wrapper.setProps({ response: response({ schemaStatus, schemaErrors: [issue] }) })
      expect(wrapper.find('.verdict').exists()).toBe(false)
      expect(wrapper.text()).toContain(schemaStatus === 'invalid' || schemaStatus === 'parse-error' ? 'Schema needs attention' : t(schemaStatus))
    }
    await wrapper.setProps({ response: response({ results: [], schemaErrors: [] }) }); expect(wrapper.find('.diagnostics').exists()).toBe(false)
  })
  it('uses named fixtures, accessible selection and separate validity/verdict columns', async () => {
    const fixtures = [fixture, { ...fixture, id: 'b', name: 'Second', expected: 'valid' as const }, { ...fixture, id: 'c', name: 'Third' }]
    const results = [{ id: 'a', status: 'invalid' as const, expectationMatched: true, errors: [] }, { id: 'b', status: 'invalid' as const, expectationMatched: false, errors: [] }]
    const wrapper = keep(mount(FixtureTable, { props: { fixtures, results, selectedId: 'a', t } }))
    expect(wrapper.get('[aria-pressed=true]').text()).toBe('Example'); expect(wrapper.text()).toContain('Passed'); expect(wrapper.text()).toContain('Failed'); expect(wrapper.text()).toContain('Not run')
    await button(wrapper, 'Second').trigger('click'); expect(wrapper.emitted('select')?.[0]).toEqual(['b'])
    await wrapper.get('[aria-label="Duplicate Example"]').trigger('click'); expect(wrapper.emitted('duplicate')?.[0]).toEqual(['a'])
    await wrapper.get('[aria-label="Remove Example"]').trigger('click'); expect(wrapper.emitted('remove')?.[0]).toEqual(['a'])
    await button(wrapper, '＋Add fixture').trigger('click'); expect(wrapper.emitted('add')).toHaveLength(1)
    await wrapper.setProps({ fixtures: Array.from({ length: 50 }, (_, index) => ({ ...fixture, id: String(index) })) })
    expect(button(wrapper, '＋Add fixture').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ fixtures: [] }); expect(wrapper.text()).toContain('No fixtures yet')
    await button(wrapper, 'Add your first fixture').trigger('click'); expect(wrapper.emitted('add')).toHaveLength(2)
  })
})

describe('privacy-safe preferences', () => {
  it('restores only supported settings and tracks system theme changes', async () => {
    localStorage.setItem('output-bench-theme', 'invalid'); expect(readPreference('output-bench-theme', ['light'], 'system')).toBe('system')
    localStorage.setItem('output-bench-locale', 'zh')
    const wrapper = keep(mount(defineComponent({ setup: usePreferences, template: '<div>{{ t("heading") }}</div>' })))
    expect(wrapper.text()).toContain('检查'); expect(document.documentElement.lang).toBe('zh-CN'); expect(document.documentElement.dataset.theme).toBe('light')
    const vm = wrapper.vm as unknown as ReturnType<typeof usePreferences>
    ;(vm as any).theme = 'dark'; (vm as any).locale = 'en'; await nextTick()
    expect(document.documentElement.dataset.theme).toBe('dark'); expect(document.documentElement.lang).toBe('en')
    ;(vm as any).theme = 'system'; media.matches = true; await nextTick()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(media.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    media.matches = false; media.addEventListener.mock.calls[0]![1](); expect(document.documentElement.dataset.theme).toBe('light')
    expect(Object.keys(localStorage)).toEqual(expect.arrayContaining(['output-bench-locale', 'output-bench-theme']))
  })
  it('keeps preferences functional when browser storage is denied', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    expect(readPreference('x', ['a'], 'b')).toBe('b')
    const wrapper = keep(mount(defineComponent({ setup: usePreferences, template: '<span>{{ theme }}</span>' })))
    ;(wrapper.vm as any).theme = 'light'; await nextTick(); expect(wrapper.text()).toBe('light')
  })
})

describe('workspace state and stale-response protection', () => {
  function bench() { const wrapper = keep(mount(defineComponent({ setup: () => useBench(t), template: '<div />' }))); return wrapper.vm as any }
  it('adds, duplicates, removes and bounds fixtures without persisting input', async () => {
    const vm = bench(); const initial = vm.pack.fixtures.length
    vm.rename('ignored'); vm.add(); expect(vm.pack.fixtures).toHaveLength(initial + 1); expect(vm.selected.name).toContain('New fixture')
    const addedId = vm.selectedId; vm.rename(''); expect(vm.selected.name).toBe('New fixture'); vm.rename('x'.repeat(130)); expect(vm.selected.name).toHaveLength(120); vm.duplicate(addedId); expect(vm.selected.name).toContain('(copy)'); expect(vm.selected.name).toHaveLength(120)
    vm.duplicate('missing'); expect(vm.pack.fixtures).toHaveLength(initial + 2)
    const selected = vm.selectedId; vm.remove(addedId); expect(vm.selectedId).toBe(selected)
    vm.remove(selected); expect(vm.selectedId).toBe(vm.pack.fixtures[0].id)
    vm.pack.fixtures = Array.from({ length: 50 }, (_, index) => ({ ...fixture, id: String(index) })); vm.add(); vm.duplicate('0'); expect(vm.pack.fixtures).toHaveLength(50)
    vm.empty(); vm.rename('ignored'); expect(vm.pack.fixtures).toHaveLength(0); expect(vm.selectedId).toBe(''); expect(vm.selected).toBeUndefined(); expect(vm.stale).toBe(false)
    vm.add(); vm.remove(vm.selectedId); expect(vm.selectedId).toBe('')
    vm.replace(EXAMPLE_PACKS[1]!.pack); expect(vm.pack.title).toBe('Support triage')
    vm.pack.fixtures[0].name = 'Private local data'; expect(EXAMPLE_PACKS[1]!.pack.fixtures[0]!.name).not.toBe('Private local data')
    expect(localStorage.length).toBe(0)
  })
  it('invalidates old results on edit and ignores responses arriving after edits or cancellation', async () => {
    const vm = bench(); await vm.run(); expect(vm.response).not.toBeNull(); expect(vm.running).toBe(false)
    vm.pack.schemaText = '{}'; expect(vm.stale).toBe(true); expect(vm.response).toBeNull()
    let resolve!: (response: SuiteResponse) => void
    mocks.run.mockImplementation(() => new Promise<SuiteResponse>(done => { resolve = done }))
    const task = vm.run(); expect(vm.running).toBe(true)
    vm.pack.fixtures[0].inputText = 'changed'; expect(vm.running).toBe(false); expect(vm.stale).toBe(true)
    resolve(response()); await task; expect(vm.response).toBeNull()
    const cancelled = vm.run(); vm.cancel(); expect(vm.running).toBe(false); expect(vm.response.schemaStatus).toBe('cancelled')
    resolve(response()); await cancelled; expect(vm.response.schemaStatus).toBe('cancelled')
  })
  it('chooses the first or empty fixture safely for small template collections', () => {
    const original = EXAMPLE_PACKS[0]!.pack.fixtures
    EXAMPLE_PACKS[0]!.pack.fixtures = [fixture]; expect(bench().selectedId).toBe('a')
    EXAMPLE_PACKS[0]!.pack.fixtures = []; expect(bench().selectedId).toBe('')
    EXAMPLE_PACKS[0]!.pack.fixtures = original
  })
})

describe('complete workspace interactions', () => {
  it('loads real templates, confirms replacements, imports/exports, changes locale/theme and edits fixtures', async () => {
    const wrapper = keep(mount(App)); await flushPromises()
    expect(wrapper.text()).toContain('Test the shape'); expect(mocks.run).toHaveBeenCalledTimes(1)
    await wrapper.get('#schema-editor').setValue('{"type":"object"}'); expect(wrapper.text()).toContain('Inputs changed')
    await wrapper.get('#output-editor').setValue('{"hello":true}')
    await wrapper.get('.fixture-fields input').setValue('Edited fixture')
    await wrapper.get('.fixture-fields select').setValue('invalid')
    await button(wrapper, 'Complete product').trigger('click'); expect((wrapper.get('.fixture-fields input').element as HTMLInputElement).value).toBe('Complete product')
    await wrapper.get('[aria-label="Duplicate Complete product"]').trigger('click'); expect(wrapper.text()).toContain('Complete product (copy)')
    await wrapper.get('[aria-label="Remove Complete product (copy)"]').trigger('click'); await button(wrapper, 'Keep current work').trigger('click'); expect(wrapper.text()).toContain('Complete product (copy)')
    await wrapper.get('[aria-label="Remove Complete product (copy)"]').trigger('click'); await button(wrapper, 'Remove fixture').trigger('click'); expect(wrapper.text()).not.toContain('Complete product (copy)')
    await button(wrapper, 'Support triage').trigger('click'); await button(wrapper, 'Replace workspace').trigger('click'); expect(wrapper.text()).toContain('Billing question')
    await button(wrapper, 'Empty workspace').trigger('click'); await button(wrapper, 'Replace workspace').trigger('click'); expect(wrapper.text()).toContain('No fixtures yet')
    await button(wrapper, 'Add fixture').trigger('click'); expect(wrapper.find('#output-editor').exists()).toBe(true)
    await button(wrapper, 'Export pack').trigger('click'); expect((wrapper.get('#pack-text').element as HTMLTextAreaElement).value).toContain('schemaText'); await button(wrapper, 'Close').trigger('click')
    await button(wrapper, 'Import pack').trigger('click'); await wrapper.get('#pack-text').setValue(exportPack(EXAMPLE_PACKS[0]!.pack)); await button(wrapper, 'Validate & replace workspace').trigger('click'); expect(wrapper.find('dialog').exists()).toBe(false); expect(wrapper.text()).toContain('Complete product')
    await wrapper.get('[aria-label=Language]').setValue('zh'); expect(wrapper.text()).toContain('检查 AI 输出的结构'); expect(wrapper.text()).toContain('验证规则')
    await wrapper.get('[aria-label=主题]').setValue('dark'); expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.length).toBe(2)
  })
  it('runs via keyboard, suppresses shortcuts in dialogs and removes window listeners', async () => {
    const wrapper = keep(mount(App)); await flushPromises()
    const start = mocks.run.mock.calls.length
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, cancelable: true })); await flushPromises(); expect(mocks.run).toHaveBeenCalledTimes(start + 1)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true })); await flushPromises(); expect(mocks.run).toHaveBeenCalledTimes(start + 2)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true })); expect(mocks.run).toHaveBeenCalledTimes(start + 2)
    await button(wrapper, 'Export pack').trigger('click'); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })); expect(mocks.run).toHaveBeenCalledTimes(start + 2); await button(wrapper, 'Close').trigger('click')
    await button(wrapper, 'Empty workspace').trigger('click'); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })); expect(mocks.run).toHaveBeenCalledTimes(start + 2); await button(wrapper, 'Keep current work').trigger('click')
    const off = vi.spyOn(window, 'removeEventListener'); wrapper.unmount(); expect(off).toHaveBeenCalledWith('keydown', expect.any(Function)); wrappers.splice(wrappers.indexOf(wrapper), 1)
  })
})


it('mounts the production entry point', async () => {
  const target = document.createElement('div'); target.id = 'app'; document.body.appendChild(target)
  await import('../src/main'); await flushPromises()
  expect(target.textContent).toContain('AI Output Bench')
  ;(target as any).__vue_app__.unmount(); target.remove()
})


describe('dialog keyboard focus restoration', () => {
  it.each(['pack', 'confirm'] as const)('returns focus to the %s dialog opener after Escape and cancellation', async mode => {
    const wrapper = keep(mount(defineComponent({
      components: { PackDialog, ConfirmDialog },
      setup: () => ({ visible: ref(false), mode, pack: EXAMPLE_PACKS[0]!.pack, t }),
      template: `<div><button id="opener" @click="visible=true">Open</button><PackDialog v-if="visible && mode==='pack'" mode="export" :pack="pack" :t="t" @close="visible=false"/><ConfirmDialog v-if="visible && mode==='confirm'" title="Confirm" description="Replace" cancel-label="Cancel" confirm-label="OK" @cancel="visible=false" @confirm="visible=false"/></div>`,
    }), { attachTo: document.body }))
    const opener = wrapper.get('#opener').element as HTMLButtonElement
    opener.focus(); await wrapper.get('#opener').trigger('click')
    const dialog = wrapper.get('dialog').element as HTMLDialogElement
    expect(dialog.open).toBe(true)
    ;(wrapper.get('dialog button').element as HTMLButtonElement).focus()
    await wrapper.get('dialog').trigger('cancel'); await nextTick()
    expect(dialog.open).toBe(false); expect(document.activeElement).toBe(opener)
    await wrapper.get('#opener').trigger('click')
    await button(wrapper, mode === 'pack' ? 'Close' : 'Cancel').trigger('click'); await nextTick()
    expect(document.activeElement).toBe(opener)
  })
  it('uses the schema editor when confirmation removes or disables its opener', async () => {
    for (const action of ['remove', 'disable'] as const) {
      const wrapper = keep(mount(defineComponent({ components: { ConfirmDialog }, setup: () => ({ visible: ref(false), removed: ref(false), disabled: ref(false), action }), template: `<div><textarea id="schema-editor"/><button v-if="!removed" :disabled="disabled" id="fixture-opener" @click="visible=true">Delete</button><ConfirmDialog v-if="visible" title="Remove?" description="Removed" cancel-label="Cancel" confirm-label="OK" @confirm="visible=false; action==='remove' ? removed=true : disabled=true"/></div>` }), { attachTo: document.body }))
      ;(wrapper.get('#fixture-opener').element as HTMLButtonElement).focus(); await wrapper.get('#fixture-opener').trigger('click')
      await button(wrapper, 'OK').trigger('click'); await nextTick()
      expect(document.activeElement).toBe(wrapper.get('#schema-editor').element)
      wrapper.unmount(); wrappers.splice(wrappers.indexOf(wrapper), 1)
    }
  })
})

it('closes a modal safely when no element was focused before opening', async () => {
  const active = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null)
  const wrapper = keep(mount(ConfirmDialog, { props: { title: 'Confirm', description: 'No opener', cancelLabel: 'Cancel', confirmLabel: 'OK' } }))
  active.mockRestore()
  wrapper.unmount(); wrappers.splice(wrappers.indexOf(wrapper), 1)
  await nextTick(); expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
})
