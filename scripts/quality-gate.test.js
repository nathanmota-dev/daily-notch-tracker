"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
    DEFAULT_POLICY,
    QualityGateInputError,
    buildBaseline,
    collectFileSizes,
    compareMetrics,
    countPhysicalLines,
    markdownEscape,
    parseArguments,
    parseCoverageFilePaths,
    parseCoverageSummary,
    parseEslintReport,
    parseJscpdReport,
    renderMarkdown,
    validateBaseline,
    validateCoverageScope,
} = require("./quality-gate.js");

const metricNames = ["lines", "statements", "functions", "branches"];

function coverage(covered = 8, total = 10) {
    return Object.fromEntries(metricNames.map((metric) => [metric, { covered, total }]));
}

function metrics() {
    return {
        coverage: coverage(),
        coverageFileCount: 2,
        duplication: { duplicatedLines: 10, totalLines: 100, fragments: 2 },
        violations: { eslint: 0, oversizedFiles: 1 },
        fileLines: { "src/legacy.ts": 301, "src/small.ts": 200 },
    };
}

function baseline() {
    return buildBaseline(metrics(), DEFAULT_POLICY, "abc123");
}

test("parseCoverageSummary validates and extracts all required totals", () => {
    const summary = { total: coverage(7, 9) };
    assert.deepEqual(parseCoverageSummary(summary, "fixture"), coverage(7, 9));
    assert.throws(
        () => parseCoverageSummary({ total: { ...coverage(), lines: { covered: 11, total: 10 } } }),
        QualityGateInputError,
    );
    assert.throws(() => parseCoverageSummary({}), /coverage summary.total must be an object/);
});

test("coverage scope includes every production file", (context) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quality-coverage-"));
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const main = path.join(directory, "src", "main.ts");
    const summary = {
        total: coverage(),
        [main]: coverage(),
        "src/unimported.ts": coverage(0, 5),
    };
    const files = parseCoverageFilePaths(summary, DEFAULT_POLICY, directory);
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

test("parseEslintReport counts errors and warnings", () => {
    assert.equal(parseEslintReport([
        { errorCount: 2, warningCount: 1, suppressedMessages: [{}] },
        { errorCount: 0, warningCount: 3 },
    ]), 6);
    assert.throws(() => parseEslintReport([{ errorCount: -1, warningCount: 0 }]), /non-negative integer/);
});

test("parseJscpdReport accepts supported totals and rejects inconsistency", () => {
    assert.deepEqual(parseJscpdReport({
        statistics: { total: { lines: 100, duplicatedLines: 10, clones: 4, percentage: 10 } },
    }), { totalLines: 100, duplicatedLines: 10, fragments: 4 });
    assert.deepEqual(parseJscpdReport({
        statistic: { total: { lines: 50, duplicatedLines: 5, percentage: 10 } },
        duplicates: [{}, {}],
    }), { totalLines: 50, duplicatedLines: 5, fragments: 2 });
    assert.throws(() => parseJscpdReport({
        statistics: { total: { lines: 100, duplicatedLines: 10, clones: 1, percentage: 50 } },
    }), /inconsistent/);
});

test("countPhysicalLines handles line endings and final newlines", () => {
    assert.equal(countPhysicalLines(""), 0);
    assert.equal(countPhysicalLines("one"), 1);
    assert.equal(countPhysicalLines("one\n"), 1);
    assert.equal(countPhysicalLines("one\r\ntwo\r\n"), 2);
});

test("collectFileSizes scans source files without tests or symlinks", (context) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quality-files-"));
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.mkdirSync(path.join(directory, "src", "nested"), { recursive: true });
    fs.writeFileSync(path.join(directory, "src", "main.ts"), "one\ntwo\n", "utf8");
    fs.writeFileSync(path.join(directory, "src", "main.test.ts"), "ignored\n", "utf8");
    fs.writeFileSync(path.join(directory, "src", "nested", "view.tsx"), "one\r\ntwo", "utf8");
    fs.symlinkSync(path.join(directory, "src", "nested"), path.join(directory, "src", "linked"));

    assert.deepEqual(collectFileSizes(DEFAULT_POLICY, directory), {
        "src/main.ts": 2,
        "src/nested/view.tsx": 2,
    });
});

test("validateBaseline rejects unsupported schemas and inconsistent file counts", () => {
    assert.doesNotThrow(() => validateBaseline(baseline()));
    assert.throws(() => validateBaseline({ ...baseline(), schemaVersion: 2 }), /Unsupported baseline/);
    const inconsistent = baseline();
    inconsistent.violations.oversizedFiles = 0;
    assert.throws(() => validateBaseline(inconsistent), /does not match/);
});

test("compareMetrics passes equal metrics and improvements", () => {
    assert.equal(compareMetrics(baseline(), metrics()).passed, true);
    const improved = metrics();
    improved.coverage.lines = { covered: 9, total: 10 };
    improved.duplication = { duplicatedLines: 5, totalLines: 100, fragments: 1 };
    improved.fileLines["src/legacy.ts"] = 300;
    improved.violations.oversizedFiles = 0;
    assert.equal(compareMetrics(baseline(), improved).passed, true);
});

test("compareMetrics blocks coverage, duplication, lint and file-size regressions", () => {
    const current = metrics();
    current.coverage.lines = { covered: 7, total: 10 };
    current.duplication = { duplicatedLines: 11, totalLines: 100, fragments: 3 };
    current.violations.eslint = 1;
    current.fileLines = {
        "src/legacy.ts": 302,
        "src/small.ts": 301,
        "src/new.ts": 450,
    };
    current.violations.oversizedFiles = 3;
    const comparison = compareMetrics(baseline(), current);

    assert.equal(comparison.passed, false);
    assert.ok(comparison.failures.some((failure) => failure.startsWith("lines coverage decreased")));
    assert.ok(comparison.failures.some((failure) => failure.startsWith("Duplication increased")));
    assert.ok(comparison.failures.some((failure) => failure.startsWith("ESLint violations increased")));
    assert.equal(comparison.regressions.length, 3);
});

test("buildBaseline is deterministic and keeps exact coverage counts", () => {
    const current = metrics();
    current.fileLines = { "src/z.ts": 2, "src/a.ts": 1 };
    current.violations.oversizedFiles = 0;
    const built = buildBaseline(current, DEFAULT_POLICY, "deadbeef");

    assert.equal(built.generatedFromCommit, "deadbeef");
    assert.deepEqual(Object.keys(built.fileLines), ["src/a.ts", "src/z.ts"]);
    assert.deepEqual(built.coverage.lines, { covered: 8, total: 10 });
});

test("renderMarkdown includes metrics and escapes the baseline label", () => {
    const trusted = baseline();
    const current = metrics();
    const markdown = renderMarkdown({
        baseline: trusted,
        metrics: current,
        comparison: compareMetrics(trusted, current),
        baselineLabel: "main|trusted`baseline",
    });

    assert.match(markdown, /^# Quality Gate/m);
    assert.match(markdown, /## Frontend coverage/);
    assert.match(markdown, /## Maintainability/);
    assert.match(markdown, /main\\\|trusted\\`baseline/);
});

test("renderMarkdown describes bootstrap without claiming a comparison", () => {
    const trusted = baseline();
    const comparison = compareMetrics(trusted, metrics());
    comparison.bootstrap = true;
    const markdown = renderMarkdown({
        baseline: trusted,
        metrics: metrics(),
        comparison,
        baselineLabel: "bootstrap",
    });

    assert.match(markdown, /Baseline captured for this quality suite/);
    assert.doesNotMatch(markdown, /No quality regression detected/);
});

test("markdownEscape and parseArguments reject injection and invalid options", () => {
    assert.equal(parseArguments(["--bootstrap"]).bootstrap, true);
    assert.equal(
        markdownEscape("one|two\n`three` <tag> @team"),
        "one\\|two \\`three\\` &lt;tag&gt; &#64;team",
    );
    const parsed = parseArguments(["--no-collect", "--baseline", "fixtures/baseline.json"]);
    assert.equal(parsed.collectToolReports, false);
    assert.match(parsed.baselinePath, /fixtures\/baseline\.json$/);
    assert.throws(() => parseArguments(["--baseline"]), /requires a path/);
    assert.throws(() => parseArguments(["--unknown"]), /Unknown argument/);
});
