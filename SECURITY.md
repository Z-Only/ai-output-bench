# Security

## Boundaries

This app treats schemas, fixtures, and imported test packs as untrusted data. It does not execute user JavaScript, make model requests, resolve remote references, or upload pasted content. JSON Schema is not a way to assess whether model output is truthful or safe to act on.

Validation executes in a disposable browser Worker. The main thread applies input limits and terminates overdue or cancelled work. Schema compilation and regular expressions can consume resources; a timeout is indeterminate, never proof that the data is invalid. Browser resource isolation and scheduling are not absolute memory or time guarantees.

Ajv compiles schemas into validation code in the Worker. Environments that disallow this through Content Security Policy may prevent validation. Do not relax unrelated security controls to bypass that restriction; surface an execution error instead.

The app must not coerce inputs, apply defaults, strip properties, or silently repair JSON. Non-finite numbers and unsafe integer values must be rejected explicitly rather than presented as exact numeric validation. Ordinary JavaScript floating-point arithmetic still applies.

Only fragment-local references are allowed. Validation does not fetch referenced schemas. Treat `$ref`-looking keys in literal enum/const data as data, not executable schema.

## Privacy

Do not put credentials, personal records, or proprietary prompts into public issues, screenshots, demo fixtures, or commits. Exported packs contain the full raw inputs. Sharing an export is the user's explicit action. Application logs must never contain fixture or schema text.

## Reporting

For a suspected vulnerability, use GitHub's private vulnerability reporting if available. Otherwise contact the repository owner without posting exploit payloads or sensitive input publicly. Report affected commit/version, a minimal non-sensitive reproducer, expected/actual behavior, and browser details.

## Review scope

Review resource limits, Worker lifecycle/races, import validation, reference traversal, prototype-sensitive keys, rendering safety, export correctness, and CI/branch protection. Never weaken the coverage gate, remove production files from instrumentation, expose credentials, or bypass required checks to complete a change.
