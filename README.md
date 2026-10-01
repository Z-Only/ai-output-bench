# AI Output Bench

[Open the public workbench](https://ai-output-bench.m2-zhao.chatgpt.site)

A local-first contract test bench for JSON produced by AI systems. Edit a JSON Schema, run named valid/invalid fixtures, inspect exact failure paths, and export a reusable test pack. It runs real validation in your browser; it does not call an AI model or judge factual accuracy.

## Quick start

1. Run the Product extraction or Support triage example
2. Select a fixture and inspect its output, expectation, and diagnostic JSON Pointers
3. Edit the schema or output, then run all tests (Ctrl/⌘ + Enter)
4. Add positive and negative examples before changing a contract
5. Export the pack and save its full JSON; paste it into Import pack to resume later

Changes stay in memory. Export before closing or reloading the page. Importing a valid pack replaces the current workspace. Loading a template or removing a fixture asks for confirmation.

## Development

Requirements: Node.js 24 and Bun 1.4.2.

```sh
bun install --frozen-lockfile
bun run dev
bun run typecheck
bun run test:coverage
bun run build
python3 -m unittest discover -s scripts -p 'test_*.py'
```

Vue 3 + TypeScript + Vite, Ajv 2020 validation, Vitest, and Vue Test Utils. Dependencies are pinned in `package.json` and `bun.lock`. TypeScript 6 is retained for current vue-tsc compatibility; a newer major is not automatically a compatible upgrade.

## What a passing test means

Data validity and test expectations are different. A fixture expected to be invalid passes its regression test when the output is invalid. Malformed JSON is reported separately from a schema mismatch. Schema compilation failures, cancellation, timeouts, and internal errors cannot satisfy an invalid expectation.

Only JSON Schema draft 2020-12 is supported. With no `$schema`, this dialect is assumed. String `format` keywords are annotations: email/date/URI formats are not checked. Inputs are not repaired, coerced, defaulted, stripped, or extracted from Markdown. Local references are supported; external reference retrieval is disabled.

This is a developer diagnostic, not a production security boundary or a guarantee of compatibility with a model provider's API. JSON Schema validates structure, not truth, safety, or semantic correctness. Provider-specific structured-output subsets may differ.

## Privacy and portability

Schemas and fixture text are processed locally and are not saved automatically. Only interface preferences may be stored locally. Explicit test-pack export/import lets you keep work. Exported packs include your schema and all fixture contents: review them before sharing or committing. No model key, analytics, remote font, or account is needed to use the tool. The hosting provider still handles ordinary requests needed to load the website.

A selectable export preview is available even when the browser does not complete a file download. Imported packs must validate in full before replacing current work.

## Validation limits

- Schema: 128 KiB UTF-8
- Each fixture: 256 KiB UTF-8; at most 50 fixtures
- Schema plus fixture text: 2 MiB
- Nesting: 64 levels; 10,000 schema values and 100,000 values per fixture
- Worker deadline: 2 seconds, followed by termination

Limits describe this workbench, not a model provider. JSON syntax errors can meet an Invalid expectation; resource-limit failures cannot. Number checks reject non-finite values and unsafe integers; other decimal values follow JavaScript floating-point semantics.

## Contribution workflow

All implementation changes go through pull requests. Required CI builds, type-checks, runs tests, and enforces at least 95% total and changed executable-line coverage. The coverage gate fails on absent production-file records rather than silently excluding them. Worker and runtime adapter source is included.

Dependency upgrades are proposed through weekly Dependabot PRs. Review automation is advisory; actionable findings are investigated and addressed. Never merge by bypassing a failing required check. Deploy only the merged and verified source revision.

## Sources and boundaries

- [JSON Schema draft 2020-12](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [Ajv security guidance](https://ajv.js.org/security.html)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

The product uses a disposable Worker and bounded inputs to contain expensive validation. See [SECURITY.md](SECURITY.md). See [CONTRIBUTING.md](CONTRIBUTING.md) for checks and development policy.

## License

MIT
