<script setup lang="ts">
import type { Fixture, SuiteResponse, FixtureResult, ValidationIssue } from '../domain/types'
import type { MessageKey } from '../i18n'
import { computed } from 'vue'
const props = defineProps<{ response: SuiteResponse | null; fixture?: Fixture; running: boolean; stale: boolean; t: (key: MessageKey) => string }>()
defineEmits<{ run: []; cancel: [] }>()
const result = computed<FixtureResult | undefined>(() => props.response?.results.find(result => result.id === props.fixture?.id))
const issues = computed<ValidationIssue[]>(() => props.response?.schemaStatus === 'valid' ? result.value?.errors ?? [] : props.response?.schemaErrors ?? [])
const matched = computed(() => props.response?.results.filter(result => result.expectationMatched).length ?? 0)
const schemaProblem = computed(() => props.response !== null && props.response.schemaStatus !== 'valid')
</script>
<template>
  <section class="panel results-panel" aria-labelledby="results-title">
    <header class="panel-heading"><h2 id="results-title">{{ t('results') }}</h2></header>
    <div class="results-body">
      <button v-if="running" class="button primary run-button" @click="$emit('cancel')"><span aria-hidden="true">■</span>{{ t('cancel') }}</button>
      <button v-else class="button primary run-button" @click="$emit('run')"><span aria-hidden="true">▶</span>{{ t('run') }}</button>
      <span class="shortcut">{{ t('shortcut') }}</span>
      <div class="result-live" aria-live="polite" aria-atomic="true">
        <p v-if="running" class="summary">{{ t('running') }}</p>
        <p v-else-if="stale" class="stale-note">{{ t('stale') }}</p>
        <template v-else-if="response">
          <p v-if="schemaProblem" class="summary status-fail">{{ response.schemaStatus === 'invalid' || response.schemaStatus === 'parse-error' ? t('schemaInvalid') : t(response.schemaStatus) }}</p>
          <p v-else-if="!response.results.length" class="summary">{{ t('schemaReady') }}</p>
          <p v-else class="summary"><span :class="matched === response.results.length ? 'status-pass' : 'status-fail'" aria-hidden="true">{{ matched === response.results.length ? '✓' : '!' }}</span>{{ matched }} / {{ response.results.length }} {{ t('expectations') }}</p>
          <div v-if="result && !schemaProblem" class="selected-result">
            <h3>{{ t('selected') }}</h3>
            <div class="verdict" :class="result.expectationMatched === true ? 'verdict-pass' : result.expectationMatched === false ? 'verdict-fail' : 'verdict-neutral'">
              <strong>{{ result.expectationMatched === true ? t('met') : result.expectationMatched === false ? t('unmet') : t('indeterminate') }}</strong>
              <p>{{ t('outputIs') }} {{ t(result.status) }} · {{ t('expectedIs') }} {{ t(fixture!.expected) }}</p>
            </div>
          </div>
          <div v-if="issues.length" class="diagnostics">
            <h3>{{ t('diagnosis') }}</h3>
            <article v-for="(issue, index) in issues" :key="index" class="issue">
              <p class="issue-message">{{ issue.message }}</p>
              <dl><dt>{{ t('instance') }}</dt><dd><code>{{ issue.instancePath === '' ? t('rootPointer') : issue.instancePath }}</code></dd>
              <dt>{{ t('keyword') }}</dt><dd><code>{{ issue.keyword }}</code></dd>
              <dt>{{ t('schemaPointer') }}</dt><dd><code>{{ issue.schemaPath }}</code></dd></dl>
            </article>
          </div>
          <p v-else-if="result && !schemaProblem" class="quiet">{{ t('nothing') }}</p>
        </template>
        <div v-else class="result-empty"><span class="empty-bracket" aria-hidden="true">[ ]</span><h3>{{ t('ready') }}</h3><p>{{ t('readyHelp') }}</p></div>
      </div>
    </div>
  </section>
</template>
