#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const DEFAULT_BASELINE_PATH = path.join(__dirname, "baseline.json");
const REPORTS_DIRECTORY = path.join(REPOSITORY_ROOT, "reports");
const MARKDOWN_PATH = path.join(REPORTS_DIRECTORY, "quality-gate.md");
const JSON_PATH = path.join(REPORTS_DIRECTORY, "quality-gate.json");
const CANDIDATE_BASELINE_PATH = path.join(REPORTS_DIRECTORY, "candidate-baseline.json");
const COVERAGE_METRICS = ["lines", "statements", "functions", "branches"];
const DEFAULT_POLICY = Object.freeze({
    maxFileLines: 300,
    sourceRoot: "src",
    sourceExtensions: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"],
    excludeTestsFromFileSize: true,
    duplication: {
        minLines: 5,
        minTokens: 50,
        maxLines: 10_000,
        mode: "strict",
        crossFormats: "js-ts",
        ignore: [
            "**/__tests__/**",
            "**/test/**",
            "**/tests/**",
            "**/*.test.*",
            "**/*.spec.*",
            "**/*.d.ts",
            "**/*.d.mts",
            "**/*.d.cts",
            "**/node_modules/**",
            "**/coverage/**",
            "**/dist/**",
        ],
    },
});

class QualityGateInputError extends Error {
    constructor(message) {
        super(message);
        this.name = "QualityGateInputError";
    }
}

function ensureDirectory(directory) {
    fs.mkdirSync(directory, { recursive: true });
}

function readJson(filePath, label = filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        throw new QualityGateInputError(`Could not read ${label} at ${filePath}: ${error.message}`);
    }
}

function writeJson(filePath, value) {
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new QualityGateInputError(`${label} must be an object.`);
    }
}

function assertNonNegativeInteger(value, label) {
    if (!Number.isInteger(value) || value < 0) {
        throw new QualityGateInputError(`${label} must be a non-negative integer.`);
    }
}

function assertPositiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new QualityGateInputError(`${label} must be a positive integer.`);
    }
}

function assertFiniteNumber(value, label) {
    if (!Number.isFinite(value) || value < 0) {
        throw new QualityGateInputError(`${label} must be a non-negative finite number.`);
    }
}

function validateCoverageCount(value, label) {
    assertObject(value, label);
    assertNonNegativeInteger(value.covered, `${label}.covered`);
    assertNonNegativeInteger(value.total, `${label}.total`);

    if (value.covered > value.total) {
        throw new QualityGateInputError(`${label}.covered cannot exceed ${label}.total.`);
    }

    return { covered: value.covered, total: value.total };
}

function parseCoverageSummary(summary, label = "coverage summary") {
    assertObject(summary, label);
    assertObject(summary.total, `${label}.total`);

    return Object.fromEntries(COVERAGE_METRICS.map((metric) => [
        metric,
        validateCoverageCount(summary.total[metric], `${label}.total.${metric}`),
    ]));
}

function isTestFile(filePath) {
    return /(^|\/)__tests__(\/|$)/.test(filePath)
        || /(^|\/)(test|tests)(\/|$)/.test(filePath)
        || /\.(test|spec)\.[^/]+$/.test(filePath);
}

function isDeclarationFile(filePath) {
    return /\.d\.(ts|mts|cts)$/.test(filePath);
}

function parseCoverageFilePaths(summary, policy = DEFAULT_POLICY, repositoryRoot = REPOSITORY_ROOT) {
    assertObject(summary, "coverage summary");
    const sourceRoot = path.resolve(repositoryRoot, policy.sourceRoot);
    const files = [];

    for (const [reportedPath, fileMetrics] of Object.entries(summary)) {
        if (reportedPath === "total") {
            continue;
        }

        assertObject(fileMetrics, `coverage entry ${reportedPath}`);
        const portablePath = reportedPath.replace(/[\\/]+/g, path.sep);
        const sourcePrefix = `${policy.sourceRoot}${path.sep}`;
        const absolutePath = path.isAbsolute(portablePath)
            ? path.normalize(portablePath)
            : path.resolve(
                repositoryRoot,
                portablePath.startsWith(sourcePrefix)
                    ? portablePath
                    : path.join(policy.sourceRoot, portablePath),
            );
        const relativeToSource = path.relative(sourceRoot, absolutePath);

        if (!relativeToSource
            || relativeToSource === ".."
            || relativeToSource.startsWith(`..${path.sep}`)
            || path.isAbsolute(relativeToSource)) {
            throw new QualityGateInputError(
                `Coverage report contains a file outside ${policy.sourceRoot}: ${reportedPath}`,
            );
        }

        files.push(path.relative(repositoryRoot, absolutePath).split(path.sep).join("/"));
    }

    const uniqueFiles = [...new Set(files)].sort((left, right) => left.localeCompare(right));

    if (uniqueFiles.length !== files.length) {
        throw new QualityGateInputError("Coverage report contains duplicate normalized file paths.");
    }

    return uniqueFiles;
}

function validateCoverageScope(coverageFiles, fileLines, policy = DEFAULT_POLICY) {
    if (!Array.isArray(coverageFiles) || coverageFiles.some((filePath) => typeof filePath !== "string" || !filePath)) {
        throw new QualityGateInputError("Coverage file paths must be a string array.");
    }

    assertObject(fileLines, "source file lines");
    const actual = new Set(coverageFiles);

    if (actual.size !== coverageFiles.length) {
        throw new QualityGateInputError("Coverage file paths contain duplicates.");
    }

    const prefix = `${policy.sourceRoot}/`;
    const expected = Object.keys(fileLines)
        .filter((filePath) => filePath.startsWith(prefix)
            && !isTestFile(filePath)
            && !isDeclarationFile(filePath))
        .sort((left, right) => left.localeCompare(right));
    const expectedSet = new Set(expected);
    const missing = expected.filter((filePath) => !actual.has(filePath));
    const unexpected = [...actual].filter((filePath) => !expectedSet.has(filePath)).sort();

    if (missing.length > 0 || unexpected.length > 0) {
        const details = [];

        if (missing.length > 0) {
            details.push(`missing ${missing.join(", ")}`);
        }

        if (unexpected.length > 0) {
            details.push(`unexpected ${unexpected.join(", ")}`);
        }

        throw new QualityGateInputError(`Coverage scope mismatch: ${details.join("; ")}.`);
    }

    return coverageFiles.length;
}

function parseEslintReport(report) {
    if (!Array.isArray(report)) {
        throw new QualityGateInputError("ESLint report must be an array.");
    }

    return report.reduce((total, result, index) => {
        assertObject(result, `ESLint result ${index}`);
        assertNonNegativeInteger(result.errorCount, `ESLint result ${index}.errorCount`);
        assertNonNegativeInteger(result.warningCount, `ESLint result ${index}.warningCount`);
        return total + result.errorCount + result.warningCount;
    }, 0);
}

function parseJscpdReport(report) {
    assertObject(report, "JSCPD report");
    const total = report.statistics?.total ?? report.statistic?.total;
    assertObject(total, "JSCPD report total statistics");
    const fragments = total.clones ?? (Array.isArray(report.duplicates) ? report.duplicates.length : undefined);

    assertNonNegativeInteger(total.lines, "JSCPD total lines");
    assertNonNegativeInteger(total.duplicatedLines, "JSCPD duplicated lines");
    assertNonNegativeInteger(fragments, "JSCPD clone fragments");
    assertFiniteNumber(total.percentage, "JSCPD duplication percentage");

    if (total.duplicatedLines > total.lines) {
        throw new QualityGateInputError("JSCPD duplicated lines cannot exceed total lines.");
    }

    const computedPercentage = total.lines === 0 ? 0 : (total.duplicatedLines / total.lines) * 100;

    if (Math.abs(total.percentage - computedPercentage) > 0.02) {
        throw new QualityGateInputError("JSCPD duplication percentage is inconsistent with its line counts.");
    }

    return {
        duplicatedLines: total.duplicatedLines,
        totalLines: total.lines,
        fragments,
    };
}

function countPhysicalLines(contents) {
    if (contents.length === 0) {
        return 0;
    }

    const normalized = contents.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n").length;
    return normalized.endsWith("\n") ? lines - 1 : lines;
}

function collectFileSizes(policy = DEFAULT_POLICY, repositoryRoot = REPOSITORY_ROOT) {
    const extensions = new Set(policy.sourceExtensions);
    const absoluteRoot = path.resolve(repositoryRoot, policy.sourceRoot);
    const files = {};

    if (!absoluteRoot.startsWith(`${repositoryRoot}${path.sep}`)) {
        throw new QualityGateInputError(`Source root escapes the repository: ${policy.sourceRoot}`);
    }

    if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) {
        throw new QualityGateInputError(`Source root does not exist: ${policy.sourceRoot}`);
    }

    function visit(directory) {
        const entries = fs.readdirSync(directory, { withFileTypes: true })
            .sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            const absolutePath = path.join(directory, entry.name);

            if (entry.isSymbolicLink()) {
                continue;
            }

            if (entry.isDirectory()) {
                visit(absolutePath);
                continue;
            }

            if (!entry.isFile() || !extensions.has(path.extname(entry.name))) {
                continue;
            }

            const relativePath = path.relative(repositoryRoot, absolutePath).split(path.sep).join("/");

            if (policy.excludeTestsFromFileSize && isTestFile(relativePath)) {
                continue;
            }

            files[relativePath] = countPhysicalLines(fs.readFileSync(absolutePath, "utf8"));
        }
    }

    visit(absoluteRoot);
    return Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
}

function validatePolicy(policy) {
    assertObject(policy, "baseline.policy");
    assertPositiveInteger(policy.maxFileLines, "baseline.policy.maxFileLines");

    if (typeof policy.sourceRoot !== "string" || !policy.sourceRoot) {
        throw new QualityGateInputError("baseline.policy.sourceRoot must be a non-empty string.");
    }

    if (!Array.isArray(policy.sourceExtensions)
        || policy.sourceExtensions.length === 0
        || policy.sourceExtensions.some((extension) => typeof extension !== "string" || !extension)) {
        throw new QualityGateInputError("baseline.policy.sourceExtensions must be a non-empty string array.");
    }

    if (typeof policy.excludeTestsFromFileSize !== "boolean") {
        throw new QualityGateInputError("baseline.policy.excludeTestsFromFileSize must be boolean.");
    }

    assertObject(policy.duplication, "baseline.policy.duplication");
    assertPositiveInteger(policy.duplication.minLines, "baseline.policy.duplication.minLines");
    assertPositiveInteger(policy.duplication.minTokens, "baseline.policy.duplication.minTokens");
    assertPositiveInteger(policy.duplication.maxLines, "baseline.policy.duplication.maxLines");

    for (const key of ["mode", "crossFormats"]) {
        if (typeof policy.duplication[key] !== "string" || !policy.duplication[key]) {
            throw new QualityGateInputError(`baseline.policy.duplication.${key} must be a non-empty string.`);
        }
    }

    if (!Array.isArray(policy.duplication.ignore)
        || policy.duplication.ignore.some((entry) => typeof entry !== "string" || !entry)) {
        throw new QualityGateInputError("baseline.policy.duplication.ignore must be a string array.");
    }

    return policy;
}

function validateBaseline(baseline) {
    assertObject(baseline, "baseline");

    if (baseline.schemaVersion !== 1) {
        throw new QualityGateInputError(`Unsupported baseline schemaVersion: ${baseline.schemaVersion}`);
    }

    validatePolicy(baseline.policy);
    assertObject(baseline.coverage, "baseline.coverage");

    for (const metric of COVERAGE_METRICS) {
        validateCoverageCount(baseline.coverage[metric], `baseline.coverage.${metric}`);
    }

    assertObject(baseline.duplication, "baseline.duplication");
    assertNonNegativeInteger(baseline.duplication.duplicatedLines, "baseline.duplication.duplicatedLines");
    assertNonNegativeInteger(baseline.duplication.totalLines, "baseline.duplication.totalLines");
    assertNonNegativeInteger(baseline.duplication.fragments, "baseline.duplication.fragments");
    assertObject(baseline.violations, "baseline.violations");
    assertNonNegativeInteger(baseline.violations.eslint, "baseline.violations.eslint");
    assertNonNegativeInteger(baseline.violations.oversizedFiles, "baseline.violations.oversizedFiles");
    assertObject(baseline.fileLines, "baseline.fileLines");

    for (const [filePath, lines] of Object.entries(baseline.fileLines)) {
        if (!filePath || filePath.includes("\\")) {
            throw new QualityGateInputError(`Invalid baseline file path: ${filePath}`);
        }

        assertNonNegativeInteger(lines, `baseline.fileLines.${filePath}`);
    }

    const oversizedFiles = Object.values(baseline.fileLines)
        .filter((lines) => lines > baseline.policy.maxFileLines)
        .length;

    if (oversizedFiles !== baseline.violations.oversizedFiles) {
        throw new QualityGateInputError("Baseline oversized-file count does not match fileLines.");
    }

    return baseline;
}

function runCommand(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: REPOSITORY_ROOT,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(command),
        ...options,
    });

    if (result.error) {
        throw new QualityGateInputError(`Could not run ${command}: ${result.error.message}`);
    }

    return result;
}

function generateEslintReport() {
    const result = runCommand(process.platform === "win32" ? "npm.cmd" : "npm", [
        "exec",
        "--",
        "eslint",
        ".",
        "--format",
        "json",
    ]);

    if (result.status !== 0 && result.status !== 1) {
        throw new QualityGateInputError(`ESLint report generation failed with exit code ${result.status}.`);
    }

    let report;

    try {
        report = JSON.parse(result.stdout);
    } catch (error) {
        throw new QualityGateInputError(`ESLint returned invalid JSON: ${error.message}`);
    }

    writeJson(path.join(REPORTS_DIRECTORY, "eslint.json"), report);
}

function generateJscpdReport(policy) {
    const executable = process.platform === "win32" ? "jscpd.cmd" : "jscpd";
    const binaryPath = path.join(REPOSITORY_ROOT, "node_modules", ".bin", executable);

    if (!fs.existsSync(binaryPath)) {
        throw new QualityGateInputError(`JSCPD is not installed at ${binaryPath}. Run npm ci first.`);
    }

    const outputDirectory = path.join(REPORTS_DIRECTORY, "jscpd");
    ensureDirectory(outputDirectory);
    const duplication = policy.duplication;
    const result = runCommand(binaryPath, [
        policy.sourceRoot,
        "--min-lines", String(duplication.minLines),
        "--min-tokens", String(duplication.minTokens),
        "--max-lines", String(duplication.maxLines),
        "--mode", duplication.mode,
        "--cross-formats", duplication.crossFormats,
        "--ignore", duplication.ignore.join(","),
        "--reporters", "json,html",
        "--output", path.relative(REPOSITORY_ROOT, outputDirectory),
        "--threshold", "100",
        "--no-colors",
        "--no-tips",
    ]);

    fs.writeFileSync(path.join(outputDirectory, "console.txt"), `${result.stdout}${result.stderr}`, "utf8");

    if (result.status !== 0) {
        throw new QualityGateInputError(`JSCPD report generation failed with exit code ${result.status}.`);
    }
}

function collectMetrics({ policy = DEFAULT_POLICY, collectToolReports = true } = {}) {
    const validPolicy = validatePolicy(policy);

    if (collectToolReports) {
        generateEslintReport();
        generateJscpdReport(validPolicy);
    }

    const coverageSummary = readJson(path.join(REPOSITORY_ROOT, "coverage", "coverage-summary.json"), "coverage summary");
    const fileLines = collectFileSizes(validPolicy);
    const coverageFiles = parseCoverageFilePaths(coverageSummary, validPolicy);
    const coverageFileCount = validateCoverageScope(coverageFiles, fileLines, validPolicy);
    const eslint = parseEslintReport(readJson(path.join(REPORTS_DIRECTORY, "eslint.json"), "ESLint report"));
    const duplication = parseJscpdReport(
        readJson(path.join(REPORTS_DIRECTORY, "jscpd", "jscpd-report.json"), "JSCPD report"),
    );

    return {
        coverage: parseCoverageSummary(coverageSummary),
        coverageFileCount,
        duplication,
        violations: {
            eslint,
            oversizedFiles: Object.values(fileLines).filter((lines) => lines > validPolicy.maxFileLines).length,
        },
        fileLines,
    };
}

function percentage(count) {
    const valid = validateCoverageCount(count, "coverage count");
    return valid.total === 0 ? 100 : (valid.covered / valid.total) * 100;
}

function ratioIsLower(current, baseline) {
    const currentCount = validateCoverageCount(current, "current coverage");
    const baselineCount = validateCoverageCount(baseline, "baseline coverage");

    if (currentCount.total === 0) {
        return baselineCount.total > 0;
    }

    if (baselineCount.total === 0) {
        return currentCount.covered !== currentCount.total;
    }

    return currentCount.covered * baselineCount.total < baselineCount.covered * currentCount.total;
}

function duplicationPercentage(value) {
    return value.totalLines === 0 ? 0 : (value.duplicatedLines / value.totalLines) * 100;
}

function duplicationRatioIsHigher(current, baseline) {
    if (current.totalLines === 0) {
        return false;
    }

    if (baseline.totalLines === 0) {
        return current.duplicatedLines > 0;
    }

    return current.duplicatedLines * baseline.totalLines
        > baseline.duplicatedLines * current.totalLines;
}

function compareMetrics(baseline, current) {
    validateBaseline(baseline);
    assertObject(current, "current metrics");
    const failures = [];
    const regressions = [];

    for (const metric of COVERAGE_METRICS) {
        if (ratioIsLower(current.coverage[metric], baseline.coverage[metric])) {
            failures.push(
                `${metric} coverage decreased from ${formatPercentage(percentage(baseline.coverage[metric]))} to ${formatPercentage(percentage(current.coverage[metric]))}.`,
            );
        }
    }

    if (current.duplication.totalLines === 0 && baseline.duplication.totalLines > 0) {
        failures.push(`Duplication report is empty; the baseline scanned ${baseline.duplication.totalLines} lines.`);
    } else if (duplicationRatioIsHigher(current.duplication, baseline.duplication)) {
        failures.push(
            `Duplication increased from ${formatPercentage(duplicationPercentage(baseline.duplication))} to ${formatPercentage(duplicationPercentage(current.duplication))}.`,
        );
    }

    if (current.duplication.fragments > baseline.duplication.fragments) {
        failures.push(
            `Duplicate fragments increased from ${baseline.duplication.fragments} to ${current.duplication.fragments}.`,
        );
    }

    if (current.violations.eslint > baseline.violations.eslint) {
        failures.push(`ESLint violations increased from ${baseline.violations.eslint} to ${current.violations.eslint}.`);
    }

    if (current.violations.oversizedFiles > baseline.violations.oversizedFiles) {
        failures.push(
            `Oversized files increased from ${baseline.violations.oversizedFiles} to ${current.violations.oversizedFiles}.`,
        );
    }

    for (const [filePath, currentLines] of Object.entries(current.fileLines).sort()) {
        if (currentLines <= baseline.policy.maxFileLines) {
            continue;
        }

        const baselineLines = baseline.fileLines[filePath];

        if (baselineLines === undefined) {
            regressions.push(`${filePath} is a new oversized file with ${currentLines} lines.`);
        } else if (baselineLines <= baseline.policy.maxFileLines) {
            regressions.push(`${filePath} grew from ${baselineLines} to ${currentLines} lines and crossed the limit.`);
        } else if (currentLines > baselineLines) {
            regressions.push(`${filePath} grew from ${baselineLines} to ${currentLines} lines while already oversized.`);
        }
    }

    failures.push(...regressions);
    return { passed: failures.length === 0, failures, regressions };
}

function buildBaseline(metrics, policy = DEFAULT_POLICY, generatedFromCommit = "unknown") {
    return {
        schemaVersion: 1,
        generatedFromCommit,
        policy: JSON.parse(JSON.stringify(policy)),
        coverage: Object.fromEntries(COVERAGE_METRICS.map((metric) => [
            metric,
            {
                covered: metrics.coverage[metric].covered,
                total: metrics.coverage[metric].total,
            },
        ])),
        duplication: { ...metrics.duplication },
        violations: { ...metrics.violations },
        fileLines: Object.fromEntries(Object.entries(metrics.fileLines).sort()),
    };
}

function markdownEscape(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("@", "&#64;")
        .replaceAll("|", "\\|")
        .replaceAll("`", "\\`")
        .replaceAll(/\r?\n/g, " ");
}

function formatPercentage(value) {
    return `${(Math.floor((value + Number.EPSILON) * 100) / 100).toFixed(2)}%`;
}

function formatCoverage(count) {
    return count.total === 0 ? "No data" : formatPercentage(percentage(count));
}

function renderMarkdown({ baseline, metrics, comparison, baselineLabel = "scripts/baseline.json" }) {
    const lines = [
        "# Quality Gate",
        "",
        comparison.bootstrap
            ? "✅ **PASS** — Baseline captured for this quality suite. Blocking comparisons start after this reference is merged to the base branch."
            : comparison.passed
                ? "✅ **PASS** — No quality regression detected."
                : `❌ **FAIL** — ${comparison.failures.length} regression(s) detected.`,
        "",
        `Baseline: \`${markdownEscape(baselineLabel)}\` (commit \`${markdownEscape(baseline.generatedFromCommit)}\`)`,
        "",
    ];

    if (!comparison.passed) {
        lines.push("## Failures", "", ...comparison.failures.map((failure) => `- ${markdownEscape(failure)}`), "");
    }

    lines.push(
        "## Frontend coverage",
        "",
        "| Metric | Baseline | Current |",
        "|---|---:|---:|",
    );

    for (const metric of COVERAGE_METRICS) {
        lines.push(`| ${metric} | ${formatCoverage(baseline.coverage[metric])} | ${formatCoverage(metrics.coverage[metric])} |`);
    }

    lines.push(
        "",
        "## Maintainability",
        "",
        "| Metric | Baseline | Current |",
        "|---|---:|---:|",
        `| Duplication | ${formatPercentage(duplicationPercentage(baseline.duplication))} | ${formatPercentage(duplicationPercentage(metrics.duplication))} |`,
        `| Duplicate fragments | ${baseline.duplication.fragments} | ${metrics.duplication.fragments} |`,
        `| ESLint violations | ${baseline.violations.eslint} | ${metrics.violations.eslint} |`,
        `| Oversized files (> ${baseline.policy.maxFileLines} lines) | ${baseline.violations.oversizedFiles} | ${metrics.violations.oversizedFiles} |`,
        "",
        "## Diagnostics",
        "",
        `- Production source files: ${Object.keys(metrics.fileLines).length}`,
        `- Files represented in coverage: ${metrics.coverageFileCount}`,
        `- JSCPD lines: ${metrics.duplication.duplicatedLines} duplicated / ${metrics.duplication.totalLines} scanned`,
        "- Rust formatting, Clippy and tests are reported by the workflow wrapper.",
        "",
    );

    return lines.join("\n");
}

function currentCommit() {
    const result = runCommand("git", ["rev-parse", "--short=12", "HEAD"]);
    return result.status === 0 ? result.stdout.trim() : "unknown";
}

function parseArguments(args) {
    const options = {
        bootstrap: false,
        updateBaseline: false,
        collectToolReports: true,
        baselinePath: process.env.QUALITY_GATE_BASELINE_PATH || DEFAULT_BASELINE_PATH,
    };

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];

        if (argument === "--bootstrap") {
            options.bootstrap = true;
        } else if (argument === "--update-baseline") {
            options.updateBaseline = true;
        } else if (argument === "--no-collect") {
            options.collectToolReports = false;
        } else if (argument === "--baseline") {
            const value = args[++index];

            if (!value) {
                throw new QualityGateInputError("--baseline requires a path.");
            }

            options.baselinePath = path.resolve(REPOSITORY_ROOT, value);
        } else {
            throw new QualityGateInputError(`Unknown argument: ${argument}`);
        }
    }

    return options;
}

function writeFailureReport(error) {
    ensureDirectory(REPORTS_DIRECTORY);
    const markdown = [
        "# Quality Gate",
        "",
        "❌ **ERROR** — Metrics could not be collected or validated.",
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
            throw new QualityGateInputError("Baseline updates are disabled in CI.");
        }

        if (options.bootstrap && options.updateBaseline) {
            throw new QualityGateInputError("Bootstrap mode cannot be combined with --update-baseline.");
        }

        const existingBaseline = !options.bootstrap && fs.existsSync(options.baselinePath)
            ? validateBaseline(readJson(options.baselinePath, "quality baseline"))
            : null;
        const policy = existingBaseline?.policy ?? DEFAULT_POLICY;
        const metrics = collectMetrics({ policy, collectToolReports: options.collectToolReports });
        const candidate = buildBaseline(metrics, policy, currentCommit());
        writeJson(CANDIDATE_BASELINE_PATH, candidate);

        if (options.bootstrap) {
            const comparison = compareMetrics(candidate, metrics);
            comparison.bootstrap = true;
            const markdown = renderMarkdown({
                baseline: candidate,
                metrics,
                comparison,
                baselineLabel: "bootstrap",
            });
            fs.writeFileSync(MARKDOWN_PATH, markdown, "utf8");
            writeJson(JSON_PATH, {
                schemaVersion: 1,
                status: "bootstrap",
                baseline: {
                    label: "bootstrap",
                    generatedFromCommit: candidate.generatedFromCommit,
                },
                metrics,
                comparison,
            });
            process.stdout.write(markdown);
            return 0;
        }

        if (options.updateBaseline) {
            writeJson(options.baselinePath, candidate);
            const comparison = compareMetrics(candidate, metrics);
            const markdown = renderMarkdown({
                baseline: candidate,
                metrics,
                comparison,
                baselineLabel: path.relative(REPOSITORY_ROOT, options.baselinePath),
            });
            fs.writeFileSync(MARKDOWN_PATH, markdown, "utf8");
            writeJson(JSON_PATH, {
                schemaVersion: 1,
                status: "pass",
                baselineUpdated: path.relative(REPOSITORY_ROOT, options.baselinePath),
                metrics,
                comparison,
            });
            process.stdout.write(`Quality baseline updated: ${path.relative(REPOSITORY_ROOT, options.baselinePath)}\n`);
            process.stdout.write(markdown);
            return 0;
        }

        if (!existingBaseline) {
            throw new QualityGateInputError(
                `Quality baseline not found at ${options.baselinePath}. Run with --update-baseline.`,
            );
        }

        const comparison = compareMetrics(existingBaseline, metrics);
        const baselineLabel = process.env.QUALITY_GATE_BASELINE_LABEL
            || path.relative(REPOSITORY_ROOT, options.baselinePath);
        const markdown = renderMarkdown({
            baseline: existingBaseline,
            metrics,
            comparison,
            baselineLabel,
        });
        fs.writeFileSync(MARKDOWN_PATH, markdown, "utf8");
        writeJson(JSON_PATH, {
            schemaVersion: 1,
            status: comparison.passed ? "pass" : "fail",
            baseline: {
                label: baselineLabel,
                generatedFromCommit: existingBaseline.generatedFromCommit,
            },
            metrics,
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
    COVERAGE_METRICS,
    DEFAULT_POLICY,
    QualityGateInputError,
    buildBaseline,
    collectFileSizes,
    collectMetrics,
    compareMetrics,
    countPhysicalLines,
    duplicationPercentage,
    duplicationRatioIsHigher,
    markdownEscape,
    parseArguments,
    parseCoverageFilePaths,
    parseCoverageSummary,
    parseEslintReport,
    parseJscpdReport,
    renderMarkdown,
    runCli,
    validateBaseline,
    validateCoverageScope,
};

if (require.main === module) {
    process.exitCode = runCli();
}
