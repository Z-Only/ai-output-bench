<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { exportPack, importPack } from '../domain/pack'
import type { TestPack } from '../domain/types'
import type { MessageKey } from '../i18n'
const props = defineProps<{ mode: 'import' | 'export'; pack: TestPack; t: (key: MessageKey) => string }>()
const emit = defineEmits<{ close: []; imported: [pack: TestPack] }>()
const dialog = ref<HTMLDialogElement>()
const text = ref(props.mode === 'export' ? exportPack(props.pack) : '')
const check = props.mode === 'export' ? importPack(text.value) : null
const errors = ref<string[]>(check && !check.ok ? check.errors : [])
const downloadState = ref<'download' | 'downloadRequested' | 'downloadFailed'>('download')
const clipboardState = ref<'copy' | 'copied' | 'copyFailed'>('copy')
const title = computed(() => props.t(props.mode))
onMounted(() => dialog.value!.showModal())
function importText() {
  const result = importPack(text.value)
  if (!result.ok) { errors.value = result.errors; return }
  emit('imported', result.pack)
}
async function copy() {
  try { await navigator.clipboard.writeText(text.value); clipboardState.value = 'copied' } catch { clipboardState.value = 'copyFailed' }
}
function download() {
  let url: string | undefined
  try {
    url = URL.createObjectURL(new Blob([text.value], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'ai-output-bench-pack.json'
    link.click()
    downloadState.value = 'downloadRequested'
  } catch { downloadState.value = 'downloadFailed' }
  finally { if (url) { const created = url; setTimeout(() => URL.revokeObjectURL(created), 1000) } }
}
</script>
<template>
  <dialog ref="dialog" class="pack-dialog" aria-labelledby="pack-dialog-title" @cancel.prevent="emit('close')">
    <header class="dialog-heading"><h2 id="pack-dialog-title">{{ title }}</h2><button class="icon-button" :aria-label="t('close')" @click="emit('close')">×</button></header>
    <p class="dialog-description">{{ t(mode === 'import' ? 'importHelp' : 'exportHelp') }}</p>
    <label for="pack-text" class="field-label">{{ t('packJson') }}</label>
    <textarea id="pack-text" v-model="text" class="pack-text" :readonly="mode === 'export'" spellcheck="false" autocapitalize="off" />
    <p v-if="mode === 'export' && errors.length" class="form-errors">{{ t('exportInvalid') }}</p>
    <ul v-if="errors.length" class="form-errors" role="alert"><li v-for="error in errors" :key="error">{{ error }}</li></ul>
    <p v-if="clipboardState === 'copyFailed'" role="status">{{ t('copyFailed') }}</p>
    <p v-if="downloadState !== 'download'" role="status">{{ t(downloadState) }}</p>
    <footer class="dialog-actions">
      <button class="button" @click="emit('close')">{{ t('close') }}</button>
      <template v-if="mode === 'export'"><button class="button" :disabled="errors.length > 0" @click="download">{{ t('download') }}</button><button class="button primary" :disabled="errors.length > 0" @click="copy">{{ t(clipboardState === 'copied' ? 'copied' : 'copy') }}</button></template>
      <button v-else class="button primary" @click="importText">{{ t('importAction') }}</button>
    </footer>
  </dialog>
</template>
