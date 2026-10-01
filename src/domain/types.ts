export type Expectation = 'valid' | 'invalid'
export interface Fixture {
  id: string
  name: string
  inputText: string
  expected: Expectation
}
export interface TestPack {
  version: 1
  title: string
  dialect: '2020-12'
  schemaText: string
  fixtures: Fixture[]
}
export interface SuiteRequest {
  runId: string
  schemaText: string
  fixtures: Fixture[]
}
export interface ValidationIssue {
  instancePath: string
  schemaPath: string
  keyword: string
  message: string
}
export type SchemaStatus = 'valid' | 'invalid' | 'parse-error' | 'limit-error' | 'runtime-error' | 'timeout' | 'cancelled'
export interface FixtureResult {
  id: string
  status: 'valid' | 'invalid' | 'parse-error' | 'not-run'
  expectationMatched: boolean | null
  errors: ValidationIssue[]
}
export interface SuiteResponse {
  runId: string
  schemaStatus: SchemaStatus
  schemaErrors: ValidationIssue[]
  results: FixtureResult[]
  elapsedMs: number
}
