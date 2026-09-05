# Daily Notch Tracker

An open-source notch app that turns the space around your Linux app notch into a focus + task tracker. Hover the notch to reveal your to-do list and your activity streak. Start a task to run a focus timer that lives right in the notch.

Built with React, Vite, TypeScript, Tailwind CSS, Vitest, Tauri 2 and Rust.

When creating files, always use lowercase kebab-case filenames.

If you need to create types or interfaces, create a separate file and import them into the component so they can be reused by other components.

Use Tailwind CSS for component styling instead of adding custom selectors to `src/styles/index.css`.

## Implementation workflow

When assigned an issue for implementation, strictly follow these steps:

1. **Planning:** Analyze the issue's scope and draft a detailed implementation plan before writing any code.
2. **Branch Creation:** Create a new branch specifically for the issue based on the updated main/base branch.
3. **Implementation:** Develop the necessary code, fixes, and tests according to the established plan.
4. **Validation:** Run the checks below:

```bash
npm ci
npm run build
npm test
npm run test:coverage:ci
npm run lint -- --max-warnings=0
npm run typecheck
npm run test:rust
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings
node scripts/quality-gate.js
npm run benchmark:ci
npm run benchmark:rust
node scripts/benchmark-gate.js
```

5. **Commit:** Commit the changes using atomic and well-structured commits.
6. **Open PR:** Submit a Pull Request linking the corresponding issue.

> **Important:** Strictly adhere to the guidelines, branch naming conventions, commit message standards, and PR templates defined in the skill:

> `.agents/skills/git-pr-conventions/SKILL.md`
