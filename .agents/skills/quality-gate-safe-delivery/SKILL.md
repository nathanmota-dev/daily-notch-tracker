---

name: quality-gate-safe-delivery

description: Validate TypeScript frontend and Tauri/Rust backend changes with the repository's coverage, quality-gate, and microbenchmark checks while keeping benchmark and gate rules immutable.

---

# Safe Quality Gate Delivery

Use this skill when finishing a task that changes TypeScript frontend code, Tauri/Rust backend code, tests, configuration, scripts, or CI. Its purpose is to deliver validated implementation while preserving the rules used to detect regressions.

## Invariants

- Read the root [`AGENTS.md`](http://AGENTS.md) and any area-specific `AGENTS.md` or `AGENTS.MD` that applies to `src/` or `src-tauri/` before validating. Repository instructions are the source of truth.

- Do not change benchmark or quality-gate variables, inputs, scenario sizes, thresholds, tolerances, baselines, approval criteria, commands, or logic to make the task pass.

- Do not change files outside the implementation scope. Fix a regression in the TypeScript or Rust files changed by the task and their direct implementation dependencies; do not touch an unrelated file merely because it appears in a benchmark or improves the score.

- If the actual cause is in a file outside the task scope, record the evidence and request explicit scope expansion. Do not silently include that change.

- Preserve pre-existing user changes. If they already touch a protected file, do not revert or rewrite them; report the conflict.

- Create commits, push changes, rerun workflows, or perform other external mutations only when the task authorizes them.

## Protected rule files

Treat these paths as read-only during a normal implementation fix:

- `benchmarks/**`

- `src-tauri/benches/**`

- `vitest.benchmark.config.ts`

- `scripts/baseline.json`

- `scripts/benchmark-baseline.json`

- `scripts/benchmark-gate.js`

- `scripts/benchmark-gate.test.js`

- `scripts/run-rust-benchmark.js`

- `scripts/run-rust-benchmark.test.js`

- `scripts/quality-gate.js`

- `scripts/quality-gate.test.js`

- `.github/workflows/performance.yml`

- `.github/workflows/quality-gate.yml`

- `.github/workflows/tauri.yml` (the repository's Rust quality gate)

Do not change test or benchmark scripts in `package.json`, coverage configurations, or thresholds to bypass a failure. A legitimate change to validation infrastructure requires explicit scope and authorization, followed by dedicated validation.

## Workflow

1. Establish the diff before editing: inspect `git status --short`, modified tracked files, and untracked files. Separate implementation, necessary tests, and infrastructure files. Do not use the task as an opportunity to refactor unrelated files.

2. Investigate the failure in the responsible implementation file. When a regression is reported, reproduce the scenario and compare multiple runs before assigning causality; a single run on `main` or on another runner does not by itself prove a deterministic regression.

3. Fix the implementation according to the area's architecture:

   - Tauri/Rust: keep domain logic separate from Tauri commands, application state, and integrations; extract responsibilities into modules and interfaces when needed;

   - frontend: keep React composition layers focused; extract components, hooks, helpers, types, and contracts into the directories defined by the repository instructions;

   - when coverage is missing, add focused TypeScript or Rust tests for the new or corrected behavior. Do not edit gate or benchmark tests to hide a failure;

   - creating a new implementation or test file is acceptable when it reduces responsibilities and remains directly related to the task.

4. Before finalizing any code change, run the repository's complete validation sequence; do not replace it with a partial version:

   ```sh

   npm ci

   npm audit --audit-level=critical

   npm audit --audit-level=high

   npm run build

   npm run lint -- --max-warnings=0

   npm run typecheck

   npm run test:coverage:ci

   cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check

   cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings

   cargo test --manifest-path src-tauri/Cargo.toml --locked

   node --test scripts/quality-gate.test.js

   node scripts/quality-gate.js

   npm run benchmark:ci

   npm run benchmark:rust

   node --test scripts/benchmark-gate.test.js scripts/run-rust-benchmark.test.js

   node scripts/benchmark-gate.js

   ```

5. Inspect `reports/[quality-gate.md](http://quality-gate.md)` and `reports/[performance.md](http://performance.md)`. For Tauri/Rust changes, also inspect the Rust results from `.github/workflows/tauri.yml`; this repository does not generate a separate Rust report file. Consider the task validated only when both reports and the Rust checks indicate success and every blocking command exits without errors. The high-severity audit is warning-only in CI and must be reported if it fails. If a check fails, fix the implementation or add in-scope tests, then repeat the complete sequence.

6. If the failure varies between runs, treat it as possible instability until there is sufficient evidence: rerun the authorized benchmark or CI on the same commit and record the results and runner. Do not change a baseline, threshold, or variable to accommodate an isolated result.

7. In the handoff, report the changed TypeScript/Rust implementation and test files, the commands executed, the results of both reports, the Rust quality-gate status, any CI reruns, and confirmation that protected rule files remained unchanged. If any gate is still failing or the fix requires leaving the scope, do not declare completion.
