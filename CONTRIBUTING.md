# Contributing to AI Output Bench

Create a branch and pull request; do not push implementation changes directly to main. Run type checks, tests, coverage, the production build, and the coverage-gate regression tests before requesting review.

## Local verification

Use Node 24 and Bun 1.4.2. From the repository root:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test:coverage
bun run build
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 scripts/check_coverage.py --base origin/main --working-tree --report coverage/lcov.info . --total-min 95 --changed-min 95
```

Use `--working-tree` for local changes, including untracked source. In CI the coverage gate evaluates the tested commit against the pull-request base, merge-group base, or previous push. Initial history uses Git's empty tree as its base.

The `ci-gate` job must pass. Configure it as a required repository check when repository setup is authorized; workflow files alone do not enforce branch protection. Total and changed executable-line coverage must each be at least 95%. Every production source file needs an LCOV record, including entrypoints and adapters. Vitest also enforces 95% aggregate statements, branches, functions, and lines. Style-only changes require rendered browser validation rather than invented executable coverage. If the source layout changes, update and test the source inventory in `scripts/check_coverage.py` so no runtime files fall outside the gate.

Keep changes scoped and verify keyboard access plus responsive layouts at measured 320/390 CSS pixels and desktop. Label viewport resizing separately from device emulation or real-device testing. Cover malformed input, empty input, repeat actions, interrupted flows, and user-visible error handling. Do not weaken assertions or exclude production code to meet coverage.

Bun text-lockfile and GitHub Actions updates are proposed weekly by Dependabot. Major updates require compatibility analysis and the same pull-request gates. TypeScript 6.0.3 is intentionally pinned because vue-tsc 3.3.11 depends on `typescript/lib/tsc`, which TypeScript 7.0.2 does not export. Reevaluate that compatibility before upgrading the compiler. Dependency automation does not bypass review or repository protection.

Never commit credentials, private user inputs, browser state, deployment credentials, or temporary QA artifacts. Keep Sites identity and hosting manifests in the deployment checkout. Publish only within the user's authorization and verify the exact deployed source and visitor-visible behavior.

## License

Contributions are provided under the project's MIT license.
