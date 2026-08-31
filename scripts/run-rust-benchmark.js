#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(REPOSITORY_ROOT, "src-tauri", "Cargo.toml");
const CRITERION_ROOT = path.join(REPOSITORY_ROOT, "src-tauri", "target", "criterion");
const REPORT_PATH = path.join(REPOSITORY_ROOT, "reports", "benchmarks", "tauri.json");
const SAVED_BASELINE = "quality-gate-current";
const BENCHMARKS = Object.freeze([
    {
        directory: "greet_command",
        groupName: "src-tauri/benches/commands.rs > rust commands",
        name: "greet command",
    },
]);

class RustBenchmarkError extends Error {
    constructor(message) {
        super(message);
        this.name = "RustBenchmarkError";
    }
}

function readJson(filePath, label) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        throw new RustBenchmarkError(`Could not read ${label} at ${filePath}: ${error.message}`);
    }
}

function positiveNumber(value, label) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RustBenchmarkError(`${label} must be a positive finite number.`);
    }
    return value;
}

function criterionMetric(estimates, sample, label) {
    const meanNanoseconds = positiveNumber(estimates?.mean?.point_estimate, `${label} mean`);
    const medianNanoseconds = positiveNumber(estimates?.median?.point_estimate, `${label} median`);
    const lowerBound = positiveNumber(
        estimates?.mean?.confidence_interval?.lower_bound,
        `${label} confidence lower bound`,
    );
    const upperBound = positiveNumber(
        estimates?.mean?.confidence_interval?.upper_bound,
        `${label} confidence upper bound`,
    );
    const sampleCount = Array.isArray(sample?.times) ? sample.times.length : 0;

    if (sampleCount === 0) {
        throw new RustBenchmarkError(`${label} sample must contain measured times.`);
    }

    return {
        hz: 1_000_000_000 / meanNanoseconds,
        mean: meanNanoseconds / 1_000_000,
        median: medianNanoseconds / 1_000_000,
        rme: ((upperBound - lowerBound) / (2 * meanNanoseconds)) * 100,
        sampleCount,
    };
}

function normalizeCriterionReports(
    criterionRoot = CRITERION_ROOT,
    savedBaseline = SAVED_BASELINE,
    benchmarks = BENCHMARKS,
) {
    const groups = new Map();

    for (const benchmark of benchmarks) {
        const resultDirectory = path.join(criterionRoot, benchmark.directory, savedBaseline);
        const estimates = readJson(path.join(resultDirectory, "estimates.json"), `${benchmark.name} estimates`);
        const sample = readJson(path.join(resultDirectory, "sample.json"), `${benchmark.name} sample`);
        const metric = {
            name: benchmark.name,
            ...criterionMetric(estimates, sample, benchmark.name),
        };
        const entries = groups.get(benchmark.groupName) ?? [];
        entries.push(metric);
        groups.set(benchmark.groupName, entries);
    }

    return {
        files: [
            {
                filepath: "src-tauri/benches/commands.rs",
                groups: [...groups.entries()].map(([fullName, benchmarksInGroup]) => ({
                    fullName,
                    benchmarks: benchmarksInGroup,
                })),
            },
        ],
    };
}

function runCargoBenchmark() {
    const result = spawnSync(
        "cargo",
        [
            "bench",
            "--manifest-path",
            MANIFEST_PATH,
            "--locked",
            "--bench",
            "commands",
            "--",
            "--noplot",
            "--save-baseline",
            SAVED_BASELINE,
        ],
        {
            cwd: REPOSITORY_ROOT,
            encoding: "utf8",
            maxBuffer: 20 * 1024 * 1024,
        },
    );

    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");

    if (result.error) {
        throw new RustBenchmarkError(`Could not run cargo bench: ${result.error.message}`);
    }

    if (result.status !== 0) {
        throw new RustBenchmarkError(`cargo bench failed with exit code ${result.status}.`);
    }
}

function runCli() {
    try {
        runCargoBenchmark();
        const report = normalizeCriterionReports();
        fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
        fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
        process.stdout.write(`Rust benchmark report written to ${path.relative(REPOSITORY_ROOT, REPORT_PATH)}\n`);
        return 0;
    } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        process.stderr.write(`${normalized.name}: ${normalized.message}\n`);
        return 1;
    }
}

module.exports = {
    RustBenchmarkError,
    criterionMetric,
    normalizeCriterionReports,
    runCli,
};

if (require.main === module) {
    process.exitCode = runCli();
}
