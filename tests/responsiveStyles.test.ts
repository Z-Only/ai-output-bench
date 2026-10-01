import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
const stylesheet = readFileSync('src/style.css', 'utf8')

it('stacks narrow pack actions in DOM order with readable, touch-sized labels', () => {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(stylesheet)
  const narrowRules = Array.from(sheet.cssRules)
    .filter((rule): rule is CSSMediaRule => rule.type === CSSRule.MEDIA_RULE && (rule as CSSMediaRule).conditionText.replace(/\s/g, '') === '(max-width:390px)')
    .flatMap(rule => Array.from(rule.cssRules))
    .filter((rule): rule is CSSStyleRule => rule.type === CSSRule.STYLE_RULE)
  const footer = narrowRules.find(rule => rule.selectorText === '.pack-dialog .dialog-actions')!
  const button = narrowRules.find(rule => rule.selectorText === '.pack-dialog .dialog-actions .button')!
  expect(footer.style.flexDirection).toBe('column')
  expect(button.style.minHeight).toBe('44px')
  expect(button.style.width).toBe('100%')
  expect(button.style.whiteSpace).toBe('nowrap')
})

function luminance(hex: string): number {
  const clean = hex.slice(1)
  const full = clean.length === 3 ? clean.split('').map(value => value + value).join('') : clean
  const rgb = [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722
}
function contrast(foreground: string, background: string): number {
  const [low, high] = [luminance(foreground), luminance(background)].sort((a, b) => a - b)
  return (high! + 0.05) / (low! + 0.05)
}
it.each(['light', 'dark'])('%s regular text meets the 4.5:1 contrast minimum using actual CSS tokens', mode => {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(stylesheet)
  const rules = Array.from(sheet.cssRules).filter((rule): rule is CSSStyleRule => rule.type === CSSRule.STYLE_RULE)
  const root = rules.find(rule => rule.selectorText === ':root')!.style
  const dark = rules.find(rule => rule.selectorText === ':root[data-theme=dark]')!.style
  const value = (token: string) => (mode === 'dark' ? dark.getPropertyValue(token) : '') || root.getPropertyValue(token)
  const pairs = [
    ['--primary-text', '--primary-bg'], ['--primary-text', '--primary-hover'],
    ['--ink', '--bg'], ['--ink', '--surface'], ['--ink', '--chrome'], ['--ink', '--tint'],
    ['--muted', '--bg'], ['--muted', '--surface'], ['--muted', '--chrome'], ['--muted', '--tint'],
    ['--accent-text', '--tint'], ['--green', '--green-bg'], ['--green', '--surface'], ['--green', '--tint'],
    ['--danger', '--tint'], ['--danger', '--surface'], ['--surface', '--green'], ['--surface', '--danger'],
  ]
  for (const [foreground, background] of pairs) {
    expect(contrast(value(foreground!), value(background!)), `${mode}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5)
  }
  for (const background of ['--bg', '--surface', '--chrome']) {
    expect(contrast(value('--control-border'), value(background)), `${mode}: control boundary on ${background}`).toBeGreaterThanOrEqual(3)
    expect(contrast(value('--focus'), value(background)), `${mode}: focus indicator on ${background}`).toBeGreaterThanOrEqual(3)
  }
  for (const selector of ['.button', '.preferences select', '.fixture-fields input,.fixture-fields select', '.pack-text']) {
    expect(rules.find(rule => rule.selectorText === selector)!.style.borderColor).toBe('var(--control-border)')
  }
  const primary = rules.find(rule => rule.selectorText === '.button.primary')!.style
  expect(primary.color).toBe('var(--primary-text)')
  expect(primary.background).toBe('var(--primary-bg)')
  expect(rules.find(rule => rule.selectorText === '.button.primary:hover')!.style.background).toBe('var(--primary-hover)')
  expect(rules.find(rule => rule.selectorText === '.template-strip .template-active')!.style.color).toBe('var(--accent-text)')
})
