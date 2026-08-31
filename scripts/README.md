# Quality and performance gates

The PR quality gate and microbenchmark workflow are additive to the existing frontend, Tauri, and end-to-end workflows. Both run for pull requests targeting `main`, publish a job summary, upload diagnostic artifacts, and finish with an explicit blocking step.

## Quality gate

Install dependencies and generate fresh coverage before running the metric comparison:

```sh
npm ci
npm run test:coverage:ci
node --test scripts/quality-gate.test.js
node scripts/quality-gate.js
```

The workflow also blocks on:

```sh
npm audit --audit-level=critical
npm run build
npm run lint -- --max-warnings=0
npm run typecheck
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

`quality-gate.js` generates ESLint and JSCPD reports, validates that coverage contains every production TypeScript file, compares the result with `scripts/baseline.json`, and writes:

- `reports/quality-gate.md` and `reports/quality-gate.json`;
- `reports/candidate-baseline.json`;
- raw ESLint, JSCPD, coverage, and audit reports.

Coverage percentages cannot decrease. Duplication percentage, duplicate fragments, ESLint violations, and oversized-file debt cannot increase. Files over 300 physical lines are grandfathered only at their recorded size; new oversized files, files crossing the limit, and growth in an existing oversized file are blocking.

The workflow reads the baseline from the pull request's base SHA. A branch therefore cannot weaken its own comparison. When `main` does not contain a baseline yet, the first pull request runs in bootstrap mode: it validates and records the current metrics without comparing them with an older branch snapshot. Later pull requests use the baseline stored in their base SHA.

## Microbenchmarks

Run the frontend and Tauri benchmarks sequentially so they do not compete for CPU:

```sh
npm run benchmark:ci
npm run benchmark:rust
node --test scripts/benchmark-gate.test.js scripts/run-rust-benchmark.test.js
node scripts/benchmark-gate.js
```

The frontend suite uses Vitest/Tinybench to measure static React rendering. The Tauri suite uses Criterion's optimized bench profile and `run-rust-benchmark.js` converts Criterion estimates into the shared report schema. Raw results are written to `reports/benchmarks/`.

`benchmark-gate.js` writes:

- `reports/performance.md` and `reports/performance.json`;
- `reports/benchmark-candidate-baseline.json`;
- `scripts/benchmark-current.json` (generated and ignored by Git).

`scripts/benchmark-baseline.json` is the reviewed reference. Throughput loss greater than 20%, malformed results, or removal of a tracked benchmark is blocking. A new benchmark is reported as a warning until its candidate baseline is reviewed. The workflow selects only affected areas, while changes to benchmark infrastructure run both suites.

When the base branch has no benchmark baseline, CI uses bootstrap mode: it records current runner values without comparing machine speeds. Later pull requests use the baseline stored in their base SHA.

## Refreshing a baseline

Baseline changes require explicit review. They are disabled when `CI=true` and must never be used to hide a regression. After generating all required inputs, run:

```sh
node scripts/quality-gate.js --update-baseline
npm run benchmark:ci
npm run benchmark:rust
node scripts/benchmark-gate.js --update-baseline
```
