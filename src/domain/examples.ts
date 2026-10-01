import type { TestPack } from './types'

export const EXAMPLE_PACKS: { id: string; label: { en: string; zh: string }; pack: TestPack }[] = [
  {
    id: 'product', label: { en: 'Product extraction', zh: '商品信息提取' },
    pack: {
      version: 1, title: 'Product extraction', dialect: '2020-12',
      schemaText: JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object', required: ['name', 'price', 'currency'], additionalProperties: false,
        properties: { name: { type: 'string', minLength: 1 }, price: { type: 'number', minimum: 0 }, currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] } },
      }, null, 2),
      fixtures: [
        { id: 'product-complete', name: 'Complete product', inputText: '{\n  "name": "Orbit notebook",\n  "price": 24.5,\n  "currency": "USD"\n}', expected: 'valid' },
        { id: 'product-missing', name: 'Missing price', inputText: '{\n  "name": "Orbit notebook",\n  "currency": "USD"\n}', expected: 'invalid' },
        { id: 'product-string', name: 'Price as text', inputText: '{"name":"Orbit notebook","price":"24.50","currency":"USD"}', expected: 'invalid' },
        { id: 'product-negative', name: 'Negative price', inputText: '{"name":"Orbit notebook","price":-1,"currency":"USD"}', expected: 'invalid' },
      ],
    },
  },
  {
    id: 'support', label: { en: 'Support triage', zh: '客服工单分类' },
    pack: {
      version: 1, title: 'Support triage', dialect: '2020-12',
      schemaText: JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object', required: ['category', 'priority', 'summary'], additionalProperties: false,
        properties: { category: { enum: ['billing', 'technical', 'account'] }, priority: { type: 'integer', minimum: 1, maximum: 3 }, summary: { type: 'string', minLength: 1, maxLength: 160 } },
      }, null, 2),
      fixtures: [
        { id: 'support-valid', name: 'Billing question', inputText: '{"category":"billing","priority":2,"summary":"Explain the latest invoice."}', expected: 'valid' },
        { id: 'support-enum', name: 'Unknown category', inputText: '{"category":"other","priority":2,"summary":"Need help."}', expected: 'invalid' },
        { id: 'support-json', name: 'Markdown-wrapped JSON', inputText: '```json\n{"category":"account","priority":1,"summary":"Cannot sign in."}\n```', expected: 'invalid' },
      ],
    },
  },
]
