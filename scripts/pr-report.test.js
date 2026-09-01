"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
    COMMENT_MARKER,
    buildConsolidatedTable,
    combineReports,
    normalizeResult,
    parseArguments,
    removeEmojis,
    renderPrReport,
} = require("./pr-report.js");

function qualityManifest(overrides = {}) {
    return {
        workflow: "quality-gate",
        overall: "FAIL",
        checks: [
            { name: "npm ci", result: "success", selected: true, blocking: true, blockingRule: "always" },
            { name: "High npm audit", result: "failure", selected: true, blocking: false, blockingRule: "warning-only" },
            { name: "Rust Clippy", result: "skipped", selected: true, blocking: true, blockingRule: "always" },
        ],
        ...overrides,
    };
}

function performanceManifest(overrides = {}) {
    return {
        workflow: "performance",
        overall: "PASS",
        checks: [
            { name: "Tauri microbenchmarks", result: "skipped", selected: false, blocking: true, blockingRule: "when-selected" },
            { name: "Frontend microbenchmarks", result: "success", selected: true, blocking: true, blockingRule: "when-selected" },
            { name: "Benchmark-gate tests", result: "success", selected: true, blocking: true, blockingRule: "always" },
        ],
        ...overrides,
    };
}

test("buildConsolidatedTable renders one table with selected, skipped and warning checks", () => {
    const table = buildConsolidatedTable({
        qualityManifest: qualityManifest(),
        performanceManifest: performanceManifest(),
    });

    assert.equal((table.match(/\| Workflow \| Check \| Result \| Selected \| Blocking \|/g) || []).length, 1);
    assert.match(table, /\| Quality Gate \| npm ci \| PASS \| Yes \| Yes \|/);
    assert.match(table, /\| Quality Gate \| High npm audit \| WARNING \| Yes \| No \(warning\) \|/);
    assert.match(table, /\| Quality Gate \| Rust Clippy \| SKIPPED \| Yes \| Yes \|/);
    assert.match(table, /\| Performance \| Tauri microbenchmarks \| SKIPPED \| No \| When selected \|/);
    assert.match(table, /\| Performance \| Frontend microbenchmarks \| PASS \| Yes \| When selected \|/);
});

test("combineReports extracts base details and never includes PR wrappers", () => {
    const combined = combineReports({
        qualityReport: [
            "# PR Quality Gate",
            "",
            "## Workflow checks",
            "",
            "| Check | Result |",
            "|---|---|",
            "| npm ci | success |",
            "",
            "---",
            "",
            "# Quality Gate",
            "",
            "✅ **PASS** — No quality regression detected.",
            "",
            "## Frontend coverage",
        ].join("\n"),
        performanceReport: [
            "# PR Microbenchmarks",
            "",
            "## Workflow checks",
            "",
            "| Check | Result |",
            "|---|---|",
            "| Benchmarks | success |",
            "",
            "---",
            "",
            "# Performance",
            "",
            "🆕 New benchmark",
        ].join("\n"),
    });

    assert.doesNotMatch(combined, /PR Quality Gate|PR Microbenchmarks|## Workflow checks/);
    assert.match(combined, /No quality regression detected/);
    assert.match(combined, /New benchmark/);
    assert.match(combined, /## Quality Gate/);
    assert.match(combined, /## Performance/);
});

test("renderPrReport sanitizes only the comment copy and preserves status meanings", () => {
    const report = renderPrReport({
        qualityReport: [
            "# Quality Gate",
            "",
            "✅ **PASS** — No quality regression detected.",
            "",
            "## Frontend coverage",
            "",
            "## Frontend maintainability",
            "",
            "## Tauri coverage",
            "",
            "## Tauri maintainability",
        ].join("\n"),
        performanceReport: "# Performance\n\n❌ **FAIL** — Regression.\n\n⚠️ WARNING\n\n🆕 NEW\n\n⏭️ SKIPPED",
        qualityManifest: qualityManifest({ overall: "FAIL" }),
        performanceManifest: performanceManifest(),
    });

    assert.match(report, new RegExp(`^${COMMENT_MARKER}`));
    assert.equal((report.match(/\| Workflow \| Check \| Result \| Selected \| Blocking \|/g) || []).length, 1);
    assert.match(report, /\bPASS\b/);
    assert.match(report, /\bFAIL\b/);
    assert.match(report, /\bWARNING\b/);
    assert.match(report, /\bNEW\b/);
    assert.match(report, /\bSKIPPED\b/);
    for (const heading of [
        "## Frontend coverage",
        "## Frontend maintainability",
        "## Tauri coverage",
        "## Tauri maintainability",
    ]) {
        assert.match(report, new RegExp(heading));
    }
    assert.doesNotMatch(report, /(?:✅|❌|⚠️|🆕|⏭️)/u);
});

test("renderPrReport reports missing artifacts with workflow links", () => {
    const report = renderPrReport({
        qualityManifest: qualityManifest(),
        qualityWorkflowUrl: "https://github.com/example/repo/actions/runs/10",
        performanceWorkflowUrl: "https://github.com/example/repo/actions/workflows/performance.yml",
    });

    assert.match(report, /Report details are unavailable/);
    assert.match(report, /the Performance workflow/);
    assert.match(report, /actions\/workflows\/performance\.yml/);
    assert.match(report, /\| Performance \| Report artifact \| SKIPPED \| Yes \| No \|/);
    assert.doesNotMatch(report, /PR Quality Gate|PR Microbenchmarks/);
});

test("renderPrReport reports a performance wait timeout", () => {
    const report = renderPrReport({
        performanceStatus: "timeout",
        performanceWorkflowUrl: "https://github.com/example/repo/actions/workflows/performance.yml",
    });

    assert.match(report, /Performance overall: \*\*FAIL\*\*/);
    assert.match(report, /\| Performance \| Workflow completion \| FAIL \| Yes \| Yes \|/);
    assert.match(report, /did not complete within the 10-minute wait window/);
});

test("normalizeResult preserves skipped selection and maps action outcomes", () => {
    assert.equal(normalizeResult("success"), "PASS");
    assert.equal(normalizeResult("failure"), "FAIL");
    assert.equal(normalizeResult("warning"), "WARNING");
    assert.equal(normalizeResult("new"), "NEW");
    assert.equal(normalizeResult("success", { selected: false }), "SKIPPED");
});

test("buildConsolidatedTable accepts string blocking rules and selection fields", () => {
    const table = buildConsolidatedTable({
        qualityManifest: {
            workflow: "quality",
            checks: [
                { name: "selected check", outcome: "success", selection: "selected", blocking: "always" },
                { name: "warning check", outcome: "failure", selection: true, blocking: "warning-only" },
                { name: "unselected check", outcome: "success", selection: "unselected", blocking: "when-selected" },
            ],
        },
        performanceManifest: null,
    });

    assert.match(table, /\| Quality Gate \| selected check \| PASS \| Yes \| Yes \|/);
    assert.match(table, /\| Quality Gate \| warning check \| WARNING \| Yes \| No \(warning\) \|/);
    assert.match(table, /\| Quality Gate \| unselected check \| SKIPPED \| No \| When selected \|/);
});

test("removeEmojis leaves ordinary markdown and status text unchanged", () => {
    assert.equal(
        removeEmojis("✅ PASS | ❌ FAIL | ⚠️ WARNING | 🆕 NEW | ⏭️ SKIPPED | plain text"),
        " PASS |  FAIL |  WARNING |  NEW |  SKIPPED | plain text",
    );
});

test("parseArguments accepts report, manifest, URL and output paths", () => {
    const options = parseArguments([
        "--quality-report", "quality.md",
        "--performance-report", "performance.md",
        "--quality-manifest", "quality.json",
        "--performance-manifest", "performance.json",
        "--quality-workflow-url", "https://example.test/quality",
        "--performance-workflow-url", "https://example.test/performance",
        "--output", "comment.md",
    ]);

    assert.deepEqual(options, {
        qualityReport: "quality.md",
        performanceReport: "performance.md",
        qualityManifest: "quality.json",
        performanceManifest: "performance.json",
        qualityWorkflowUrl: "https://example.test/quality",
        performanceWorkflowUrl: "https://example.test/performance",
        qualityStatus: "",
        qualityConclusion: "",
        performanceStatus: "",
        performanceConclusion: "",
        output: "comment.md",
    });
    assert.throws(() => parseArguments(["--output"]), /requires a value/);
    assert.throws(() => parseArguments(["--unknown"]), /Unknown argument/);
});
