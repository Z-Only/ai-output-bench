import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue'

/** Native modal containment plus explicit restoration when Vue removes the dialog. */
export function useModalFocus(dialog: Ref<HTMLDialogElement | undefined>) {
  let opener: HTMLElement | null = null
  onMounted(() => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.value!.showModal()
  })
  onBeforeUnmount(() => {
    dialog.value!.close()
    // Wait for the parent to finish removing a deleted fixture's opener.
    void nextTick(() => {
      const target = opener?.isConnected && !opener.matches(':disabled') ? opener : document.querySelector<HTMLElement>('#schema-editor')
      target?.focus()
    })
  })
}
