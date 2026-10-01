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
