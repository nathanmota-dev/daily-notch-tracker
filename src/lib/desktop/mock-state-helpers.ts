import type { AppSnapshot, Task } from "./contracts"
import { DesktopApiError } from "./errors"
import type { MockState } from "./mock-state-types"

export function cloneSnapshot(snapshot: AppSnapshot) {
  return structuredClone(snapshot)
}

export function stateError(
  operation: string,
  code: "validation" | "not-found" | "conflict",
  message: string,
  field?: string,
): never {
  throw new DesktopApiError({ operation, code, message, field })
}

export function commitSnapshot(state: MockState, snapshot: AppSnapshot) {
  state.snapshot = cloneSnapshot(snapshot)
  return cloneSnapshot(state.snapshot)
}

export function nextRevision(state: MockState) {
  return state.snapshot.revision + 1
}

export function taskIndex(state: MockState, taskId: string, operation: string) {
  const index = state.snapshot.tasks.findIndex((task) => task.id === taskId)
  if (index === -1) {
    stateError(operation, "not-found", "The task was not found.", "taskId")
  }
  return index
}

export function taskSortOrder(
  tasks: readonly Task[],
  scheduledDate: string | null,
) {
  return tasks
    .filter((task) => task.scheduledDate === scheduledDate)
    .reduce((maximum, task) => Math.max(maximum, task.sortOrder), -1) + 1
}

export function assertValidTaskInput(
  title: string,
  notes: string,
  scheduledDate: string | null,
  estimateMinutes: number,
  operation: string,
) {
  if (!title.trim()) {
    stateError(operation, "validation", "The title is required.", "title")
  }
  if (Array.from(title.trim()).length > 150) {
    stateError(operation, "validation", "The title is too long.", "title")
  }
  if (Array.from(notes).length > 500) {
    stateError(operation, "validation", "Notes are too long.", "notes")
  }
  if (
    scheduledDate !== null &&
    !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)
  ) {
    stateError(
      operation,
      "validation",
      "The scheduled date is invalid.",
      "scheduledDate",
    )
  }
  if (
    !Number.isInteger(estimateMinutes) ||
    estimateMinutes < 1 ||
    estimateMinutes > 180
  ) {
    stateError(
      operation,
      "validation",
      "The estimate must be between 1 and 180 minutes.",
      "estimateMinutes",
    )
  }
}
