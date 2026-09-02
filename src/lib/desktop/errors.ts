import type { DesktopApi } from "./api"

export type DesktopApiErrorCode =
  | "validation"
  | "not-found"
  | "conflict"
  | "persistence"
  | "permission-denied"
  | "integration-unavailable"
  | "invalid-url"
  | "command-unavailable"
  | "internal"

export type DesktopApiOperation = keyof DesktopApi

export type DesktopApiErrorOptions = {
  operation: string
  code: DesktopApiErrorCode
  message: string
  field?: string
}

export class DesktopApiError extends Error {
  readonly operation: string
  readonly code: DesktopApiErrorCode
  readonly field?: string

  constructor({ operation, code, message, field }: DesktopApiErrorOptions) {
    super(message)
    this.name = "DesktopApiError"
    this.operation = operation
    this.code = code
    this.field = field
  }
}

export const desktopOperationErrorCodes = {
  getSnapshot: ["command-unavailable", "internal"],
  addTask: [
    "validation",
    "conflict",
    "persistence",
    "command-unavailable",
    "internal",
  ],
  updateTask: [
    "validation",
    "not-found",
    "conflict",
    "persistence",
    "command-unavailable",
    "internal",
  ],
  deleteTask: [
    "not-found",
    "conflict",
    "persistence",
    "command-unavailable",
    "internal",
  ],
  toggleTask: [
    "not-found",
    "conflict",
    "persistence",
    "command-unavailable",
    "internal",
  ],
  moveTasks: [
    "validation",
    "not-found",
    "conflict",
    "persistence",
    "command-unavailable",
    "internal",
  ],
  startFocus: [
    "validation",
    "not-found",
    "conflict",
    "persistence",
    "command-unavailable",
    "internal",
  ],
  pauseFocus: ["conflict", "persistence", "command-unavailable", "internal"],
  resumeFocus: ["conflict", "persistence", "command-unavailable", "internal"],
  stopFocus: ["conflict", "persistence", "command-unavailable", "internal"],
  toggleFocus: ["conflict", "persistence", "command-unavailable", "internal"],
  updateSettings: [
    "validation",
    "persistence",
    "command-unavailable",
    "internal",
  ],
  getAppDiagnostics: ["command-unavailable", "internal"],
  setAutostart: [
    "permission-denied",
    "integration-unavailable",
    "persistence",
    "command-unavailable",
    "internal",
  ],
  openTasksWindow: [
    "integration-unavailable",
    "command-unavailable",
    "internal",
  ],
  closeTasksWindow: [
    "integration-unavailable",
    "command-unavailable",
    "internal",
  ],
  openSettingsWindow: [
    "integration-unavailable",
    "command-unavailable",
    "internal",
  ],
  openExternalRelease: [
    "invalid-url",
    "integration-unavailable",
    "command-unavailable",
    "internal",
  ],
  subscribe: ["integration-unavailable", "internal"],
} as const satisfies Record<DesktopApiOperation, readonly DesktopApiErrorCode[]>

const errorCodes = new Set<DesktopApiErrorCode>([
  "validation",
  "not-found",
  "conflict",
  "persistence",
  "permission-denied",
  "integration-unavailable",
  "invalid-url",
  "command-unavailable",
  "internal",
])

function isErrorPayload(
  value: unknown,
): value is { code: DesktopApiErrorCode; message: string; field?: string } {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const payload = value as Record<string, unknown>

  return (
    typeof payload.code === "string" &&
    errorCodes.has(payload.code as DesktopApiErrorCode) &&
    typeof payload.message === "string" &&
    (payload.field === undefined || typeof payload.field === "string")
  )
}

function unavailableCommandMessage(value: unknown) {
  const message =
    typeof value === "string"
      ? value
      : value instanceof Error
        ? value.message
        : ""

  return /unknown command|command .* not found|not found.*command/i.test(message)
}

export function normalizeDesktopApiError(
  value: unknown,
  operation: string,
): DesktopApiError {
  if (value instanceof DesktopApiError) {
    return value
  }

  if (isErrorPayload(value)) {
    return new DesktopApiError({
      operation,
      code: value.code,
      message: value.message,
      field: value.field,
    })
  }

  if (unavailableCommandMessage(value)) {
    return new DesktopApiError({
      operation,
      code: "command-unavailable",
      message: "This desktop command is not available yet.",
    })
  }

  return new DesktopApiError({
    operation,
    code: "internal",
    message: "The desktop operation could not be completed.",
  })
}

export function isDesktopApiError(value: unknown): value is DesktopApiError {
  return value instanceof DesktopApiError
}
