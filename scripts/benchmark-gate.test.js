"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
    BenchmarkGateInputError,
    DEFAULT_POLICY,
    buildSnapshot,
    compareBenchmarks,
    extractProjectMetrics,
    markdownEscape,
    parseArguments,
    renderMarkdown,
    validateBaseline,
} = require("./benchmark-gate.js");

function metric(hz = 100) {
    return { hz, mean: 10, median: 9, rme: 1, sampleCount: 100 };
}

function project(hz = 100) {
    return { benchmarks: { "suite > benchmark": metric(hz) } };
}

function baseline() {
    return buildSnapshot({ tauri: project(), frontend: project() }, DEFAULT_POLICY, "abc123");
}

test("extractProjectMetrics normalizes a Vitest-compatible report", () => {
    const result = extractProjectMetrics("frontend", {
        files: [{
            groups: [{
                fullName: "render suite",
                benchmarks: [{ name: "screen", ...metric(500) }],
            }],
        }],
    });

    assert.deepEqual(result, {
        benchmarks: { "render suite > screen": metric(500) },
    });
});

test("extractProjectMetrics rejects missing and duplicate benchmark data", () => {
    assert.throws(() => extractProjectMetrics("tauri", {}), BenchmarkGateInputError);
    assert.throws(() => extractProjectMetrics("tauri", { files: [] }), /did not contain benchmarks/);

    const duplicate = {
        files: [{
            groups: [{
                fullName: "suite",
                benchmarks: [
                    { name: "same", ...metric() },
                    { name: "same", ...metric() },
                ],
            }],
        }],
    };
    assert.throws(() => extractProjectMetrics("tauri", duplicate), /duplicate benchmark/);
});

test("compareBenchmarks accepts the threshold boundary and improvements", () => {
    const trusted = baseline();
    const current = buildSnapshot({ tauri: project(80), frontend: project(120) }, trusted.policy, "def456");
    const result = compareBenchmarks(trusted, current, ["tauri", "frontend"]);

    assert.equal(result.passed, true);
    assert.deepEqual(result.results.map(({ status }) => status), ["pass", "pass"]);
});

test("compareBenchmarks blocks regressions above the limit and missing benchmarks", () => {
    const trusted = baseline();
    const slow = buildSnapshot({ tauri: project(79.99) }, trusted.policy, "def456");
    const regression = compareBenchmarks(trusted, slow, ["tauri"]);

    assert.equal(regression.passed, false);
    assert.equal(regression.results[0].status, "regression");

    const missing = buildSnapshot({ tauri: { benchmarks: {} } }, trusted.policy, "def456");
    const missingResult = compareBenchmarks(trusted, missing, ["tauri"]);
    assert.equal(missingResult.passed, false);
    assert.equal(missingResult.results[0].status, "missing");
});

test("compareBenchmarks reports new benchmarks without blocking", () => {
    const trusted = baseline();
    const current = buildSnapshot({
        tauri: { benchmarks: { ...project().benchmarks, "suite > new": metric(50) } },
    }, trusted.policy, "def456");
    const result = compareBenchmarks(trusted, current, ["tauri"]);

    assert.equal(result.passed, true);
    assert.equal(result.results.find(({ key }) => key === "suite > new").status, "new");
    assert.equal(result.warnings.length, 1);
});

test("validateBaseline rejects invalid policy and incomplete projects", () => {
    assert.doesNotThrow(() => validateBaseline(baseline()));
    assert.throws(() => validateBaseline({ ...baseline(), schemaVersion: 2 }), /schemaVersion 1/);
    assert.throws(() => validateBaseline({ ...baseline(), policy: { maxRegressionPercent: 100 } }), /lower than 100/);
    assert.throws(() => validateBaseline({ ...baseline(), projects: { tauri: project() } }), /frontend project/);

    const invalid = baseline();
    invalid.projects.tauri.benchmarks["suite > benchmark"].hz = Number.NaN;
    assert.throws(() => validateBaseline(invalid), /positive finite number/);
});

test("renderMarkdown includes comparisons, skipped projects and escaped names", () => {
    const trusted = baseline();
    const comparison = compareBenchmarks(
        trusted,
        buildSnapshot({ tauri: project(90) }, trusted.policy),
        ["tauri"],
    );
    comparison.warnings.push("notify @team|now");
    const markdown = renderMarkdown({
        baseline: trusted,
        comparison,
        selectedProjects: ["tauri"],
        skippedProjects: ["frontend"],
        baselineLabel: "main|trusted`baseline",
    });

    assert.match(markdown, /^# Performance/m);
    assert.match(markdown, /-10\.00%/);
    assert.match(markdown, /Skipped projects: `frontend`/);
    assert.match(markdown, /main\\\|trusted\\`baseline/);
    assert.match(markdown, /&#64;team\\\|now/);
});

test("renderMarkdown describes bootstrap without claiming a comparison", () => {
    const trusted = baseline();
    const comparison = compareBenchmarks(trusted, trusted, ["tauri"]);
    comparison.bootstrap = true;
    const markdown = renderMarkdown({
        baseline: trusted,
        comparison,
        selectedProjects: ["tauri"],
        skippedProjects: ["frontend"],
        baselineLabel: "bootstrap:scripts/benchmark-baseline.json",
    });

    assert.match(markdown, /Baseline captured for this benchmark suite/);
    assert.doesNotMatch(markdown, /No blocking microbenchmark regressions/);
});

test("argument parsing validates projects and baseline paths", () => {
    assert.deepEqual(parseArguments(["--projects", "tauri"]), {
        bootstrap: false,
        updateBaseline: false,
        projects: ["tauri"],
        baselinePath: parseArguments([]).baselinePath,
    });
    assert.equal(parseArguments(["--bootstrap"]).bootstrap, true);
    assert.deepEqual(parseArguments(["--projects", ""]).projects, []);
    assert.throws(() => parseArguments(["--projects", "api"]), /Unknown benchmark project/);
    assert.throws(() => parseArguments(["--baseline"]), /requires a path/);
    assert.throws(() => parseArguments(["--unknown"]), /Unknown argument/);
});

test("markdownEscape prevents table and mention injection", () => {
    assert.equal(
        markdownEscape("one|two\n`three` <tag> @team"),
        "one\\|two \\`three\\` &lt;tag&gt; &#64;team",
    );
});
