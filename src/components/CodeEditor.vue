<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ modelValue: string; label: string; id: string; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const lines = computed(() => Math.min(props.modelValue.split('\n').length, 1000))
function input(event: Event) { emit('update:modelValue', (event.target as HTMLTextAreaElement).value) }
</script>
<template>
  <div class="code-editor">
    <div class="line-numbers" aria-hidden="true"><span v-for="line in lines" :key="line">{{ line }}</span></div>
    <textarea :id="id" :aria-label="label" :value="modelValue" :readonly="readonly" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" @input="input" />
  </div>
</template>
