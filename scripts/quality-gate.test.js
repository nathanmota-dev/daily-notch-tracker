"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
    COVERAGE_METRICS,
    DEFAULT_FRONTEND_POLICY,
    DEFAULT_POLICIES,
    DEFAULT_TAURI_POLICY,
    QualityGateInputError,
    buildBaseline,
    collectFileSizes,
    collectFunctionSizes,
    compareMetrics,
    countPhysicalLines,
    markdownEscape,
    parseClippyReport,
    parseCoverageFilePaths,
    parseCoverageSummary,
    parseEslintReport,
    parseJscpdReport,
    parseRustCoverageReport,
    renderMarkdown,
    validateBaseline,
    validateCoverageScope,
} = require("./quality-gate.js");

function coverage(covered = 8, total = 10) {
    return Object.fromEntries(COVERAGE_METRICS.map((metric) => [metric, { covered, total }]));
}

function projectMetrics(projectName, overrides = {}) {
    const policy = projectName === "frontend" ? DEFAULT_FRONTEND_POLICY : DEFAULT_TAURI_POLICY;
    const sourceFile = projectName === "frontend" ? "src/main.ts" : "src-tauri/src/main.rs";
    const functionName = projectName === "frontend" ? "main" : "main";
    const defaults = {
        policy,
        coverage: coverage(),
        coverageFileCount: 1,
        duplication: { duplicatedLines: 10, totalLines: 100, fragments: 2 },
        violations: projectName === "frontend"
            ? { eslint: 0, largeFunctions: 0, oversizedFiles: 0 }
            : { clippy: 0, largeFunctions: 0, oversizedFiles: 0 },
        fileLines: { [sourceFile]: 20 },
        functionLines: { [`${sourceFile}::${functionName}`]: 20 },
    };

    return {
        ...defaults,
        ...overrides,
        policy: { ...policy, ...(overrides.policy || {}) },
        coverage: { ...defaults.coverage, ...(overrides.coverage || {}) },
        duplication: { ...defaults.duplication, ...(overrides.duplication || {}) },
        violations: { ...defaults.violations, ...(overrides.violations || {}) },
        fileLines: { ...defaults.fileLines, ...(overrides.fileLines || {}) },
        functionLines: { ...defaults.functionLines, ...(overrides.functionLines || {}) },
    };
}

function metrics(overrides = {}) {
    return {
        schemaVersion: 2,
        projects: {
            frontend: projectMetrics("frontend", overrides.frontend),
            tauri: projectMetrics("tauri", overrides.tauri),
        },
    };
}

function baseline(overrides = {}) {
    return buildBaseline(metrics(overrides), DEFAULT_POLICIES, "abc123");
}

function makeTempDirectory(context, prefix) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

test("parseCoverageSummary validates every required frontend total", () => {
    assert.deepEqual(parseCoverageSummary({ total: coverage(7, 9) }, "fixture"), coverage(7, 9));
    assert.throws(
        () => parseCoverageSummary({ total: { ...coverage(), branches: undefined } }),
        QualityGateInputError,
    );
    assert.throws(() => parseCoverageSummary({}), /coverage summary.total must be an object/);
});

test("schema v2 validates independent frontend and Tauri projects", () => {
    const trusted = baseline();
    const validated = validateBaseline(trusted);

    assert.equal(validated.schemaVersion, 2);
    assert.deepEqual(Object.keys(validated.projects), ["frontend", "tauri"]);
    assert.equal(validated.projects.frontend.policy.maxFileLines, 350);
    assert.equal(validated.projects.tauri.policy.maxFunctionLines, 100);
    assert.throws(
        () => validateBaseline({ ...trusted, projects: { frontend: trusted.projects.frontend } }),
        /tauri is required/,
    );
    assert.throws(
        () => validateBaseline({ ...trusted, projects: undefined }),
        /baseline.projects must be an object/,
    );
});

test("schema v1 remains readable only through the migration normalizer", () => {
    const legacy = {
        schemaVersion: 1,
        generatedFromCommit: "legacy",
        policy: {
            maxFileLines: 300,
            sourceRoot: "src",
            sourceExtensions: [".ts"],
            excludeTestsFromFileSize: true,
            duplication: {
                minLines: 5,
                minTokens: 50,
                maxLines: 10_000,
                mode: "strict",
                crossFormats: "js-ts",
                ignore: [],
            },
        },
        coverage: coverage(),
        duplication: { duplicatedLines: 0, totalLines: 100, fragments: 0 },
        violations: { eslint: 0, oversizedFiles: 0 },
        fileLines: { "src/main.ts": 20 },
    };

    const migrated = validateBaseline(legacy);
    assert.equal(migrated.migratedFromSchemaVersion, 1);
    assert.equal(migrated.projects.tauri, null);
    assert.equal(migrated.projects.frontend.policy.maxFileLines, 300);
    assert.equal(buildBaseline(metrics()).schemaVersion, 2);
});

test("coverage scope includes every production file and excludes test files", (context) => {
    const directory = makeTempDirectory(context, "quality-coverage-");
    const main = path.join(directory, "src", "main.ts");
    const summary = {
        total: coverage(),
        [main]: coverage(),
        "src/unimported.ts": coverage(0, 5),
        "src/main.test.ts": coverage(),
    };
    const files = parseCoverageFilePaths(summary, DEFAULT_FRONTEND_POLICY, directory);
    const fileLines = {
        "src/main.ts": 10,
        "src/unimported.ts": 4,
        "src/main.test.ts": 50,
        "src/types.d.ts": 400,
    };

    assert.deepEqual(files, ["src/main.ts", "src/unimported.ts"]);
    assert.equal(validateCoverageScope(files, fileLines), 2);
    assert.throws(() => validateCoverageScope(["src/main.ts"], fileLines), /missing src\/unimported.ts/);
    assert.throws(
        () => validateCoverageScope([...files, "src/ghost.ts"], fileLines),
        /unexpected src\/ghost.ts/,
    );
});

test("Tauri coverage can omit Rust modules without executable functions", () => {
    const sourceFiles = {
        "src-tauri/src/main.rs": 20,
        "src-tauri/src/module.rs": 8,
    };
    const coveredFiles = ["src-tauri/src/main.rs"];

    assert.equal(
        validateCoverageScope(
            coveredFiles,
            sourceFiles,
            DEFAULT_TAURI_POLICY,
            {},
        ),
        1,
    );
    assert.throws(
        () => validateCoverageScope(
            coveredFiles,
            sourceFiles,
            DEFAULT_TAURI_POLICY,
            { "src-tauri/src/module.rs::run": 2 },
        ),
        /missing src-tauri\/src\/module.rs/,
    );
});

test("parseRustCoverageReport maps LLVM regions to statements and requires branches", (context) => {
    const directory = makeTempDirectory(context, "quality-rust-coverage-");
    const filename = path.join(directory, "src-tauri", "src", "main.rs");
    const report = {
        data: [{
            files: [{ filename }],
            totals: {
                lines: { count: 100, covered: 90 },
                regions: { count: 120, covered: 100 },
                functions: { count: 20, covered: 18 },
                branches: { count: 30, covered: 24 },
            },
        }],
    };
    const parsed = parseRustCoverageReport(report, "fixture", directory, DEFAULT_TAURI_POLICY);

    assert.deepEqual(parsed.coverage.statements, { covered: 100, total: 120 });
    assert.deepEqual(parsed.coverage.branches, { covered: 24, total: 30 });
    assert.deepEqual(parsed.filePaths, ["src-tauri/src/main.rs"]);
    assert.equal(parsed.regionMetric, "regions");
    assert.throws(
        () => parseRustCoverageReport({ data: [{ totals: { ...report.data[0].totals, branches: undefined } }] }, "fixture", directory),
        /missing branch coverage/,
    );
});

test("parseClippyReport counts JSON diagnostics without counting compiler artifacts", () => {
    const report = [
        { reason: "compiler-artifact", package_id: "dailynotch" },
        {
            reason: "compiler-message",
            message: { level: "warning", code: { code: "clippy::needless_borrow" } },
        },
        {
            reason: "compiler-message",
            message: { level: "error", code: { code: "clippy::too_many_lines" } },
        },
    ];

    assert.equal(parseClippyReport(report), 2);
    assert.equal(parseClippyReport(`${JSON.stringify(report[1])}\n${JSON.stringify(report[2])}\n`), 2);
    assert.equal(parseClippyReport({ violations: 3 }), 3);
});

test("parseEslintReport counts errors and warnings", () => {
    assert.equal(parseEslintReport([
        { errorCount: 2, warningCount: 1, messages: [] },
        { errorCount: 0, warningCount: 3, messages: [] },
    ]), 6);
    assert.throws(() => parseEslintReport([{ errorCount: -1, warningCount: 0 }]), /non-negative integer/);
});

test("parseJscpdReport captures Rust duplication metrics", () => {
    assert.deepEqual(parseJscpdReport({
        statistics: { total: { lines: 2_830, duplicatedLines: 71, clones: 9, percentage: 2.50883392 } },
    }), { totalLines: 2_830, duplicatedLines: 71, fragments: 9 });
    assert.throws(() => parseJscpdReport({
        statistics: { total: { lines: 100, duplicatedLines: 10, clones: 1, percentage: 50 } },
    }), /inconsistent/);
});

test("collectFileSizes and collectFunctionSizes exclude only test files", (context) => {
    const directory = makeTempDirectory(context, "quality-files-");
    fs.mkdirSync(path.join(directory, "src", "nested"), { recursive: true });
    fs.writeFileSync(path.join(directory, "src", "main.ts"), "one\ntwo\n", "utf8");
    fs.writeFileSync(path.join(directory, "src", "main.test.ts"), "ignored\n", "utf8");
    fs.writeFileSync(path.join(directory, "src", "nested", "view.tsx"), "one\r\ntwo", "utf8");
    fs.symlinkSync(path.join(directory, "src", "nested"), path.join(directory, "src", "linked"));

    assert.deepEqual(collectFileSizes(DEFAULT_FRONTEND_POLICY, directory), {
        "src/main.ts": 2,
        "src/nested/view.tsx": 2,
    });
    assert.deepEqual(Object.keys(collectFunctionSizes(DEFAULT_FRONTEND_POLICY, directory)), []);
});

test("function size collection detects a 101-line production function", (context) => {
    const directory = makeTempDirectory(context, "quality-function-");
    fs.mkdirSync(path.join(directory, "src"), { recursive: true });
    const contents = [
        "export function longFunction() {",
        ...Array.from({ length: 99 }, () => "  return 1;"),
        "}",
    ].join("\n");
    fs.writeFileSync(path.join(directory, "src", "long.ts"), contents, "utf8");

    const functions = collectFunctionSizes(DEFAULT_FRONTEND_POLICY, directory);
    assert.equal(functions["src/long.ts::longFunction"], 101);
});

test("absolute file limits reject a collected 351-line production file", (context) => {
    const directory = makeTempDirectory(context, "quality-file-limit-");
    fs.mkdirSync(path.join(directory, "src"), { recursive: true });
    fs.writeFileSync(
        path.join(directory, "src", "long.ts"),
        Array.from({ length: 351 }, (_, index) => `const line${index} = ${index};`).join("\n"),
        "utf8",
    );

    const fileLines = collectFileSizes(DEFAULT_FRONTEND_POLICY, directory);
    assert.equal(fileLines["src/long.ts"], 351);
    assert.equal(
        compareMetrics(
            baseline(),
            metrics({
                frontend: {
                    fileLines: { "src/long.ts": 351 },
                    violations: { oversizedFiles: 1 },
                },
            }),
        ).passed,
        false,
    );
});

test("frontend coverage floor fails below 80 and passes at or above 80", () => {
    const trusted = baseline();
    const below = metrics({ frontend: { coverage: coverage(7, 10) } });
    const exact = metrics({ frontend: { coverage: coverage(8, 10) } });
    const above = metrics({ frontend: { coverage: coverage(9, 10) } });

    assert.equal(compareMetrics(trusted, below).passed, false);
    assert.ok(compareMetrics(trusted, below).failures.some((failure) => /below the required 80/.test(failure)));
    assert.equal(compareMetrics(trusted, exact).passed, true);
    assert.equal(compareMetrics(trusted, above).passed, true);
});

test("file and function limits are absolute and do not grandfather baseline violations", () => {
    const trusted = baseline();
    const oversized = metrics({
        frontend: {
            fileLines: { "src/main.ts": 351 },
            violations: { oversizedFiles: 1 },
        },
    });
    const largeFunction = metrics({
        frontend: {
            functionLines: { "src/main.ts::main": 101 },
            violations: { largeFunctions: 1 },
        },
    });

    assert.equal(compareMetrics(trusted, oversized).passed, false);
    assert.ok(compareMetrics(trusted, oversized).failures.some((failure) => /351 lines/.test(failure)));
    assert.equal(compareMetrics(trusted, largeFunction).passed, false);
    assert.ok(compareMetrics(trusted, largeFunction).failures.some((failure) => /101 lines/.test(failure)));
});

test("frontend and Tauri comparisons remain independent", () => {
    const trusted = baseline();
    const current = metrics({ frontend: { duplication: { duplicatedLines: 30 } } });
    const comparison = compareMetrics(trusted, current);

    assert.equal(comparison.passed, false);
    assert.equal(comparison.projects.frontend.passed, false);
    assert.equal(comparison.projects.tauri.passed, true);
    assert.ok(comparison.failures.every((failure) => !failure.startsWith("Tauri")));
});

test("countPhysicalLines handles line endings and final newlines", () => {
    assert.equal(countPhysicalLines(""), 0);
    assert.equal(countPhysicalLines("one"), 1);
    assert.equal(countPhysicalLines("one\n"), 1);
    assert.equal(countPhysicalLines("one\r\ntwo\r\n"), 2);
});

test("renderMarkdown exposes the four project quality sections", () => {
    const trusted = baseline();
    const current = metrics();
    const markdown = renderMarkdown({
        baseline: trusted,
        metrics: current,
        comparison: compareMetrics(trusted, current),
        baselineLabel: "main|trusted`baseline",
    });

    assert.match(markdown, /^# Quality Gate/m);
    for (const heading of [
        "## Frontend coverage",
        "## Tauri coverage",
        "## Frontend maintainability",
        "## Tauri maintainability",
    ]) {
        assert.match(markdown, new RegExp(heading));
    }
    assert.match(markdown, /main\\\|trusted\\`baseline/);
    assert.match(markdown, /LLVM regions/);
});

test("markdownEscape and baseline validation reject malformed input", () => {
    assert.equal(
        markdownEscape("one|two\n`three` <tag> @team"),
        "one\\|two `three` &lt;tag&gt; &#64;team".replace("`three`", "\\`three\\`"),
    );
    const trusted = baseline();
    const inconsistent = structuredClone(trusted);
    inconsistent.projects.frontend.violations.oversizedFiles = 1;
    assert.throws(() => validateBaseline(inconsistent), /oversized-file count/);
    assert.throws(
        () => parseRustCoverageReport({ data: [{ totals: { lines: {}, regions: {}, functions: {} } }] }),
        QualityGateInputError,
    );
});
