import { computed, onUnmounted, ref, watch } from 'vue'
import type { Fixture, SuiteResponse, TestPack } from '../domain/types'
import { LIMITS } from '../domain/limits'
import { EXAMPLE_PACKS } from '../domain/examples'
import { createValidationRunner } from '../services/validationRunner'
import type { MessageKey } from '../i18n'
export function clonePack(pack: TestPack): TestPack { return JSON.parse(JSON.stringify(pack)) as TestPack }
export function useBench(t: (key: MessageKey) => string) {
  const pack = ref<TestPack>(clonePack(EXAMPLE_PACKS[0]!.pack))
  const selectedId = ref(pack.value.fixtures[1]?.id ?? pack.value.fixtures[0]?.id ?? '')
  const response = ref<SuiteResponse | null>(null)
  const running = ref(false)
  const stale = ref(false)
  const runner = createValidationRunner()
  let sequence = 0
  const selected = computed(() => pack.value.fixtures.find(fixture => fixture.id === selectedId.value))
  watch(pack, () => {
    sequence += 1
    runner.cancel()
    stale.value = response.value !== null || running.value
    response.value = null
    running.value = false
  }, { deep: true, flush: 'sync' })
  async function run() {
    const current = ++sequence
    running.value = true
    stale.value = false
    const result = await runner.runSuite({ runId: String(current), schemaText: pack.value.schemaText, fixtures: clonePack(pack.value).fixtures })
    if (current !== sequence) return
    response.value = result
    running.value = false
  }
  function cancel() {
    sequence += 1
    runner.cancel()
    running.value = false
    stale.value = false
    response.value = { runId: String(sequence), schemaStatus: 'cancelled', schemaErrors: [], results: [], elapsedMs: 0 }
  }
  function replace(next: TestPack) {
    pack.value = clonePack(next)
    selectedId.value = pack.value.fixtures[0]?.id ?? ''
    stale.value = false
  }
  function empty() { replace({ version: 1, title: 'Untitled test pack', dialect: '2020-12', schemaText: '{\n  "$schema": "https://json-schema.org/draft/2020-12/schema",\n  "type": "object"\n}', fixtures: [] }) }
  function add() {
    if (pack.value.fixtures.length >= 50) return
    const fixture: Fixture = { id: crypto.randomUUID(), name: `${t('newFixture')} ${pack.value.fixtures.length + 1}`, inputText: '{\n  \n}', expected: 'valid' }
    pack.value.fixtures.push(fixture)
    selectedId.value = fixture.id
  }
  function rename(value: string) {
    if (selected.value) selected.value.name = value.trim().slice(0, LIMITS.nameLength) || t('newFixture')
  }
  function duplicate(id: string) {
    const original = pack.value.fixtures.find(fixture => fixture.id === id)
    if (!original || pack.value.fixtures.length >= 50) return
    const suffix = ` (${t('copySuffix')})`
    const copy = { ...original, id: crypto.randomUUID(), name: `${original.name.slice(0, LIMITS.nameLength - suffix.length)}${suffix}` }
    pack.value.fixtures.push(copy)
    selectedId.value = copy.id
  }
  function remove(id: string) {
    pack.value.fixtures = pack.value.fixtures.filter(fixture => fixture.id !== id)
    if (selectedId.value === id) selectedId.value = pack.value.fixtures[0]?.id ?? ''
  }
  onUnmounted(() => { sequence += 1; runner.cancel() })
  return { pack, selectedId, selected, response, running, stale, run, cancel, replace, empty, add, rename, duplicate, remove }
}
