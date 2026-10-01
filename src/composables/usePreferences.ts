import { onMounted, onUnmounted, ref, watch } from 'vue'
import { messages, type Locale, type MessageKey } from '../i18n'
export type Theme = 'light' | 'dark' | 'system'
export function readPreference(key: string, allowed: string[], fallback: string): string {
  try { const value = localStorage.getItem(key); return value && allowed.includes(value) ? value : fallback } catch { return fallback }
}
export function usePreferences() {
  const locale = ref<Locale>(readPreference('output-bench-locale', ['en', 'zh'], 'en') as Locale)
  const theme = ref<Theme>(readPreference('output-bench-theme', ['light', 'dark', 'system'], 'system') as Theme)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  function apply() {
    document.documentElement.dataset.theme = theme.value === 'system' ? (media.matches ? 'dark' : 'light') : theme.value
    document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : 'en'
  }
  watch([locale, theme], () => {
    apply()
    try { localStorage.setItem('output-bench-locale', locale.value); localStorage.setItem('output-bench-theme', theme.value) } catch { /* Display settings still work without storage. */ }
  }, { immediate: true })
  onMounted(() => media.addEventListener('change', apply))
  onUnmounted(() => media.removeEventListener('change', apply))
  const t = (key: MessageKey) => messages[locale.value][key]
  return { locale, theme, t }
}
