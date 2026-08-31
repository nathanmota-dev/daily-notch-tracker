"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
    RustBenchmarkError,
    criterionMetric,
    normalizeCriterionReports,
} = require("./run-rust-benchmark.js");

function estimates(mean = 2_000, median = 1_900) {
    return {
        mean: {
            point_estimate: mean,
            confidence_interval: {
                lower_bound: mean * 0.98,
                upper_bound: mean * 1.02,
            },
        },
        median: { point_estimate: median },
    };
}

test("criterionMetric converts nanoseconds into the shared benchmark schema", () => {
    assert.deepEqual(criterionMetric(estimates(), { times: [1, 2, 3] }, "greet"), {
        hz: 500_000,
        mean: 0.002,
        median: 0.0019,
        rme: 2,
        sampleCount: 3,
    });
});

test("criterionMetric rejects incomplete Criterion output", () => {
    assert.throws(
        () => criterionMetric(estimates(), { times: [] }, "greet"),
        RustBenchmarkError,
    );
});

test("normalizeCriterionReports reads the named saved baseline", (context) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rust-benchmark-"));
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const resultDirectory = path.join(directory, "greet_command", "current");
    fs.mkdirSync(resultDirectory, { recursive: true });
    fs.writeFileSync(path.join(resultDirectory, "estimates.json"), JSON.stringify(estimates()), "utf8");
    fs.writeFileSync(path.join(resultDirectory, "sample.json"), JSON.stringify({ times: [1, 2] }), "utf8");

    const report = normalizeCriterionReports(directory, "current", [{
        directory: "greet_command",
        groupName: "commands",
        name: "greet command",
    }]);

    assert.equal(report.files[0].groups[0].benchmarks[0].hz, 500_000);
});
