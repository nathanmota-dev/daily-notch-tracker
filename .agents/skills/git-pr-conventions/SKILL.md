---

name: git-pr-conventions

description: Apply this repository's conventions when naming branches, writing commits, and drafting pull-request titles and English descriptions.

---

# Git, Commit, and Pull Request Conventions

Use this skill when creating or reviewing a branch name, commit message, pull-request title, or pull-request description for Gestão Solo.

This skill defines naming and writing conventions. It does not by itself authorize creating commits, pushing branches, or opening pull requests. Perform those mutations only when the user explicitly asks for them.

## Repository conventions

The repository history establishes these patterns:

- Feature branches use `feat/<kebab-case-name>`; `feature/` is not the usual prefix.

- Commit subjects use Conventional Commits, mostly with lowercase types such as `feat`, `fix`, `chore`, `perf`, `docs`, `style`, `refactor`, and `revert`.

- Optional commit scopes appear in lowercase, for example `feat(calendar): ...`.

- Merged PR titles are historically mixed: some use `Feature - ...`, while others mirror a commit such as `feat: ...`. Use the normalized PR format below for new PRs.

- A `task/<kebab-case-name>` branch exists for a supporting task; use it only when the work does not have a more precise type.

## Branch names

Use this shape:

```text

&lt;type&gt;/&lt;short-kebab-case-name&gt;

```

Choose the prefix from the primary purpose of the work:

| Work | Branch prefix | Example |

| --- | --- | --- |

| New product capability | `feat/` | `feat/global-toast-service` |

| Bug correction | `fix/` | `fix/e2e-spec` |

| Maintenance, dependencies, or tooling | `chore/` | `chore/update-dependencies` |

| Internal restructuring | `refactor/` | `refactor/address-geocoding` |

| Performance improvement | `perf/` | `perf/public-workspace-layout` |

| Documentation | `docs/` | `docs/quality-gate` |

| Tests only | `test/` | `test/public-booking` |

| CI workflow changes | `ci/` | `ci/quality-gate` |

Keep the name lowercase, concise, and separated with hyphens. Describe the outcome or area, not a sentence. Use one branch for one coherent change. If the user asks to create the branch, use `git switch -c <branch-name>` after confirming the intended base; otherwise provide the proposed name without changing Git state.

## Commit messages

Use this shape:

```text

&lt;type&gt;(&lt;optional-scope&gt;): &lt;imperative subject&gt;

```

Rules:

- Use a lowercase type and subject, with no period at the end.

- Do not use uppercase words in commit messages.

- Write the subject in English and aim for five words or fewer after the colon when clarity allows.

- Start with a concrete imperative verb such as `add`, `fix`, `update`, `extract`, `optimize`, `remove`, or `restore`.

- Keep one logical change per commit. Use a scope only when it makes the affected area clearer.

- Do not use vague subjects such as `changes`, `adjustments`, or `updates` without saying what changed.

Use these types:

| Type | Use for |

| --- | --- |

| `feat` | A new user-visible capability or behavior |

| `fix` | A correction to incorrect behavior |

| `chore` | Dependencies, maintenance, generated files, or tooling |

| `refactor` | Internal restructuring without changing behavior |

| `perf` | A performance improvement |

| `docs` | Documentation-only changes |

| `style` | UI styling or formatting without behavior changes |

| `test` | Tests or test infrastructure without product changes |

| `ci` | Continuous-integration workflow changes |

| `revert` | Reverting an earlier change |

Examples aligned with this repository:

```text

feat: add global toast

fix: correct E2E spec

chore: update dependencies

refactor: extract address geocoding

perf: optimize workspace layout

docs: document quality gate

style: adjust gallery UI

feat(calendar): enhance calendar toolbar

revert: restore calendar layout

```

## Pull-request titles

Use this shape for new PRs:

```text

&lt;Kind&gt; - &lt;imperative summary&gt;

```

The kind is written in English and title-cased, while the summary uses concise sentence case. Map the branch or primary commit type as follows:

| Commit/branch type | PR kind |

| --- | --- |

| `feat` | `Feature` |

| `fix` | `Fix` |

| `chore` | `Chore` |

| `refactor` | `Refactor` |

| `perf` | `Performance` |

| `docs` | `Docs` |

| `style` | `Style` |

| `test` | `Test` |

| `ci` | `CI` |

| `revert` | `Revert` |

Keep the summary imperative, specific, and free of a trailing period. Prefer one primary outcome per PR. Examples:

```text

Feature - Add global toast

Fix - Correct E2E spec

Chore - Update dependencies

Refactor - Extract address geocoding

Performance - Optimize workspace layout

```

## Pull-request descriptions

Write the description in English. Keep the content factual and use bullets for both the change summary and validation. Start from this template:

```markdown

## What was done

- &lt;Completed change&gt;

- &lt;Completed change&gt;

## Validation

- `<command>` — &lt;passed, failed, or not run with a reason&gt;

- `<command>` — &lt;passed, failed, or not run with a reason&gt;

```

For any repository or source change, follow the root [`AGENTS.md`](http://AGENTS.md). The current repository requires this complete validation sequence; read [quality-gate-safe-delivery](../quality-gate-safe-delivery/[SKILL.md](http://SKILL.md)) before running it:

```text

npm --prefix backend run test:coverage:ci

npm --prefix frontend run test:coverage:ci

node scripts/quality-gate.js

npm --prefix backend run benchmark:ci

npm --prefix frontend run benchmark:ci

node scripts/benchmark-gate.test.js

node scripts/benchmark-gate.js

```

List each command that was actually run, include its result, and inspect `reports/[quality-gate.md](http://quality-gate.md)` and `reports/[performance.md](http://performance.md)`. Never mark a validation command as passed based only on expectation or a previous run. If a check was not run, say so explicitly instead of presenting the PR as fully validated.

## Working sequence

When preparing a change:

1. Inspect `git status --short --branch` and the diff before choosing a name or writing a summary.

2. Select the branch prefix from the primary purpose and use a concise kebab-case name.

3. Keep each commit atomic and format its subject using Conventional Commits.

4. Run the repository-required validation and record real results in the PR body.

5. Draft the PR title with the `Kind - Summary` format and the body with `What was done` and `Validation` sections.

6. Push or open the PR only when explicitly requested; do not claim that an external action happened if it was only drafted.
