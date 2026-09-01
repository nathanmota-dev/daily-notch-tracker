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
const PROJECT_NAMES = ["frontend", "tauri"];

const DUPLICATION_DEFAULTS = Object.freeze({
    minLines: 5,
    minTokens: 50,
    maxLines: 10_000,
    mode: "strict",
    ignore: [
        "**/__tests__/**",
        "**/test/**",
        "**/tests/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/*-tests.*",
        "**/*_tests.*",
        "**/*.d.ts",
        "**/*.d.mts",
        "**/*.d.cts",
        "**/node_modules/**",
        "**/coverage/**",
        "**/dist/**",
        "**/target/**",
    ],
});

const DEFAULT_FRONTEND_POLICY = Object.freeze({
    project: "frontend",
    sourceRoot: "src",
    sourceExtensions: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"],
    maxFileLines: 350,
    maxFunctionLines: 100,
    excludeTestsFromFileSize: true,
    excludeTestsFromFunctionSize: true,
    allowMissingCoverageFilesWithoutFunctions: false,
    minimumCoverage: Object.fromEntries(COVERAGE_METRICS.map((metric) => [metric, 80])),
    coverageFormat: "vitest-v8",
    duplication: {
        ...DUPLICATION_DEFAULTS,
        crossFormats: "js-ts",
    },
    lint: "eslint",
    language: "javascript",
});

const DEFAULT_TAURI_POLICY = Object.freeze({
    project: "tauri",
    sourceRoot: "src-tauri/src",
    sourceExtensions: [".rs"],
    maxFileLines: 350,
    maxFunctionLines: 100,
    excludeTestsFromFileSize: true,
    excludeTestsFromFunctionSize: true,
    allowMissingCoverageFilesWithoutFunctions: true,
    minimumCoverage: null,
    coverageFormat: "cargo-llvm-cov",
    coverageRegionMetric: "regions",
    duplication: {
        ...DUPLICATION_DEFAULTS,
        crossFormats: "rust",
    },
    lint: "clippy",
    language: "rust",
});

const DEFAULT_POLICIES = Object.freeze({
    frontend: DEFAULT_FRONTEND_POLICY,
    tauri: DEFAULT_TAURI_POLICY,
});

// Kept as an alias for callers of the schema-v1 module API.
const DEFAULT_POLICY = DEFAULT_FRONTEND_POLICY;

class QualityGateInputError extends Error {
    constructor(message) {
        super(message);
        this.name = "QualityGateInputError";
    }
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
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
    const covered = value.covered;
    const total = value.total ?? value.count;
    assertNonNegativeInteger(covered, `${label}.covered`);
    assertNonNegativeInteger(total, `${label}.total`);

    if (covered > total) {
        throw new QualityGateInputError(`${label}.covered cannot exceed ${label}.total.`);
    }

    return { covered, total };
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
    return /(^|\/)(__tests__|test|tests)(\/|$)/.test(filePath)
        || /(^|\/)[^/]+\.(test|spec)\.[^/]+$/.test(filePath)
        || /(^|\/)[^/]+(?:-tests|_tests)\.[^/]+$/.test(filePath)
        || /(^|\/)tests?\.(?:rs|[cm]?[jt]sx?)$/.test(filePath);
}

function isDeclarationFile(filePath) {
    return /\.d\.(ts|mts|cts)$/.test(filePath);
}

function policyForProject(projectName = "frontend") {
    if (!PROJECT_NAMES.includes(projectName)) {
        throw new QualityGateInputError(`Unknown quality project: ${projectName}`);
    }

    return clone(DEFAULT_POLICIES[projectName]);
}

function inferProjectFromPolicy(policy) {
    return policy?.language === "rust" || String(policy?.sourceRoot || "").includes("src-tauri")
        ? "tauri"
        : "frontend";
}

function validatePolicy(policy, label = "baseline.policy", projectName = inferProjectFromPolicy(policy)) {
    assertObject(policy, label);
    const defaults = policyForProject(projectName);
    const merged = {
        ...defaults,
        ...policy,
        duplication: {
            ...defaults.duplication,
            ...(policy.duplication || {}),
        },
    };

    assertPositiveInteger(merged.maxFileLines, `${label}.maxFileLines`);
    assertPositiveInteger(merged.maxFunctionLines, `${label}.maxFunctionLines`);

    if (typeof merged.sourceRoot !== "string" || !merged.sourceRoot) {
        throw new QualityGateInputError(`${label}.sourceRoot must be a non-empty string.`);
    }

    if (!Array.isArray(merged.sourceExtensions)
        || merged.sourceExtensions.length === 0
        || merged.sourceExtensions.some((extension) => typeof extension !== "string" || !extension)) {
        throw new QualityGateInputError(`${label}.sourceExtensions must be a non-empty string array.`);
    }

    for (const key of ["excludeTestsFromFileSize", "excludeTestsFromFunctionSize"]) {
        if (typeof merged[key] !== "boolean") {
            throw new QualityGateInputError(`${label}.${key} must be boolean.`);
        }
    }

    if (typeof merged.allowMissingCoverageFilesWithoutFunctions !== "boolean") {
        throw new QualityGateInputError(
            `${label}.allowMissingCoverageFilesWithoutFunctions must be boolean.`,
        );
    }

    if (merged.minimumCoverage !== null) {
        assertObject(merged.minimumCoverage, `${label}.minimumCoverage`);

        for (const metric of COVERAGE_METRICS) {
            assertFiniteNumber(merged.minimumCoverage[metric], `${label}.minimumCoverage.${metric}`);

            if (merged.minimumCoverage[metric] > 100) {
                throw new QualityGateInputError(`${label}.minimumCoverage.${metric} cannot exceed 100.`);
            }
        }
    }

    assertObject(merged.duplication, `${label}.duplication`);
    assertPositiveInteger(merged.duplication.minLines, `${label}.duplication.minLines`);
    assertPositiveInteger(merged.duplication.minTokens, `${label}.duplication.minTokens`);
    assertPositiveInteger(merged.duplication.maxLines, `${label}.duplication.maxLines`);

    for (const key of ["mode", "crossFormats"]) {
        if (typeof merged.duplication[key] !== "string" || !merged.duplication[key]) {
            throw new QualityGateInputError(`${label}.duplication.${key} must be a non-empty string.`);
        }
    }

    if (!Array.isArray(merged.duplication.ignore)
        || merged.duplication.ignore.some((entry) => typeof entry !== "string" || !entry)) {
        throw new QualityGateInputError(`${label}.duplication.ignore must be a string array.`);
    }

    return merged;
}

function resolveReportedPath(reportedPath, policy, repositoryRoot) {
    const sourceRoot = path.resolve(repositoryRoot, policy.sourceRoot);
    const rawPath = String(reportedPath).replace(/^file:\/\//, "");
    const portablePath = decodeURIComponent(rawPath).replace(/[\\/]+/g, path.sep);
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

    return path.relative(repositoryRoot, absolutePath).split(path.sep).join("/");
}

function parseCoverageFilePaths(summary, policy = DEFAULT_POLICY, repositoryRoot = REPOSITORY_ROOT) {
    assertObject(summary, "coverage summary");
    const validPolicy = validatePolicy(policy, "coverage policy");
    const files = [];

    for (const [reportedPath, fileMetrics] of Object.entries(summary)) {
        if (reportedPath === "total") {
            continue;
        }

        assertObject(fileMetrics, `coverage entry ${reportedPath}`);
        const normalizedPath = resolveReportedPath(reportedPath, validPolicy, repositoryRoot);

        if (validPolicy.excludeTestsFromFileSize
            && (isTestFile(normalizedPath) || isDeclarationFile(normalizedPath))) {
            continue;
        }

        files.push(normalizedPath);
    }

    const uniqueFiles = [...new Set(files)].sort((left, right) => left.localeCompare(right));

    if (uniqueFiles.length !== files.length) {
        throw new QualityGateInputError("Coverage report contains duplicate normalized file paths.");
    }

    return uniqueFiles;
}

function validateCoverageScope(
    coverageFiles,
    fileLines,
    policy = DEFAULT_POLICY,
    functionLines = {},
) {
    const validPolicy = validatePolicy(policy, "coverage policy");

    if (!Array.isArray(coverageFiles) || coverageFiles.some((filePath) => typeof filePath !== "string" || !filePath)) {
        throw new QualityGateInputError("Coverage file paths must be a string array.");
    }

    assertObject(fileLines, "source file lines");
    const actual = new Set(coverageFiles);

    if (actual.size !== coverageFiles.length) {
        throw new QualityGateInputError("Coverage file paths contain duplicates.");
    }

    const prefix = `${validPolicy.sourceRoot}/`;
    const expected = Object.keys(fileLines)
        .filter((filePath) => filePath.startsWith(prefix)
            && !(validPolicy.excludeTestsFromFileSize && isTestFile(filePath))
            && !isDeclarationFile(filePath))
        .sort((left, right) => left.localeCompare(right));
    const expectedSet = new Set(expected);
    const missing = expected.filter((filePath) => {
        if (actual.has(filePath)) {
            return false;
        }

        if (!validPolicy.allowMissingCoverageFilesWithoutFunctions) {
            return true;
        }

        return Object.keys(functionLines).some((functionPath) =>
            functionPath.startsWith(`${filePath}::`),
        );
    });
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

function countEslintRuleViolations(report, ruleId) {
    if (!Array.isArray(report)) {
        throw new QualityGateInputError("ESLint report must be an array.");
    }

    return report.reduce((total, result, index) => {
        assertObject(result, `ESLint result ${index}`);
        if (!Array.isArray(result.messages)) {
            throw new QualityGateInputError(`ESLint result ${index}.messages must be an array.`);
        }

        return total + result.messages.filter((message) => message?.ruleId === ruleId).length;
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

function rustCoverageMetric(value, label) {
    assertObject(value, label);
    const covered = value.covered;
    const total = value.count ?? value.total;
    assertNonNegativeInteger(covered, `${label}.covered`);
    assertNonNegativeInteger(total, `${label}.count`);

    if (covered > total) {
        throw new QualityGateInputError(`${label}.covered cannot exceed ${label}.count.`);
    }

    return { covered, total };
}

function rustCoverageTotals(report) {
    assertObject(report, "Rust coverage report");
    const data = Array.isArray(report.data) ? report.data : [];
    const totals = report.totals ?? data.find((entry) => entry?.totals)?.totals ?? report.summary;

    if (!totals) {
        throw new QualityGateInputError("Rust coverage report is missing totals.");
    }

    assertObject(totals, "Rust coverage totals");
    const lines = rustCoverageMetric(totals.lines, "Rust coverage totals.lines");
    const regions = rustCoverageMetric(
        totals.regions ?? totals.statements,
        "Rust coverage totals.regions",
    );
    const functions = rustCoverageMetric(totals.functions, "Rust coverage totals.functions");

    if (!totals.branches) {
        throw new QualityGateInputError(
            "Rust coverage report is missing branch coverage; run cargo-llvm-cov with --branch.",
        );
    }

    const branches = rustCoverageMetric(totals.branches, "Rust coverage totals.branches");

    return { lines, regions, functions, branches };
}

function rustCoverageFiles(report) {
    const data = Array.isArray(report.data) ? report.data : [];
    const files = data.flatMap((entry) => Array.isArray(entry?.files) ? entry.files : []);
    const summary = {};

    for (const [index, file] of files.entries()) {
        assertObject(file, `Rust coverage file ${index}`);
        if (typeof file.filename !== "string" || !file.filename) {
            throw new QualityGateInputError(`Rust coverage file ${index}.filename must be a non-empty string.`);
        }

        summary[file.filename] = file;
    }

    return summary;
}

function parseRustCoverageReport(
    report,
    label = "Rust coverage report",
    repositoryRoot = REPOSITORY_ROOT,
    policy = DEFAULT_TAURI_POLICY,
) {
    assertObject(report, label);
    const totals = rustCoverageTotals(report);
    const validPolicy = validatePolicy(policy, `${label}.policy`, "tauri");
    const filePaths = parseCoverageFilePaths(rustCoverageFiles(report), validPolicy, repositoryRoot);

    return {
        coverage: {
            lines: totals.lines,
            statements: totals.regions,
            functions: totals.functions,
            branches: totals.branches,
        },
        filePaths,
        regionMetric: "regions",
    };
}

function parseJsonLines(report, label) {
    if (Array.isArray(report)) {
        return report;
    }

    if (report && typeof report === "object") {
        if (Array.isArray(report.messages)) {
            return report.messages;
        }

        if (Number.isInteger(report.violations)) {
            return report.violations;
        }

        return [report];
    }

    if (typeof report !== "string") {
        throw new QualityGateInputError(`${label} must be JSON, JSON lines, or an array.`);
    }

    const contents = report.trim();
    if (!contents) {
        return [];
    }

    try {
        return JSON.parse(contents);
    } catch {
        return contents.split(/\r?\n/).filter(Boolean).map((line, index) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                throw new QualityGateInputError(`${label} line ${index + 1} is invalid JSON: ${error.message}`);
            }
        });
    }
}

function parseClippyReport(report) {
    const parsed = parseJsonLines(report, "Clippy report");

    if (Number.isInteger(parsed)) {
        assertNonNegativeInteger(parsed, "Clippy violations");
        return parsed;
    }

    if (!Array.isArray(parsed)) {
        throw new QualityGateInputError("Clippy report must contain an array of diagnostics.");
    }

    return parsed.reduce((total, item, index) => {
        assertObject(item, `Clippy diagnostic ${index}`);
        const diagnostic = item.reason === "compiler-message" ? item.message : item.message ?? item;

        if (!diagnostic || typeof diagnostic !== "object") {
            return total;
        }

        const level = String(diagnostic.level || "").toLowerCase();
        const code = String(diagnostic.code?.code || "").toLowerCase();
        const isClippy = code.startsWith("clippy::");
        return total + (isClippy && ["warning", "error"].includes(level) ? 1 : 0);
    }, 0);
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
    const validPolicy = validatePolicy(policy, "source policy");
    const extensions = new Set(validPolicy.sourceExtensions);
    const absoluteRoot = path.resolve(repositoryRoot, validPolicy.sourceRoot);
    const files = {};

    if (!absoluteRoot.startsWith(`${repositoryRoot}${path.sep}`)) {
        throw new QualityGateInputError(`Source root escapes the repository: ${validPolicy.sourceRoot}`);
    }

    if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) {
        throw new QualityGateInputError(`Source root does not exist: ${validPolicy.sourceRoot}`);
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

            if (validPolicy.excludeTestsFromFileSize && isTestFile(relativePath)) {
                continue;
            }

            files[relativePath] = countPhysicalLines(fs.readFileSync(absolutePath, "utf8"));
        }
    }

    visit(absoluteRoot);
    return Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
}

function maskSource(contents) {
    const output = contents.split("");
    let state = "code";
    let quote = "";
    let escaped = false;

    for (let index = 0; index < output.length; index += 1) {
        const character = contents[index];
        const next = contents[index + 1];

        if (state === "line-comment") {
            if (character === "\n" || character === "\r") {
                state = "code";
            } else {
                output[index] = " ";
            }
            continue;
        }

        if (state === "block-comment") {
            if (character === "*" && next === "/") {
                output[index] = " ";
                output[index + 1] = " ";
                index += 1;
                state = "code";
            } else if (character !== "\n" && character !== "\r") {
                output[index] = " ";
            }
            continue;
        }

        if (state === "string") {
            if (character === "\n" || character === "\r") {
                state = "code";
                escaped = false;
            } else if (escaped) {
                output[index] = " ";
                escaped = false;
            } else if (character === "\\") {
                output[index] = " ";
                escaped = true;
            } else if (character === quote) {
                output[index] = " ";
                state = "code";
            } else {
                output[index] = " ";
            }
            continue;
        }

        if (character === "/" && next === "/") {
            output[index] = " ";
            output[index + 1] = " ";
            index += 1;
            state = "line-comment";
        } else if (character === "/" && next === "*") {
            output[index] = " ";
            output[index + 1] = " ";
            index += 1;
            state = "block-comment";
        } else if (["'", '"', "`"].includes(character)) {
            output[index] = " ";
            quote = character;
            escaped = false;
            state = "string";
        }
    }

    return output.join("");
}

function lineNumberAt(contents, index) {
    let line = 1;

    for (let cursor = 0; cursor < index; cursor += 1) {
        if (contents[cursor] === "\n") {
            line += 1;
        }
    }

    return line;
}

function matchingBrace(contents, openIndex) {
    let depth = 0;

    for (let index = openIndex; index < contents.length; index += 1) {
        if (contents[index] === "{") {
            depth += 1;
        } else if (contents[index] === "}") {
            depth -= 1;

            if (depth === 0) {
                return index;
            }
        }
    }

    return contents.length - 1;
}

function functionBodyBrace(contents, startIndex) {
    let parentheses = 0;
    let brackets = 0;

    for (let index = startIndex; index < contents.length; index += 1) {
        if (contents[index] === "(") {
            parentheses += 1;
        } else if (contents[index] === ")") {
            parentheses -= 1;
        } else if (contents[index] === "[") {
            brackets += 1;
        } else if (contents[index] === "]") {
            brackets -= 1;
        } else if (contents[index] === "{" && parentheses === 0 && brackets === 0) {
            return index;
        }
    }

    return -1;
}

function testModuleRanges(masked) {
    const ranges = [];
    const pattern = /#\[\s*cfg\s*\(\s*test\s*\)\s*\]\s*mod\s+[A-Za-z_][\w]*\s*\{/g;

    for (const match of masked.matchAll(pattern)) {
        const openIndex = match.index + match[0].lastIndexOf("{");
        ranges.push([match.index, matchingBrace(masked, openIndex)]);
    }

    return ranges;
}

function inRanges(index, ranges) {
    return ranges.some(([start, end]) => index >= start && index <= end);
}

function sourceFunctionMatches(masked, language) {
    if (language === "rust") {
        return [...masked.matchAll(/\bfn\s+([A-Za-z_][\w]*)\s*(?:<[^>{}]*>)?\s*\([^)]*\)[^{;]*\{/g)]
            .map((match) => ({ name: match[1], index: functionBodyBrace(masked, match.index) }))
            .filter((match) => match.index >= 0);
    }

    const matches = [];
    const functionPattern = /\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)?\s*\([^)]*\)[^{;]*\{/g;
    const arrowPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=;\n]+)?=>\s*\{/g;
    const methodPattern = /(?:^|[\n;{}])\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^;{}]*\)\s*(?::[^{}=>]+)?\s*\{/gm;

    for (const match of masked.matchAll(functionPattern)) {
        const bodyIndex = functionBodyBrace(masked, match.index);
        matches.push({
            name: match[1] || "anonymous",
            index: bodyIndex,
        });
    }

    for (const match of masked.matchAll(arrowPattern)) {
        const bodyIndex = functionBodyBrace(masked, match.index);
        matches.push({
            name: match[1],
            index: bodyIndex,
        });
    }

    for (const match of masked.matchAll(methodPattern)) {
        const name = match[1];
        if (!["if", "for", "while", "switch", "catch", "with"].includes(name)) {
            const bodyIndex = functionBodyBrace(masked, match.index);
            matches.push({
                name,
                index: bodyIndex,
            });
        }
    }

    return matches.filter((match) => match.index >= 0);
}

function collectFunctionSizes(policy = DEFAULT_POLICY, repositoryRoot = REPOSITORY_ROOT) {
    const validPolicy = validatePolicy(policy, "function policy");
    const fileLines = collectFileSizes(validPolicy, repositoryRoot);
    const functionLines = {};

    for (const relativePath of Object.keys(fileLines)) {
        const absolutePath = path.join(repositoryRoot, relativePath);
        const contents = fs.readFileSync(absolutePath, "utf8");
        const masked = maskSource(contents);
        const ranges = validPolicy.excludeTestsFromFunctionSize ? testModuleRanges(masked) : [];
        const language = validPolicy.language === "rust" ? "rust" : "javascript";
        const seenNames = new Map();

        for (const match of sourceFunctionMatches(masked, language)) {
            if (inRanges(match.index, ranges)) {
                continue;
            }

            const endIndex = matchingBrace(masked, match.index);
            const startLine = lineNumberAt(contents, match.index);
            const endLine = lineNumberAt(contents, endIndex);
            const occurrence = (seenNames.get(match.name) || 0) + 1;
            seenNames.set(match.name, occurrence);
            const suffix = occurrence > 1 ? `#${occurrence}` : "";
            functionLines[`${relativePath}::${match.name}${suffix}`] = endLine - startLine + 1;
        }
    }

    return Object.fromEntries(Object.entries(functionLines).sort(([left], [right]) => left.localeCompare(right)));
}

function countLargeFunctions(functionLines, maxFunctionLines) {
    return Object.values(functionLines).filter((lines) => lines > maxFunctionLines).length;
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

function generateEslintReport(policy) {
    const result = runCommand(process.platform === "win32" ? "npm.cmd" : "npm", [
        "exec",
        "--",
        "eslint",
        policy.sourceRoot,
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

    writeJson(path.join(REPORTS_DIRECTORY, "frontend-eslint.json"), report);
}

function generateJscpdReport(policy, projectName) {
    const executable = process.platform === "win32" ? "jscpd.cmd" : "jscpd";
    const binaryPath = path.join(REPOSITORY_ROOT, "node_modules", ".bin", executable);

    if (!fs.existsSync(binaryPath)) {
        throw new QualityGateInputError(`JSCPD is not installed at ${binaryPath}. Run npm ci first.`);
    }

    const outputDirectory = path.join(REPORTS_DIRECTORY, "jscpd", projectName);
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
        throw new QualityGateInputError(`JSCPD ${projectName} report generation failed with exit code ${result.status}.`);
    }
}

function generateClippyReport() {
    const outputDirectory = path.join(REPORTS_DIRECTORY, "tauri");
    ensureDirectory(outputDirectory);
    const result = runCommand("cargo", [
        "clippy",
        "--manifest-path", "src-tauri/Cargo.toml",
        "--locked",
        "--all-targets",
        "--all-features",
        "--message-format=json",
    ]);

    fs.writeFileSync(path.join(outputDirectory, "clippy.ndjson"), result.stdout, "utf8");
    fs.writeFileSync(path.join(outputDirectory, "clippy.stderr"), result.stderr, "utf8");

    if (result.status !== 0) {
        throw new QualityGateInputError(`Clippy report generation failed with exit code ${result.status}.`);
    }
}

function collectMetrics({ policies = DEFAULT_POLICIES, policy, collectToolReports = true } = {}) {
    const selectedPolicies = policy
        ? { frontend: validatePolicy(policy, "policy", "frontend"), tauri: policyForProject("tauri") }
        : {
            frontend: validatePolicy(policies.frontend, "frontend policy", "frontend"),
            tauri: validatePolicy(policies.tauri, "tauri policy", "tauri"),
        };

    if (collectToolReports) {
        generateEslintReport(selectedPolicies.frontend);
        generateJscpdReport(selectedPolicies.frontend, "frontend");
        generateJscpdReport(selectedPolicies.tauri, "tauri");

        if (!fs.existsSync(path.join(REPORTS_DIRECTORY, "tauri", "clippy.ndjson"))) {
            generateClippyReport();
        }
    }

    const frontend = collectFrontendMetrics(selectedPolicies.frontend);
    const tauri = collectTauriMetrics(selectedPolicies.tauri);

    return {
        schemaVersion: 2,
        projects: { frontend, tauri },
    };
}

function collectFrontendMetrics(policy) {
    const coverageSummary = readJson(path.join(REPOSITORY_ROOT, "coverage", "coverage-summary.json"), "frontend coverage summary");
    const fileLines = collectFileSizes(policy);
    const functionLines = collectFunctionSizes(policy);
    const coverageFiles = parseCoverageFilePaths(coverageSummary, policy);
    const coverageFileCount = validateCoverageScope(
        coverageFiles,
        fileLines,
        policy,
        functionLines,
    );
    const eslintReport = readJson(path.join(REPORTS_DIRECTORY, "frontend-eslint.json"), "Frontend ESLint report");
    const duplication = parseJscpdReport(
        readJson(path.join(REPORTS_DIRECTORY, "jscpd", "frontend", "jscpd-report.json"), "Frontend JSCPD report"),
    );

    return {
        policy,
        coverage: parseCoverageSummary(coverageSummary),
        coverageFileCount,
        duplication,
        violations: {
            eslint: parseEslintReport(eslintReport),
            largeFunctions: countLargeFunctions(functionLines, policy.maxFunctionLines),
            oversizedFiles: Object.values(fileLines).filter((lines) => lines > policy.maxFileLines).length,
            eslintLargeFunctions: countEslintRuleViolations(eslintReport, "max-lines-per-function"),
        },
        fileLines,
        functionLines,
    };
}

function collectTauriMetrics(policy) {
    const report = readJson(path.join(REPOSITORY_ROOT, "coverage", "tauri", "coverage.json"), "Tauri coverage report");
    const parsedCoverage = parseRustCoverageReport(report, "Tauri coverage report", REPOSITORY_ROOT, policy);
    const fileLines = collectFileSizes(policy);
    const functionLines = collectFunctionSizes(policy);
    const coverageFileCount = validateCoverageScope(
        parsedCoverage.filePaths,
        fileLines,
        policy,
        functionLines,
    );
    const duplication = parseJscpdReport(
        readJson(path.join(REPORTS_DIRECTORY, "jscpd", "tauri", "jscpd-report.json"), "Tauri JSCPD report"),
    );
    const clippyReportPath = path.join(REPORTS_DIRECTORY, "tauri", "clippy.ndjson");

    return {
        policy,
        coverage: parsedCoverage.coverage,
        coverageFileCount,
        duplication,
        violations: {
            clippy: parseClippyReport(readTextOrEmpty(clippyReportPath)),
            largeFunctions: countLargeFunctions(functionLines, policy.maxFunctionLines),
            oversizedFiles: Object.values(fileLines).filter((lines) => lines > policy.maxFileLines).length,
        },
        fileLines,
        functionLines,
    };
}

function readTextOrEmpty(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new QualityGateInputError(`Required report is missing at ${filePath}.`);
    }

    return fs.readFileSync(filePath, "utf8");
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

function validateDuplication(value, label) {
    assertObject(value, label);
    assertNonNegativeInteger(value.duplicatedLines, `${label}.duplicatedLines`);
    assertNonNegativeInteger(value.totalLines, `${label}.totalLines`);
    assertNonNegativeInteger(value.fragments, `${label}.fragments`);

    if (value.duplicatedLines > value.totalLines) {
        throw new QualityGateInputError(`${label}.duplicatedLines cannot exceed ${label}.totalLines.`);
    }

    return {
        duplicatedLines: value.duplicatedLines,
        totalLines: value.totalLines,
        fragments: value.fragments,
    };
}

function validateLineMap(value, label) {
    assertObject(value, label);

    for (const [filePath, lines] of Object.entries(value)) {
        if (!filePath || filePath.includes("\\")) {
            throw new QualityGateInputError(`Invalid ${label} path: ${filePath}`);
        }

        assertNonNegativeInteger(lines, `${label}.${filePath}`);
    }

    return value;
}

function validateProjectMetrics(project, projectName, label = `${projectName} metrics`) {
    assertObject(project, label);
    const policy = validatePolicy(project.policy || policyForProject(projectName), `${label}.policy`, projectName);
    assertObject(project.coverage, `${label}.coverage`);

    for (const metric of COVERAGE_METRICS) {
        validateCoverageCount(project.coverage[metric], `${label}.coverage.${metric}`);
    }

    assertNonNegativeInteger(project.coverageFileCount, `${label}.coverageFileCount`);
    const duplication = validateDuplication(project.duplication, `${label}.duplication`);
    assertObject(project.violations, `${label}.violations`);
    const lintKey = projectName === "frontend" ? "eslint" : "clippy";
    assertNonNegativeInteger(project.violations[lintKey] ?? 0, `${label}.violations.${lintKey}`);
    assertNonNegativeInteger(project.violations.largeFunctions, `${label}.violations.largeFunctions`);
    assertNonNegativeInteger(project.violations.oversizedFiles, `${label}.violations.oversizedFiles`);
    const fileLines = validateLineMap(project.fileLines, `${label}.fileLines`);
    const functionLines = validateLineMap(project.functionLines, `${label}.functionLines`);
    const oversizedFiles = Object.values(fileLines).filter((lines) => lines > policy.maxFileLines).length;
    const largeFunctions = Object.values(functionLines).filter((lines) => lines > policy.maxFunctionLines).length;

    if (oversizedFiles !== project.violations.oversizedFiles) {
        throw new QualityGateInputError(`${label} oversized-file count does not match fileLines.`);
    }

    if (largeFunctions !== project.violations.largeFunctions) {
        throw new QualityGateInputError(`${label} large-function count does not match functionLines.`);
    }

    return {
        policy,
        coverage: Object.fromEntries(COVERAGE_METRICS.map((metric) => [
            metric,
            validateCoverageCount(project.coverage[metric], `${label}.coverage.${metric}`),
        ])),
        coverageFileCount: project.coverageFileCount,
        duplication,
        violations: {
            [lintKey]: project.violations[lintKey] ?? 0,
            largeFunctions: project.violations.largeFunctions,
            oversizedFiles: project.violations.oversizedFiles,
        },
        fileLines,
        functionLines,
    };
}

function legacyPolicy(policy) {
    assertObject(policy, "baseline.policy");
    return validatePolicy({
        ...policy,
        maxFunctionLines: policy.maxFunctionLines || 100,
        minimumCoverage: null,
        project: "frontend",
        language: "javascript",
    }, "baseline.policy", "frontend");
}

function validateLegacyBaseline(baseline) {
    const policy = legacyPolicy(baseline.policy);
    assertObject(baseline.coverage, "baseline.coverage");

    for (const metric of COVERAGE_METRICS) {
        validateCoverageCount(baseline.coverage[metric], `baseline.coverage.${metric}`);
    }

    const duplication = validateDuplication(baseline.duplication, "baseline.duplication");
    assertObject(baseline.violations, "baseline.violations");
    assertNonNegativeInteger(baseline.violations.eslint, "baseline.violations.eslint");
    assertNonNegativeInteger(baseline.violations.oversizedFiles, "baseline.violations.oversizedFiles");
    const fileLines = validateLineMap(baseline.fileLines, "baseline.fileLines");
    const oversizedFiles = Object.values(fileLines).filter((lines) => lines > policy.maxFileLines).length;

    if (oversizedFiles !== baseline.violations.oversizedFiles) {
        throw new QualityGateInputError("Baseline oversized-file count does not match fileLines.");
    }

    return {
        schemaVersion: 2,
        generatedFromCommit: baseline.generatedFromCommit,
        migratedFromSchemaVersion: 1,
        projects: {
            frontend: {
                policy,
                coverage: Object.fromEntries(COVERAGE_METRICS.map((metric) => [
                    metric,
                    validateCoverageCount(baseline.coverage[metric], `baseline.coverage.${metric}`),
                ])),
                coverageFileCount: baseline.coverageFileCount ?? 0,
                duplication,
                violations: {
                    eslint: baseline.violations.eslint,
                    largeFunctions: 0,
                    oversizedFiles: baseline.violations.oversizedFiles,
                },
                fileLines,
                functionLines: {},
            },
            tauri: null,
        },
    };
}

function validateMigratedLegacyBaseline(baseline) {
    const projects = baseline.projects;
    assertObject(projects, "baseline.projects");

    if (!projects.frontend) {
        throw new QualityGateInputError("baseline.projects.frontend is required.");
    }

    if (projects.tauri !== null) {
        throw new QualityGateInputError("baseline.projects.tauri must be null for a migrated schema v1 baseline.");
    }

    return {
        ...baseline,
        projects: {
            frontend: validateProjectMetrics(projects.frontend, "frontend", "baseline.projects.frontend"),
            tauri: null,
        },
    };
}

function validateBaseline(baseline) {
    assertObject(baseline, "baseline");

    if (baseline.schemaVersion === 1) {
        return validateLegacyBaseline(baseline);
    }

    if (baseline.schemaVersion !== 2) {
        throw new QualityGateInputError(`Unsupported baseline schemaVersion: ${baseline.schemaVersion}`);
    }

    if (baseline.migratedFromSchemaVersion === 1) {
        return validateMigratedLegacyBaseline(baseline);
    }

    const projects = baseline.projects;
    assertObject(projects, "baseline.projects");

    for (const projectName of PROJECT_NAMES) {
        if (!projects[projectName]) {
            throw new QualityGateInputError(`baseline.projects.${projectName} is required.`);
        }

        validateProjectMetrics(projects[projectName], projectName, `baseline.projects.${projectName}`);
    }

    return {
        ...baseline,
        projects: {
            frontend: validateProjectMetrics(projects.frontend, "frontend", "baseline.projects.frontend"),
            tauri: validateProjectMetrics(projects.tauri, "tauri", "baseline.projects.tauri"),
        },
    };
}

function currentProjects(metrics) {
    if (metrics?.projects && typeof metrics.projects === "object") {
        return metrics.projects;
    }

    if (metrics?.frontend || metrics?.tauri) {
        return { frontend: metrics.frontend, tauri: metrics.tauri };
    }

    if (metrics?.coverage) {
        return { frontend: metrics };
    }

    throw new QualityGateInputError("Current metrics must contain frontend and tauri projects.");
}

function currentProject(metrics, projectName) {
    const projects = currentProjects(metrics);
    const project = projects[projectName];

    if (!project) {
        throw new QualityGateInputError(`Current metrics are missing the ${projectName} project.`);
    }

    return validateProjectMetrics(project, projectName, `current.projects.${projectName}`);
}

function projectLintKey(projectName) {
    return projectName === "frontend" ? "eslint" : "clippy";
}

function projectLabel(projectName) {
    return projectName === "frontend" ? "Frontend" : "Tauri";
}

function compareAbsoluteLimits(projectName, project) {
    const label = projectLabel(projectName);
    const failures = [];
    const regressions = [];

    for (const [filePath, lines] of Object.entries(project.fileLines).sort()) {
        if (lines > project.policy.maxFileLines) {
            regressions.push(
                `${label} file ${filePath} exceeds the ${project.policy.maxFileLines}-line limit with ${lines} lines.`,
            );
        }
    }

    for (const [functionPath, lines] of Object.entries(project.functionLines).sort()) {
        if (lines > project.policy.maxFunctionLines) {
            regressions.push(
                `${label} function ${functionPath} exceeds the ${project.policy.maxFunctionLines}-line limit with ${lines} lines.`,
            );
        }
    }

    const lintKey = projectLintKey(projectName);
    if (project.violations[lintKey] > 0) {
        failures.push(`${label} ${lintKey} reported ${project.violations[lintKey]} violation(s).`);
    }

    if (project.violations.largeFunctions > 0 && Object.keys(project.functionLines).length === 0) {
        failures.push(`${label} reported large functions without function-size details.`);
    }

    return { failures, regressions };
}

function compareProject(projectName, baseline, current) {
    const failures = [];
    const regressions = [];
    const label = projectLabel(projectName);
    const limits = compareAbsoluteLimits(projectName, current);
    failures.push(...limits.failures);
    regressions.push(...limits.regressions);

    for (const metric of COVERAGE_METRICS) {
        const floor = current.policy.minimumCoverage?.[metric];
        if (floor !== undefined && current.coverage[metric].covered * 100 < floor * current.coverage[metric].total) {
            failures.push(
                `${label} ${metric} coverage is ${formatCoverage(current.coverage[metric])}, below the required ${floor.toFixed(2)}%.`,
            );
        }

        if (ratioIsLower(current.coverage[metric], baseline.coverage[metric])) {
            failures.push(
                `${label} ${metric} coverage decreased from ${formatPercentage(percentage(baseline.coverage[metric]))} to ${formatPercentage(percentage(current.coverage[metric]))}.`,
            );
        }
    }

    if (current.duplication.totalLines === 0 && baseline.duplication.totalLines > 0) {
        failures.push(`${label} duplication report is empty; the baseline scanned ${baseline.duplication.totalLines} lines.`);
    } else if (duplicationRatioIsHigher(current.duplication, baseline.duplication)) {
        failures.push(
            `${label} duplication increased from ${formatPercentage(duplicationPercentage(baseline.duplication))} to ${formatPercentage(duplicationPercentage(current.duplication))}.`,
        );
    }

    if (current.duplication.fragments > baseline.duplication.fragments) {
        failures.push(
            `${label} duplicate fragments increased from ${baseline.duplication.fragments} to ${current.duplication.fragments}.`,
        );
    }

    const lintKey = projectLintKey(projectName);
    if (current.violations[lintKey] > baseline.violations[lintKey]) {
        failures.push(`${label} ${lintKey} violations increased from ${baseline.violations[lintKey]} to ${current.violations[lintKey]}.`);
    }

    if (current.violations.largeFunctions > baseline.violations.largeFunctions) {
        failures.push(
            `${label} large functions increased from ${baseline.violations.largeFunctions} to ${current.violations.largeFunctions}.`,
        );
    }

    if (current.violations.oversizedFiles > baseline.violations.oversizedFiles) {
        failures.push(
            `${label} oversized files increased from ${baseline.violations.oversizedFiles} to ${current.violations.oversizedFiles}.`,
        );
    }

    return {
        passed: failures.length === 0 && regressions.length === 0,
        failures,
        regressions,
    };
}

function compareMetrics(baseline, current) {
    const trustedBaseline = validateBaseline(baseline);
    const currentByProject = currentProjects(current);
    const failures = [];
    const regressions = [];
    const projectComparisons = {};

    for (const projectName of PROJECT_NAMES) {
        const currentMetrics = currentProject(current, projectName);
        const baselineMetrics = trustedBaseline.projects[projectName];

        if (!baselineMetrics) {
            const limits = compareAbsoluteLimits(projectName, currentMetrics);
            projectComparisons[projectName] = {
                passed: limits.failures.length === 0 && limits.regressions.length === 0,
                failures: limits.failures,
                regressions: limits.regressions,
                baselineAvailable: false,
            };
            failures.push(...limits.failures);
            regressions.push(...limits.regressions);
            continue;
        }

        const comparison = compareProject(projectName, baselineMetrics, currentMetrics);
        projectComparisons[projectName] = { ...comparison, baselineAvailable: true };
        failures.push(...comparison.failures);
        regressions.push(...comparison.regressions);
    }

    failures.push(...regressions);

    return {
        passed: failures.length === 0,
        failures,
        regressions,
        projects: projectComparisons,
        baselineMigration: trustedBaseline.migratedFromSchemaVersion === 1,
        currentProjects: currentByProject,
    };
}

function buildProjectBaseline(metrics, projectName, policy) {
    const project = currentProject({ projects: { [projectName]: metrics } }, projectName);
    return {
        policy: validatePolicy(policy || project.policy, `${projectName}.policy`, projectName),
        coverage: Object.fromEntries(COVERAGE_METRICS.map((metric) => [
            metric,
            {
                covered: project.coverage[metric].covered,
                total: project.coverage[metric].total,
            },
        ])),
        coverageFileCount: project.coverageFileCount,
        duplication: { ...project.duplication },
        violations: { ...project.violations },
        fileLines: Object.fromEntries(Object.entries(project.fileLines).sort()),
        functionLines: Object.fromEntries(Object.entries(project.functionLines).sort()),
    };
}

function buildBaseline(metrics, policies = DEFAULT_POLICIES, generatedFromCommit = "unknown") {
    const selectedPolicies = policies?.frontend
        ? policies
        : { frontend: policies, tauri: DEFAULT_TAURI_POLICY };

    return {
        schemaVersion: 2,
        generatedFromCommit,
        projects: {
            frontend: buildProjectBaseline(
                currentProject(metrics, "frontend"),
                "frontend",
                selectedPolicies.frontend,
            ),
            tauri: buildProjectBaseline(
                currentProject(metrics, "tauri"),
                "tauri",
                selectedPolicies.tauri,
            ),
        },
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
    if (!count) {
        return "No baseline";
    }

    return count.total === 0 ? "No data" : formatPercentage(percentage(count));
}

function formatBaselineMetric(project, metric) {
    return project ? formatCoverage(project.coverage[metric]) : "No baseline";
}

function renderProjectMarkdown(lines, projectName, baseline, metrics) {
    const label = projectLabel(projectName);
    const baselineProject = baseline.projects[projectName];
    const currentProjectMetrics = metrics.projects[projectName];
    const lintKey = projectLintKey(projectName);
    const lintLabel = projectName === "frontend" ? "ESLint violations" : "Clippy violations";
    const statementNote = projectName === "tauri" ? " (LLVM regions)" : "";

    lines.push(
        `## ${label} coverage`,
        "",
        "| Metric | Baseline | Current |",
        "|---|---:|---:|",
    );

    for (const metric of COVERAGE_METRICS) {
        lines.push(
            `| ${metric}${metric === "statements" ? statementNote : ""} | ${formatBaselineMetric(baselineProject, metric)} | ${formatCoverage(currentProjectMetrics.coverage[metric])} |`,
        );
    }

    lines.push(
        "",
        `## ${label} maintainability`,
        "",
        "| Metric | Baseline | Current |",
        "|---|---:|---:|",
        `| Duplication | ${baselineProject ? formatPercentage(duplicationPercentage(baselineProject.duplication)) : "No baseline"} | ${formatPercentage(duplicationPercentage(currentProjectMetrics.duplication))} |`,
        `| Duplicate fragments | ${baselineProject?.duplication.fragments ?? "No baseline"} | ${currentProjectMetrics.duplication.fragments} |`,
        `| ${lintLabel} | ${baselineProject?.violations[lintKey] ?? "No baseline"} | ${currentProjectMetrics.violations[lintKey]} |`,
        `| Large functions (> ${currentProjectMetrics.policy.maxFunctionLines} lines) | ${baselineProject?.violations.largeFunctions ?? "No baseline"} | ${currentProjectMetrics.violations.largeFunctions} |`,
        `| Oversized files (> ${currentProjectMetrics.policy.maxFileLines} lines) | ${baselineProject?.violations.oversizedFiles ?? "No baseline"} | ${currentProjectMetrics.violations.oversizedFiles} |`,
        "",
    );
}

function renderMarkdown({ baseline, metrics, comparison, baselineLabel = "scripts/baseline.json" }) {
    const trustedBaseline = validateBaseline(baseline);
    const current = {
        projects: {
            frontend: currentProject(metrics, "frontend"),
            tauri: currentProject(metrics, "tauri"),
        },
    };
    const lines = [
        "# Quality Gate",
        "",
        comparison.bootstrap
            ? "✅ **PASS** — Baseline captured for this quality suite. Blocking comparisons start after this reference is merged to the base branch."
            : comparison.passed
                ? "✅ **PASS** — No quality regression detected."
                : `❌ **FAIL** — ${comparison.failures.length} quality issue(s) detected.`,
        "",
        `Baseline: \`${markdownEscape(baselineLabel)}\` (commit \`${markdownEscape(trustedBaseline.generatedFromCommit)}\`)`,
        "",
    ];

    if (comparison.baselineMigration) {
        lines.push(
            "⚠️ **MIGRATION** — The trusted baseline uses schema v1. Generate and merge the schema-v2 baseline to compare both projects.",
            "",
        );
    }

    if (!comparison.passed) {
        lines.push("## Failures", "", ...comparison.failures.map((failure) => `- ${markdownEscape(failure)}`), "");
    }

    for (const projectName of PROJECT_NAMES) {
        renderProjectMarkdown(lines, projectName, trustedBaseline, current);
    }

    lines.push(
        "## Diagnostics",
        "",
        `- Frontend production source files: ${Object.keys(current.projects.frontend.fileLines).length}`,
        `- Frontend files represented in coverage: ${current.projects.frontend.coverageFileCount}`,
        `- Frontend JSCPD lines: ${current.projects.frontend.duplication.duplicatedLines} duplicated / ${current.projects.frontend.duplication.totalLines} scanned`,
        `- Tauri production source files: ${Object.keys(current.projects.tauri.fileLines).length}`,
        `- Tauri files represented in coverage: ${current.projects.tauri.coverageFileCount}`,
        `- Tauri JSCPD lines: ${current.projects.tauri.duplication.duplicatedLines} duplicated / ${current.projects.tauri.duplication.totalLines} scanned`,
        "- Tauri `statements` maps to LLVM `regions`; branches require the `cargo-llvm-cov --branch` export.",
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
    writeJson(JSON_PATH, { schemaVersion: 2, status: "error", error: error.message });
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
        const policies = existingBaseline?.migratedFromSchemaVersion === 1
            ? DEFAULT_POLICIES
            : existingBaseline
                ? {
                    frontend: existingBaseline.projects.frontend.policy,
                    tauri: existingBaseline.projects.tauri.policy,
                }
                : DEFAULT_POLICIES;
        const metrics = collectMetrics({ policies, collectToolReports: options.collectToolReports });
        const candidate = buildBaseline(metrics, policies, currentCommit());
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
                schemaVersion: 2,
                status: "bootstrap",
                baseline: { label: "bootstrap", generatedFromCommit: candidate.generatedFromCommit },
                metrics,
                comparison,
            });
            process.stdout.write(markdown);
            return comparison.passed ? 0 : 1;
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
                schemaVersion: 2,
                status: comparison.passed ? "pass" : "fail",
                baselineUpdated: path.relative(REPOSITORY_ROOT, options.baselinePath),
                metrics,
                comparison,
            });
            process.stdout.write(`Quality baseline updated: ${path.relative(REPOSITORY_ROOT, options.baselinePath)}\n`);
            process.stdout.write(markdown);
            return comparison.passed ? 0 : 1;
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
            schemaVersion: 2,
            status: comparison.passed ? "pass" : "fail",
            baseline: {
                label: baselineLabel,
                generatedFromCommit: existingBaseline.generatedFromCommit,
                migratedFromSchemaVersion: existingBaseline.migratedFromSchemaVersion,
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
    DEFAULT_FRONTEND_POLICY,
    DEFAULT_TAURI_POLICY,
    DEFAULT_POLICIES,
    PROJECT_NAMES,
    QualityGateInputError,
    buildBaseline,
    collectFileSizes,
    collectFunctionSizes,
    collectMetrics,
    compareMetrics,
    countEslintRuleViolations,
    countLargeFunctions,
    countPhysicalLines,
    duplicationPercentage,
    duplicationRatioIsHigher,
    markdownEscape,
    parseArguments,
    parseClippyReport,
    parseCoverageFilePaths,
    parseCoverageSummary,
    parseEslintReport,
    parseJscpdReport,
    parseRustCoverageReport,
    renderMarkdown,
    runCli,
    validateBaseline,
    validateCoverageScope,
    validatePolicy,
};

if (require.main === module) {
    process.exitCode = runCli();
}
