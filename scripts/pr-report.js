#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const COMMENT_MARKER = "<!-- daily-notch-tracker-pr-report -->";
const LEGACY_COMMENT_MARKERS = Object.freeze([
    "<!-- daily-notch-tracker-quality-gate -->",
    "<!-- daily-notch-tracker-performance -->",
    "<!-- daily-notch-tracker-quality-report -->",
    "<!-- daily-notch-tracker-performance-report -->",
]);

const WORKFLOWS = Object.freeze([
    { key: "quality", label: "Quality Gate", heading: "Quality Gate" },
    { key: "performance", label: "Performance", heading: "Performance" },
]);

const RESULT_NAMES = new Set(["PASS", "FAIL", "WARNING", "NEW", "SKIPPED"]);

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

function removeEmojis(markdown) {
    return String(markdown)
        .replace(/\p{Regional_Indicator}{2}/gu, "")
        .replace(/\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?/gu, "")
        .replace(/\p{Emoji_Presentation}/gu, "")
        .replace(/[\uFE0E\uFE0F\u20E3\u200D]/gu, "");
}

function readOptionalFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        return null;
    }

    try {
        return fs.readFileSync(filePath, "utf8");
    } catch {
        return null;
    }
}

function readOptionalJson(filePath) {
    const contents = readOptionalFile(filePath);

    if (contents === null) {
        return null;
    }

    try {
        return JSON.parse(contents);
    } catch {
        return null;
    }
}

function asBoolean(value, defaultValue) {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        if (["true", "yes", "selected"].includes(value.toLowerCase())) {
            return true;
        }

        if (["false", "no", "skipped", "unselected"].includes(value.toLowerCase())) {
            return false;
        }
    }

    return defaultValue;
}

function normalizeResult(value, { selected = true } = {}) {
    if (!selected) {
        return "SKIPPED";
    }

    const normalized = String(value ?? "").trim().toUpperCase();

    if (RESULT_NAMES.has(normalized)) {
        return normalized;
    }

    if (["SUCCESS", "SUCCEEDED", "PASSED", "OK"].includes(normalized)) {
        return "PASS";
    }

    if (["WARN", "NON-BLOCKING", "NON_BLOCKING"].includes(normalized)) {
        return "WARNING";
    }

    if (["SKIP", "NOT_SELECTED", "NOT-SELECTED"].includes(normalized)) {
        return "SKIPPED";
    }

    return "FAIL";
}

function displayWorkflowName(value, fallback) {
    const normalized = String(value ?? "").trim().toLowerCase();

    if (normalized.includes("quality")) {
        return "Quality Gate";
    }

    if (normalized.includes("performance") || normalized.includes("benchmark")) {
        return "Performance";
    }

    return value ? String(value) : fallback;
}

function normalizeCheck(check, index) {
    const source = check && typeof check === "object" ? check : {};
    const selected = asBoolean(source.selected ?? source.selection, true);
    const blockingRule = source.blockingRule
        || source.rule
        || (typeof source.blocking === "string" ? source.blocking : undefined);
    const blocking = ["warning-only", "warning_only", "non-blocking", "non_blocking"].includes(
        String(blockingRule || "").toLowerCase(),
    )
        ? false
        : asBoolean(source.blocking, true);
    const normalizedResult = normalizeResult(source.result ?? source.status ?? source.outcome, { selected });

    return {
        name: source.name ? String(source.name) : `Check ${index + 1}`,
        result: !selected
            ? "SKIPPED"
            : !blocking && normalizedResult === "FAIL"
                ? "WARNING"
                : normalizedResult,
        outcome: source.outcome ? String(source.outcome) : undefined,
        selected,
        blocking,
        blockingRule: String(blockingRule || (blocking ? "always" : "warning-only")),
    };
}

function normalizeManifest(manifest, fallbackWorkflow) {
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
        return null;
    }

    const checks = Array.isArray(manifest.checks)
        ? manifest.checks.map(normalizeCheck)
        : [];
    const inferredOverall = checks.some((check) => check.blocking && check.result === "FAIL")
        ? "FAIL"
        : checks.some((check) => check.result === "WARNING")
            ? "WARNING"
            : checks.length > 0
                ? "PASS"
                : "SKIPPED";

    return {
        workflow: displayWorkflowName(manifest.workflow, fallbackWorkflow),
        overall: normalizeResult(manifest.overall ?? inferredOverall),
        checks,
    };
}

function fallbackManifest(workflow, { status = "", conclusion = "" } = {}) {
    const normalizedConclusion = String(conclusion).toLowerCase();
    const timedOut = String(status).toLowerCase() === "timeout";
    const failed = ["failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"]
        .includes(normalizedConclusion);

    if (timedOut || failed) {
        const reason = timedOut ? "Workflow completion" : "Workflow result";
        return {
            workflow,
            overall: "FAIL",
            checks: [{
                name: reason,
                result: "FAIL",
                selected: true,
                blocking: true,
                blockingRule: timedOut ? "timeout" : "workflow-failed",
            }],
        };
    }

    return {
        workflow,
        overall: "SKIPPED",
        checks: [{
            name: "Report artifact",
            result: "SKIPPED",
            selected: true,
            blocking: false,
            blockingRule: "report-unavailable",
        }],
    };
}

function blockingLabel(check) {
    if (!check.blocking) {
        return check.blockingRule === "warning-only" ? "No (warning)" : "No";
    }

    if (["when-selected", "selected"].includes(check.blockingRule)) {
        return "When selected";
    }

    return "Yes";
}

function buildConsolidatedTable({
    qualityManifest,
    performanceManifest,
    qualityStatus,
    qualityConclusion,
    performanceStatus,
    performanceConclusion,
} = {}) {
    const manifests = [
        normalizeManifest(qualityManifest, "Quality Gate") || fallbackManifest("Quality Gate", {
            status: qualityStatus,
            conclusion: qualityConclusion,
        }),
        normalizeManifest(performanceManifest, "Performance") || fallbackManifest("Performance", {
            status: performanceStatus,
            conclusion: performanceConclusion,
        }),
    ];
    const lines = [
        "## Workflow checks",
        "",
        ...manifests.map((manifest) => `- ${markdownEscape(manifest.workflow)} overall: **${manifest.overall}**.`),
        "",
        "| Workflow | Check | Result | Selected | Blocking |",
        "|---|---|---|---:|---|",
    ];

    for (const manifest of manifests) {
        for (const check of manifest.checks) {
            lines.push(
                `| ${markdownEscape(manifest.workflow)} | ${markdownEscape(check.name)} | ${check.result} | ${check.selected ? "Yes" : "No"} | ${blockingLabel(check)} |`,
            );
        }
    }

    return lines.join("\n");
}

function extractBaseReport(report, heading) {
    if (!report || !String(report).trim()) {
        return null;
    }

    const lines = String(report).replace(/\r\n/g, "\n").split("\n");
    const headingIndex = lines.findIndex((line) => line.trim() === `# ${heading}`);

    if (headingIndex >= 0) {
        return lines.slice(headingIndex).join("\n").trim();
    }

    if (lines.some((line) => /^# PR (Quality Gate|Microbenchmarks)\s*$/.test(line.trim()))) {
        return null;
    }

    return lines.join("\n").trim();
}

function renderReportSection(workflow, report, workflowUrl, { status = "", conclusion = "" } = {}) {
    const baseReport = extractBaseReport(report, workflow.heading);
    const lines = [`## ${workflow.label}`, ""];

    if (!baseReport) {
        const normalizedStatus = String(status).toLowerCase();
        const normalizedConclusion = String(conclusion).toLowerCase();
        let message = "Report details are unavailable.";

        if (normalizedStatus === "timeout") {
            message = "Report details are unavailable because the workflow did not complete within the 10-minute wait window.";
        } else if (normalizedConclusion && normalizedConclusion !== "success") {
            message = `Report details are unavailable because the workflow ended with status \`${markdownEscape(normalizedConclusion)}\`.`;
        }

        const link = workflowUrl ? ` See [the ${workflow.label} workflow](${workflowUrl}).` : "";
        lines.push(`${message}${link}`);
        return lines.join("\n");
    }

    const reportLines = baseReport.split("\n");

    if (reportLines[0]?.trim() === `# ${workflow.heading}`) {
        reportLines.shift();
        while (reportLines[0]?.trim() === "") {
            reportLines.shift();
        }
    }

    lines.push(...reportLines);
    return lines.join("\n").trimEnd();
}

function combineReports({
    qualityReport,
    performanceReport,
    qualityWorkflowUrl,
    performanceWorkflowUrl,
    qualityStatus,
    qualityConclusion,
    performanceStatus,
    performanceConclusion,
} = {}) {
    return [
        renderReportSection(WORKFLOWS[0], qualityReport, qualityWorkflowUrl, {
            status: qualityStatus,
            conclusion: qualityConclusion,
        }),
        renderReportSection(WORKFLOWS[1], performanceReport, performanceWorkflowUrl, {
            status: performanceStatus,
            conclusion: performanceConclusion,
        }),
    ].join("\n\n");
}

function renderPrReport({
    qualityReport,
    performanceReport,
    qualityManifest,
    performanceManifest,
    qualityWorkflowUrl,
    performanceWorkflowUrl,
    qualityStatus,
    qualityConclusion,
    performanceStatus,
    performanceConclusion,
} = {}) {
    const body = [
        COMMENT_MARKER,
        "",
        "# Quality and performance report",
        "",
        buildConsolidatedTable({
            qualityManifest,
            performanceManifest,
            qualityStatus,
            qualityConclusion,
            performanceStatus,
            performanceConclusion,
        }),
        "",
        combineReports({
            qualityReport,
            performanceReport,
            qualityWorkflowUrl,
            performanceWorkflowUrl,
            qualityStatus,
            qualityConclusion,
            performanceStatus,
            performanceConclusion,
        }),
        "",
    ].join("\n");

    return removeEmojis(body);
}

function renderComment(options) {
    return renderPrReport(options);
}

function parseArguments(args) {
    const options = {
        qualityReport: "reports/quality-gate.md",
        performanceReport: "reports/performance.md",
        qualityManifest: "reports/quality-workflow.json",
        performanceManifest: "reports/performance-workflow.json",
        qualityWorkflowUrl: "",
        performanceWorkflowUrl: "",
        qualityStatus: "",
        qualityConclusion: "",
        performanceStatus: "",
        performanceConclusion: "",
        output: "reports/pr-report.md",
    };

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        const option = {
            "--quality-report": "qualityReport",
            "--performance-report": "performanceReport",
            "--quality-manifest": "qualityManifest",
            "--performance-manifest": "performanceManifest",
            "--quality-workflow-url": "qualityWorkflowUrl",
            "--performance-workflow-url": "performanceWorkflowUrl",
            "--quality-status": "qualityStatus",
            "--quality-conclusion": "qualityConclusion",
            "--performance-status": "performanceStatus",
            "--performance-conclusion": "performanceConclusion",
            "--output": "output",
        }[argument];

        if (!option) {
            throw new Error(`Unknown argument: ${argument}`);
        }

        const value = args[++index];

        if (value === undefined) {
            throw new Error(`${argument} requires a value.`);
        }

        options[option] = value;
    }

    return options;
}

function runCli(args = process.argv.slice(2)) {
    try {
        const options = parseArguments(args);
        const output = path.resolve(process.cwd(), options.output);
        const report = renderPrReport({
            qualityReport: readOptionalFile(options.qualityReport),
            performanceReport: readOptionalFile(options.performanceReport),
            qualityManifest: readOptionalJson(options.qualityManifest),
            performanceManifest: readOptionalJson(options.performanceManifest),
            qualityWorkflowUrl: options.qualityWorkflowUrl,
            performanceWorkflowUrl: options.performanceWorkflowUrl,
            qualityStatus: options.qualityStatus,
            qualityConclusion: options.qualityConclusion,
            performanceStatus: options.performanceStatus,
            performanceConclusion: options.performanceConclusion,
        });

        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, report, "utf8");
        process.stdout.write(`PR report written to ${path.relative(process.cwd(), output)}\n`);
        return 0;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        return 1;
    }
}

module.exports = {
    COMMENT_MARKER,
    LEGACY_COMMENT_MARKERS,
    WORKFLOWS,
    buildConsolidatedTable,
    combineReports,
    extractBaseReport,
    markdownEscape,
    normalizeManifest,
    normalizeResult,
    parseArguments,
    readOptionalFile,
    removeEmojis,
    renderComment,
    renderPrReport,
    renderReportSection,
    runCli,
};

if (require.main === module) {
    process.exitCode = runCli();
}
