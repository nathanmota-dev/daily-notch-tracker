import type {
  CreateTaskInput,
  IsoDateString,
  Task,
  TaskBucket,
  UpdateTaskInput,
} from "../../lib/desktopApi"

export const TASK_TITLE_MAX_CHARS = 150
export const TASK_NOTES_MAX_CHARS = 500
export const TASK_MIN_DURATION_MINUTES = 1
export const TASK_MAX_DURATION_MINUTES = 180
export const TASK_DEFAULT_DURATION_MINUTES = 25

export type TasksTab = "day" | "unscheduled"

export type TaskDraft = {
  id: string | null
  title: string
  notes: string
  scheduledDate: string
  estimateMinutes: string
  isDone: boolean
}

export type TaskDraftField =
  | "title"
  | "notes"
  | "scheduledDate"
  | "estimateMinutes"

export type TaskDraftErrors = Partial<Record<TaskDraftField, string>>

export function createEmptyTaskDraft(
  scheduledDate: IsoDateString | null = null,
): TaskDraft {
  return {
    id: null,
    title: "",
    notes: "",
    scheduledDate: scheduledDate ?? "",
    estimateMinutes: String(TASK_DEFAULT_DURATION_MINUTES),
    isDone: false,
  }
}

export function createTaskDraft(task: Task): TaskDraft {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    scheduledDate: task.scheduledDate ?? "",
    estimateMinutes: String(task.estimateMinutes),
    isDone: task.isDone,
  }
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function characterCount(value: string) {
  return Array.from(value).length
}

export function isValidTaskDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1]
}

export function normalizeTaskDuration(value: string | number) {
  const numericValue = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numericValue)) {
    return TASK_DEFAULT_DURATION_MINUTES
  }

  return Math.min(
    TASK_MAX_DURATION_MINUTES,
    Math.max(TASK_MIN_DURATION_MINUTES, Math.round(numericValue)),
  )
}

export function validateTaskDraft(draft: TaskDraft): TaskDraftErrors {
  const errors: TaskDraftErrors = {}
  const title = draft.title.trim()

  if (title.length === 0) {
    errors.title = "Title is required."
  } else if (characterCount(title) > TASK_TITLE_MAX_CHARS) {
    errors.title = `Title must be ${TASK_TITLE_MAX_CHARS} characters or fewer.`
  }

  if (characterCount(draft.notes) > TASK_NOTES_MAX_CHARS) {
    errors.notes = `Notes must be ${TASK_NOTES_MAX_CHARS} characters or fewer.`
  }

  if (draft.scheduledDate !== "" && !isValidTaskDate(draft.scheduledDate)) {
    errors.scheduledDate = "Enter a valid date."
  }

  const duration = Number(draft.estimateMinutes)
  if (
    draft.estimateMinutes.trim() === "" ||
    !Number.isFinite(duration) ||
    !Number.isInteger(duration)
  ) {
    errors.estimateMinutes = "Enter a whole number of minutes."
  }

  return errors
}

export function toCreateTaskInput(draft: TaskDraft): CreateTaskInput {
  return {
    title: draft.title,
    notes: draft.notes,
    scheduledDate: draft.scheduledDate || null,
    estimateMinutes: normalizeTaskDuration(draft.estimateMinutes),
  }
}

export function toUpdateTaskInput(draft: TaskDraft): UpdateTaskInput {
  if (!draft.id) {
    throw new Error("An id is required to update a task.")
  }

  return {
    id: draft.id,
    title: draft.title,
    notes: draft.notes,
    scheduledDate: draft.scheduledDate || null,
    estimateMinutes: normalizeTaskDuration(draft.estimateMinutes),
    isDone: draft.isDone,
  }
}

function compareCreatedAt(left: Task, right: Task) {
  const leftTimestamp = Date.parse(left.createdAt)
  const rightTimestamp = Date.parse(right.createdAt)
  const leftValue = Number.isFinite(leftTimestamp) ? leftTimestamp : 0
  const rightValue = Number.isFinite(rightTimestamp) ? rightTimestamp : 0

  return leftValue - rightValue
}

export function sortTasksForTasksSurface(tasks: readonly Task[]) {
  return [...tasks].sort((left, right) => {
    if (left.isDone !== right.isDone) {
      return left.isDone ? 1 : -1
    }

    return (
      left.sortOrder - right.sortOrder ||
      compareCreatedAt(left, right) ||
      left.id.localeCompare(right.id)
    )
  })
}

export const sortTasksForTaskSurface = sortTasksForTasksSurface

export function selectTasksForTasksSurface(
  tasks: readonly Task[],
  tab: TasksTab,
  selectedDate: IsoDateString,
) {
  const scheduledDate = tab === "day" ? selectedDate : null

  return sortTasksForTasksSurface(
    tasks.filter((task) => task.scheduledDate === scheduledDate),
  )
}

export function formatTaskDuration(estimateMinutes: number) {
  const safeMinutes =
    Number.isFinite(estimateMinutes) && estimateMinutes >= 0
      ? Math.round(estimateMinutes)
      : 0

  return `${safeMinutes} min`
}

export function taskBucketForTab(
  tab: TasksTab,
  selectedDate: IsoDateString,
): TaskBucket {
  return { scheduledDate: tab === "day" ? selectedDate : null }
}

export { reorderTaskIds } from "../../components/expanded-dashboard-model"
