<script setup lang="ts">
import { computed, ref } from 'vue'
const props = defineProps<{ modelValue: string; label: string; id: string; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const LINE_HEIGHT = 24
const scrollTop = ref(0)
const firstLine = computed(() => Math.floor(scrollTop.value / LINE_HEIGHT))
const lines = computed(() => Array.from({ length: Math.min(50, Math.max(0, props.modelValue.split('\n').length - firstLine.value)) }, (_, index) => firstLine.value + index + 1))
const gutterOffset = computed(() => -Math.round((scrollTop.value % LINE_HEIGHT) * 100) / 100)
function scroll(event: Event) { scrollTop.value = (event.target as HTMLTextAreaElement).scrollTop }
function input(event: Event) { emit('update:modelValue', (event.target as HTMLTextAreaElement).value) }
</script>
<template>
  <div class="code-editor">
    <div class="line-numbers" aria-hidden="true"><div class="line-number-window" :style="{ transform: `translateY(${gutterOffset}px)` }"><span v-for="line in lines" :key="line">{{ line }}</span></div></div>
    <textarea :id="id" :aria-label="label" :value="modelValue" :readonly="readonly" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" @input="input" @scroll="scroll" />
  </div>
</template>
