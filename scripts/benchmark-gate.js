#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const PROJECT_NAMES = ["tauri", "frontend"];
const DEFAULT_POLICY = Object.freeze({ maxRegressionPercent: 20 });
const DEFAULT_BASELINE_PATH = path.join(__dirname, "benchmark-baseline.json");
const CURRENT_PATH = path.join(__dirname, "benchmark-current.json");
const REPORTS_DIRECTORY = path.join(REPOSITORY_ROOT, "reports");
const RAW_REPORTS_DIRECTORY = path.join(REPORTS_DIRECTORY, "benchmarks");
const MARKDOWN_PATH = path.join(REPORTS_DIRECTORY, "performance.md");
const JSON_PATH = path.join(REPORTS_DIRECTORY, "performance.json");
const CANDIDATE_BASELINE_PATH = path.join(REPORTS_DIRECTORY, "benchmark-candidate-baseline.json");

class BenchmarkGateInputError extends Error {
    constructor(message) {
        super(message);
        this.name = "BenchmarkGateInputError";
    }
}

function ensureDirectory(directory) {
    fs.mkdirSync(directory, { recursive: true });
}

function readJson(filePath, label) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        throw new BenchmarkGateInputError(`Could not read ${label} at ${filePath}: ${error.message}`);
    }
}

function writeJson(filePath, value) {
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function currentCommit() {
    const environmentCommit = process.env.BENCHMARK_COMMIT || process.env.GITHUB_SHA;
    if (environmentCommit) {
        return environmentCommit.slice(0, 12);
    }

    try {
        return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
            cwd: REPOSITORY_ROOT,
            encoding: "utf8",
        }).trim();
    } catch {
        return "unknown";
    }
}

function assertFiniteMetric(value, label, { positive = false } = {}) {
    if (!Number.isFinite(value) || (positive && value <= 0)) {
        throw new BenchmarkGateInputError(`${label} must be a ${positive ? "positive " : ""}finite number.`);
    }

    return value;
}

function benchmarkKey(groupName, benchmarkName) {
    return `${groupName} > ${benchmarkName}`;
}

function extractProjectMetrics(project, rawReport) {
    if (!rawReport || !Array.isArray(rawReport.files)) {
        throw new BenchmarkGateInputError(`${project} benchmark report must contain a files array.`);
    }

    const benchmarks = {};

    for (const file of rawReport.files) {
        if (!Array.isArray(file.groups)) {
            throw new BenchmarkGateInputError(`${project} benchmark report contains invalid groups.`);
        }

        for (const group of file.groups) {
            if (typeof group.fullName !== "string" || !Array.isArray(group.benchmarks)) {
                throw new BenchmarkGateInputError(`${project} benchmark report contains an invalid group.`);
            }

            for (const benchmark of group.benchmarks) {
                if (typeof benchmark.name !== "string" || !benchmark.name) {
                    throw new BenchmarkGateInputError(`${project} benchmark report contains an unnamed benchmark.`);
                }

                const key = benchmarkKey(group.fullName, benchmark.name);

                if (benchmarks[key]) {
                    throw new BenchmarkGateInputError(`${project} benchmark report contains duplicate benchmark ${key}.`);
                }

                benchmarks[key] = {
                    hz: assertFiniteMetric(benchmark.hz, `${project}/${key} hz`, { positive: true }),
                    mean: assertFiniteMetric(benchmark.mean, `${project}/${key} mean`, { positive: true }),
                    median: assertFiniteMetric(benchmark.median, `${project}/${key} median`, { positive: true }),
                    rme: assertFiniteMetric(benchmark.rme, `${project}/${key} rme`),
                    sampleCount: assertFiniteMetric(
                        benchmark.sampleCount,
                        `${project}/${key} sampleCount`,
                        { positive: true },
                    ),
                };
            }
        }
    }

    if (Object.keys(benchmarks).length === 0) {
        throw new BenchmarkGateInputError(`${project} benchmark report did not contain benchmarks.`);
    }

    return {
        benchmarks: Object.fromEntries(
            Object.entries(benchmarks).sort(([left], [right]) => left.localeCompare(right)),
        ),
    };
}

function validateProjectMetrics(project, value) {
    if (!value || typeof value !== "object" || !value.benchmarks || typeof value.benchmarks !== "object") {
        throw new BenchmarkGateInputError(`${project} baseline must contain benchmarks.`);
    }

    const benchmarkEntries = Object.entries(value.benchmarks);

    if (benchmarkEntries.length === 0) {
        throw new BenchmarkGateInputError(`${project} baseline must contain at least one benchmark.`);
    }

    for (const [key, benchmark] of benchmarkEntries) {
        assertFiniteMetric(benchmark.hz, `${project}/${key} baseline hz`, { positive: true });
        assertFiniteMetric(benchmark.mean, `${project}/${key} baseline mean`, { positive: true });
        assertFiniteMetric(benchmark.median, `${project}/${key} baseline median`, { positive: true });
        assertFiniteMetric(benchmark.rme, `${project}/${key} baseline rme`);
        assertFiniteMetric(benchmark.sampleCount, `${project}/${key} baseline sampleCount`, { positive: true });
    }

    return value;
}

function validateBaseline(value) {
    if (!value || value.schemaVersion !== 1) {
        throw new BenchmarkGateInputError("Benchmark baseline must use schemaVersion 1.");
    }

    const maxRegressionPercent = value.policy?.maxRegressionPercent;
    assertFiniteMetric(maxRegressionPercent, "policy.maxRegressionPercent", { positive: true });

    if (maxRegressionPercent >= 100) {
        throw new BenchmarkGateInputError("policy.maxRegressionPercent must be lower than 100.");
    }

    if (!value.projects || typeof value.projects !== "object") {
        throw new BenchmarkGateInputError("Benchmark baseline must contain projects.");
    }

    for (const project of PROJECT_NAMES) {
        if (!value.projects[project]) {
            throw new BenchmarkGateInputError(`Benchmark baseline must contain the ${project} project.`);
        }

        validateProjectMetrics(project, value.projects[project]);
    }

    return value;
}

function buildSnapshot(projects, policy = DEFAULT_POLICY, commit = currentCommit()) {
    return {
        schemaVersion: 1,
        generatedFromCommit: commit,
        runtime: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
        },
        policy: { maxRegressionPercent: policy.maxRegressionPercent },
        projects: Object.fromEntries(
            PROJECT_NAMES
                .filter((project) => projects[project])
                .map((project) => [project, projects[project]]),
        ),
    };
}

function compareBenchmarks(baseline, current, selectedProjects) {
    const results = [];
    const failures = [];
    const warnings = [];
    const limit = baseline.policy.maxRegressionPercent;

    for (const project of selectedProjects) {
        const baselineBenchmarks = baseline.projects[project]?.benchmarks ?? {};
        const currentBenchmarks = current.projects[project]?.benchmarks ?? {};

        for (const [key, baselineMetric] of Object.entries(baselineBenchmarks)) {
            const currentMetric = currentBenchmarks[key];

            if (!currentMetric) {
                const message = `${project}/${key} is missing from the current benchmark report.`;
                failures.push(message);
                results.push({
                    project,
                    key,
                    baseline: baselineMetric,
                    current: null,
                    changePercent: null,
                    status: "missing",
                });
                continue;
            }

            const changePercent = ((currentMetric.hz - baselineMetric.hz) / baselineMetric.hz) * 100;
            const status = changePercent < -limit ? "regression" : "pass";

            if (status === "regression") {
                failures.push(`${project}/${key} regressed by ${Math.abs(changePercent).toFixed(2)}%.`);
            }

            results.push({ project, key, baseline: baselineMetric, current: currentMetric, changePercent, status });
        }

        for (const [key, currentMetric] of Object.entries(currentBenchmarks)) {
            if (baselineBenchmarks[key]) {
                continue;
            }

            warnings.push(`${project}/${key} is new and has no trusted baseline yet.`);
            results.push({
                project,
                key,
                baseline: null,
                current: currentMetric,
                changePercent: null,
                status: "new",
            });
        }
    }

    return { passed: failures.length === 0, results, failures, warnings };
}

function markdownEscape(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("|", "\\|")
        .replaceAll("`", "\\`")
        .replaceAll("@", "&#64;")
        .replaceAll(/\r?\n/g, " ");
}

function formatHz(value) {
    return value == null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function renderMarkdown({ baseline, comparison, selectedProjects, skippedProjects, baselineLabel }) {
    const lines = [
        "# Performance",
        "",
        comparison.bootstrap
            ? "✅ **PASS** — Baseline captured for this benchmark suite. Blocking comparisons start after this reference is merged to the base branch."
            : comparison.passed
                ? "✅ **PASS** — No blocking microbenchmark regressions were detected."
                : "❌ **FAIL** — One or more blocking microbenchmark regressions were detected.",
        "",
        `Baseline: \`${markdownEscape(baselineLabel)}\` · limit: \`${baseline.policy.maxRegressionPercent}%\` throughput loss.`,
        "",
        "| Project | Benchmark | Baseline ops/s | Current ops/s | Change | RME | Result |",
        "|---|---|---:|---:|---:|---:|---|",
    ];

    for (const result of comparison.results) {
        const change = result.changePercent == null
            ? "—"
            : `${result.changePercent >= 0 ? "+" : ""}${result.changePercent.toFixed(2)}%`;
        const rme = result.current ? `${result.current.rme.toFixed(2)}%` : "—";
        const status = {
            pass: "✅ Pass",
            regression: "❌ Regression",
            missing: "❌ Missing",
            new: "🆕 New",
        }[result.status];
        lines.push(
            `| ${markdownEscape(result.project)} | ${markdownEscape(result.key)} | ${formatHz(result.baseline?.hz)} | ${formatHz(result.current?.hz)} | ${change} | ${rme} | ${status} |`,
        );
    }

    if (comparison.results.length === 0) {
        lines.push("| — | No benchmark-relevant project changed | — | — | — | — | ⏭️ Skipped |");
    }

    if (comparison.failures.length > 0) {
        lines.push("", "## Failures", "", ...comparison.failures.map((failure) => `- ${markdownEscape(failure)}`));
    }

    if (comparison.warnings.length > 0) {
        lines.push("", "## Warnings", "", ...comparison.warnings.map((warning) => `- ${markdownEscape(warning)}`));
    }

    lines.push(
        "",
        `Selected projects: ${selectedProjects.length ? selectedProjects.map((project) => `\`${project}\``).join(", ") : "none"}.`,
        `Skipped projects: ${skippedProjects.length ? skippedProjects.map((project) => `\`${project}\``).join(", ") : "none"}.`,
        "",
    );

    return lines.join("\n");
}

function parseArguments(args) {
    const options = {
        bootstrap: false,
        updateBaseline: false,
        projects: [...PROJECT_NAMES],
        baselinePath: process.env.BENCHMARK_BASELINE_PATH || DEFAULT_BASELINE_PATH,
    };

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];

        if (argument === "--bootstrap") {
            options.bootstrap = true;
        } else if (argument === "--update-baseline") {
            options.updateBaseline = true;
        } else if (argument === "--projects") {
            const value = args[++index];

            if (value === undefined) {
                throw new BenchmarkGateInputError("--projects requires a comma-separated value.");
            }

            options.projects = value ? [...new Set(value.split(",").filter(Boolean))] : [];
        } else if (argument === "--baseline") {
            const value = args[++index];

            if (!value) {
                throw new BenchmarkGateInputError("--baseline requires a path.");
            }

            options.baselinePath = path.resolve(REPOSITORY_ROOT, value);
        } else {
            throw new BenchmarkGateInputError(`Unknown argument: ${argument}`);
        }
    }

    const invalidProject = options.projects.find((project) => !PROJECT_NAMES.includes(project));

    if (invalidProject) {
        throw new BenchmarkGateInputError(`Unknown benchmark project: ${invalidProject}.`);
    }

    return options;
}

function collectCurrentProjects(selectedProjects) {
    return Object.fromEntries(selectedProjects.map((project) => {
        const reportPath = path.join(RAW_REPORTS_DIRECTORY, `${project}.json`);
        return [project, extractProjectMetrics(project, readJson(reportPath, `${project} benchmark report`))];
    }));
}

function mergeCandidateBaseline(baseline, current, selectedProjects) {
    const projects = { ...baseline.projects };

    for (const project of selectedProjects) {
        projects[project] = current.projects[project];
    }

    return buildSnapshot(projects, baseline.policy);
}

function writeFailureReport(error) {
    ensureDirectory(REPORTS_DIRECTORY);
    const markdown = [
        "# Performance",
        "",
        "❌ **ERROR** — Microbenchmark results could not be collected or validated.",
        "",
        "## Failure",
        "",
        `- ${markdownEscape(error.message)}`,
        "",
    ].join("\n");
    fs.writeFileSync(MARKDOWN_PATH, markdown, "utf8");
    writeJson(JSON_PATH, { schemaVersion: 1, status: "error", error: error.message });
}

function runCli(args = process.argv.slice(2)) {
    try {
        const options = parseArguments(args);

        if (options.updateBaseline && process.env.CI === "true") {
            throw new BenchmarkGateInputError("Benchmark baseline updates are disabled in CI.");
        }

        if (options.updateBaseline && options.projects.length !== PROJECT_NAMES.length) {
            throw new BenchmarkGateInputError("Updating the benchmark baseline requires both tauri and frontend.");
        }

        const collectedProjects = collectCurrentProjects(options.projects);
        const existingBaseline = fs.existsSync(options.baselinePath)
            ? validateBaseline(readJson(options.baselinePath, "benchmark baseline"))
            : null;
        const policy = existingBaseline?.policy ?? DEFAULT_POLICY;
        const current = buildSnapshot(collectedProjects, policy);
        writeJson(CURRENT_PATH, current);

        if (options.bootstrap) {
            const comparison = compareBenchmarks(current, current, options.projects);
            comparison.bootstrap = true;
            const baselineLabel = process.env.BENCHMARK_BASELINE_LABEL
                || path.relative(REPOSITORY_ROOT, options.baselinePath);
            const markdown = renderMarkdown({
                baseline: current,
                comparison,
                selectedProjects: options.projects,
                skippedProjects: PROJECT_NAMES.filter((project) => !options.projects.includes(project)),
                baselineLabel,
            });
            writeJson(CANDIDATE_BASELINE_PATH, current);
            fs.writeFileSync(MARKDOWN_PATH, markdown, "utf8");
            writeJson(JSON_PATH, {
                schemaVersion: 1,
                status: "bootstrap",
                baseline: { label: "bootstrap", generatedFromCommit: current.generatedFromCommit },
                current,
                comparison,
            });
            process.stdout.write(markdown);
            return 0;
        }

        if (options.updateBaseline) {
            writeJson(options.baselinePath, current);
            const comparison = compareBenchmarks(current, current, options.projects);
            const markdown = renderMarkdown({
                baseline: current,
                comparison,
                selectedProjects: options.projects,
                skippedProjects: [],
                baselineLabel: path.relative(REPOSITORY_ROOT, options.baselinePath),
            });
            fs.writeFileSync(MARKDOWN_PATH, markdown, "utf8");
            writeJson(JSON_PATH, {
                schemaVersion: 1,
                status: "pass",
                baselineUpdated: path.relative(REPOSITORY_ROOT, options.baselinePath),
                current,
                comparison,
            });
            process.stdout.write(`Benchmark baseline updated: ${path.relative(REPOSITORY_ROOT, options.baselinePath)}\n`);
            process.stdout.write(markdown);
            return 0;
        }

        if (!existingBaseline) {
            throw new BenchmarkGateInputError(
                "Benchmark baseline not found. Run both benchmark suites and use --update-baseline.",
            );
        }

        const comparison = compareBenchmarks(existingBaseline, current, options.projects);
        const skippedProjects = PROJECT_NAMES.filter((project) => !options.projects.includes(project));
        const candidate = mergeCandidateBaseline(existingBaseline, current, options.projects);
        const baselineLabel = process.env.BENCHMARK_BASELINE_LABEL
            || path.relative(REPOSITORY_ROOT, options.baselinePath);
        const markdown = renderMarkdown({
            baseline: existingBaseline,
            comparison,
            selectedProjects: options.projects,
            skippedProjects,
            baselineLabel,
        });
        writeJson(CANDIDATE_BASELINE_PATH, candidate);
        fs.writeFileSync(MARKDOWN_PATH, markdown, "utf8");
        writeJson(JSON_PATH, {
            schemaVersion: 1,
            status: comparison.passed ? "pass" : "fail",
            baseline: {
                label: baselineLabel,
                generatedFromCommit: existingBaseline.generatedFromCommit,
            },
            current,
            comparison,
        });
        process.stdout.write(markdown);
        return comparison.passed ? 0 : 1;
    } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        writeFailureReport(normalized);
        process.stderr.write(`${normalized.name}: ${normalized.message}\n`);
        return 2;
    }
}

module.exports = {
    BenchmarkGateInputError,
    DEFAULT_POLICY,
    PROJECT_NAMES,
    benchmarkKey,
    buildSnapshot,
    compareBenchmarks,
    extractProjectMetrics,
    markdownEscape,
    parseArguments,
    renderMarkdown,
    runCli,
    validateBaseline,
};

if (require.main === module) {
    process.exitCode = runCli();
}
