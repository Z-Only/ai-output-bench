<script setup lang="ts">
import { onMounted, ref } from 'vue'
defineProps<{ title: string; description: string; cancelLabel: string; confirmLabel: string }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const dialog = ref<HTMLDialogElement>()
onMounted(() => dialog.value!.showModal())
</script>
<template>
  <dialog ref="dialog" class="confirm-dialog" aria-labelledby="confirm-title" @cancel.prevent="emit('cancel')">
    <h2 id="confirm-title">{{ title }}</h2><p>{{ description }}</p>
    <div class="dialog-actions"><button autofocus class="button" @click="emit('cancel')">{{ cancelLabel }}</button><button class="button primary" @click="emit('confirm')">{{ confirmLabel }}</button></div>
  </dialog>
</template>
