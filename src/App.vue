<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CodeEditor from './components/CodeEditor.vue'
import ResultPanel from './components/ResultPanel.vue'
import FixtureTable from './components/FixtureTable.vue'
import PackDialog from './components/PackDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { usePreferences } from './composables/usePreferences'
import { useBench } from './composables/useBench'
import { EXAMPLE_PACKS } from './domain/examples'
const { locale, theme, t } = usePreferences()
const { pack, selectedId, selected, response, running, stale, run, cancel, replace, empty, add, rename, duplicate, remove } = useBench(t)
const dialogMode = ref<'import' | 'export' | null>(null)
const pending = ref<{ type: 'template' | 'remove'; value: string } | null>(null)
const activeTemplate = ref(EXAMPLE_PACKS[0]!.id)
const visibleResults = computed(() => stale.value ? [] : response.value?.results ?? [])
function confirm() {
  const action = pending.value!
  if (action.type === 'remove') remove(action.value)
  else {
    const example = EXAMPLE_PACKS.find(example => example.id === action.value)
    if (example) replace(example.pack); else empty()
    activeTemplate.value = action.value
  }
  pending.value = null
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !dialogMode.value && !pending.value) { event.preventDefault(); void run() }
}
onMounted(() => { window.addEventListener('keydown', keydown); void run() })
onUnmounted(() => window.removeEventListener('keydown', keydown))
</script>
<template>
  <a class="skip-link" href="#workspace">{{ t('schema') }}</a>
  <header class="app-header">
    <div class="brand"><span class="brand-mark" aria-hidden="true">[ ]</span><span>AI Output Bench</span></div>
    <div class="preferences"><label><span class="sr-only">{{ t('language') }}</span><select v-model="locale" :aria-label="t('language')"><option value="en">English</option><option value="zh">简体中文</option></select></label><label><span class="sr-only">{{ t('theme') }}</span><select v-model="theme" :aria-label="t('theme')"><option value="system">{{ t('system') }}</option><option value="light">{{ t('light') }}</option><option value="dark">{{ t('dark') }}</option></select></label></div>
  </header>
  <main id="workspace" class="workspace">
    <section class="intro"><div><h1>{{ t('heading') }}</h1><p>{{ t('subtitle') }}</p></div><div class="pack-actions"><button class="button" @click="dialogMode = 'import'">{{ t('import') }}</button><button class="button primary" @click="dialogMode = 'export'">{{ t('export') }}</button></div></section>
    <nav class="template-strip" :aria-label="t('start')"><span>{{ t('start') }}:</span><button v-for="example in EXAMPLE_PACKS" :key="example.id" class="button compact" :class="{ 'template-active': activeTemplate === example.id }" @click="pending = { type: 'template', value: example.id }">{{ example.label[locale] }}</button><button class="button compact" :class="{ 'template-active': activeTemplate === 'empty' }" @click="pending = { type: 'template', value: 'empty' }">{{ t('empty') }}</button></nav>
    <div class="editor-grid">
      <section class="panel schema-panel" aria-labelledby="schema-title"><header class="panel-heading"><h2 id="schema-title"><span class="step">01</span>{{ t('schema') }}</h2><span class="dialect">Draft 2020-12</span></header><CodeEditor id="schema-editor" v-model="pack.schemaText" :label="t('schema')" /></section>
      <section class="panel output-panel" aria-labelledby="output-title"><header class="panel-heading"><h2 id="output-title"><span class="step">02</span>{{ t('output') }}</h2></header>
        <template v-if="selected"><div class="fixture-fields"><label><span>{{ t('name') }}</span><input :value="selected.name" maxlength="120" @change="rename(($event.target as HTMLInputElement).value)" /></label><label><span>{{ t('expected') }}</span><select v-model="selected.expected"><option value="valid">{{ t('valid') }}</option><option value="invalid">{{ t('invalid') }}</option></select></label></div><CodeEditor id="output-editor" v-model="selected.inputText" :label="t('output')" /></template>
        <div v-else class="output-empty"><p>{{ t('emptyOutput') }}</p><button class="button" @click="add">{{ t('add') }}</button></div>
      </section>
      <ResultPanel :response="response" :fixture="selected" :running="running" :stale="stale" :t="t" @run="run" @cancel="cancel" />
    </div>
    <p class="privacy-note">{{ t('privacy') }}</p>
    <FixtureTable :fixtures="pack.fixtures" :results="visibleResults" :selected-id="selectedId" :t="t" @select="selectedId = $event" @add="add" @duplicate="duplicate" @remove="pending = { type: 'remove', value: $event }" />
    <footer class="workspace-footer"><p>{{ t('format') }}</p><span>{{ t('noModel') }}</span></footer>
    <details class="limits"><summary>{{ t('details') }}</summary><p>{{ t('detailText') }}</p><p>{{ t('caps') }}</p></details>
  </main>
  <PackDialog v-if="dialogMode" :mode="dialogMode" :pack="pack" :t="t" @close="dialogMode = null" @imported="replace($event); dialogMode = null; activeTemplate = ''" />
  <ConfirmDialog v-if="pending" :title="t(pending.type === 'remove' ? 'deleteTitle' : 'loadTemplate')" :description="t(pending.type === 'remove' ? 'deleteHelp' : 'replaceHelp')" :cancel-label="t('keep')" :confirm-label="t(pending.type === 'remove' ? 'confirmRemove' : 'replace')" @cancel="pending = null" @confirm="confirm" />
</template>
