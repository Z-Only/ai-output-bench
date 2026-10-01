<script setup lang="ts">
import type { Fixture, FixtureResult } from '../domain/types'
import type { MessageKey } from '../i18n'
defineProps<{ fixtures: Fixture[]; results: FixtureResult[]; selectedId: string; t: (key: MessageKey) => string }>()
defineEmits<{ select: [id: string]; add: []; duplicate: [id: string]; remove: [id: string] }>()
function verdict(result?: FixtureResult) { return result?.expectationMatched === true ? 'passed' : result?.expectationMatched === false ? 'failed' : 'pending' }
</script>
<template>
  <section class="panel fixture-panel" aria-labelledby="fixtures-title">
    <header class="panel-heading"><h2 id="fixtures-title">{{ t('fixtures') }} <span class="count">{{ fixtures.length }}</span></h2><button class="button compact" :disabled="fixtures.length >= 50" @click="$emit('add')"><span aria-hidden="true">＋</span>{{ t('add') }}</button></header>
    <table v-if="fixtures.length" class="fixture-table">
      <thead><tr><th scope="col">{{ t('name') }}</th><th scope="col">{{ t('expect') }}</th><th scope="col">{{ t('output') }}</th><th scope="col">{{ t('test') }}</th><th scope="col">{{ t('actions') }}</th></tr></thead>
      <tbody><tr v-for="fixture in fixtures" :key="fixture.id" :class="{ selected: fixture.id === selectedId }">
        <th scope="row"><button class="fixture-select" :aria-pressed="fixture.id === selectedId" @click="$emit('select', fixture.id)">{{ fixture.name }}</button></th>
        <td :data-label="t('expect')">{{ t(fixture.expected) }}</td>
        <td :data-label="t('output')">{{ t(results.find(result => result.id === fixture.id)?.status ?? 'not-run') }}</td>
        <td :data-label="t('test')" :class="'test-' + verdict(results.find(result => result.id === fixture.id))">{{ t(verdict(results.find(result => result.id === fixture.id))) }}</td>
        <td class="row-actions"><button class="icon-button" :disabled="fixtures.length >= 50" :aria-label="`${t('duplicate')} ${fixture.name}`" @click="$emit('duplicate', fixture.id)"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/></svg></button><button class="icon-button" :aria-label="`${t('remove')} ${fixture.name}`" @click="$emit('remove', fixture.id)"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" /></svg></button></td>
      </tr></tbody>
    </table>
    <div v-else class="fixtures-empty"><h3>{{ t('noFixtures') }}</h3><p>{{ t('addHelp') }}</p><button class="button" @click="$emit('add')">{{ t('addFirst') }}</button></div>
  </section>
</template>
