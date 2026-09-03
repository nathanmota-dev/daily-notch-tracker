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
export const TASK_DURATION_PRESETS = [15, 25, 30, 50] as const

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

export function countTaskCharacters(value: string) {
  return Array.from(value).length
}

export function taskDurationToDraftValue(value: string | number) {
  return String(value)
}

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
    estimateMinutes: taskDurationToDraftValue(task.estimateMinutes),
    isDone: task.isDone,
  }
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
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

export function parseTaskDuration(value: string | number) {
  const text = String(value).trim()
  if (!/^\d+$/.test(text)) {
    return null
  }

  const numericValue = Number(text)
  if (
    !Number.isSafeInteger(numericValue) ||
    numericValue < TASK_MIN_DURATION_MINUTES ||
    numericValue > TASK_MAX_DURATION_MINUTES
  ) {
    return null
  }

  return numericValue
}

export function isValidTaskDuration(value: string | number) {
  return parseTaskDuration(value) !== null
}

export function taskDurationError(value: string) {
  const text = value.trim()
  const numericValue = Number(text)

  if (text === "" || !/^\d+$/.test(text) || !Number.isInteger(numericValue)) {
    return "Enter a whole number of minutes."
  }

  if (
    numericValue < TASK_MIN_DURATION_MINUTES ||
    numericValue > TASK_MAX_DURATION_MINUTES
  ) {
    return `Duration must be between ${TASK_MIN_DURATION_MINUTES} and ${TASK_MAX_DURATION_MINUTES} minutes.`
  }

  return undefined
}

export function validateTaskDraft(draft: TaskDraft): TaskDraftErrors {
  const errors: TaskDraftErrors = {}
  const title = draft.title.trim()

  if (title.length === 0) {
    errors.title = "Title is required."
  } else if (countTaskCharacters(title) > TASK_TITLE_MAX_CHARS) {
    errors.title = `Title must be ${TASK_TITLE_MAX_CHARS} characters or fewer.`
  }

  if (countTaskCharacters(draft.notes) > TASK_NOTES_MAX_CHARS) {
    errors.notes = `Notes must be ${TASK_NOTES_MAX_CHARS} characters or fewer.`
  }

  if (draft.scheduledDate !== "" && !isValidTaskDate(draft.scheduledDate)) {
    errors.scheduledDate = "Enter a valid date."
  }

  const durationError = taskDurationError(draft.estimateMinutes)
  if (durationError) {
    errors.estimateMinutes = durationError
  }

  return errors
}

export function toCreateTaskInput(draft: TaskDraft): CreateTaskInput {
  const estimateMinutes = parseTaskDuration(draft.estimateMinutes)
  if (estimateMinutes === null) {
    throw new Error("A valid task duration is required.")
  }

  return {
    title: draft.title,
    notes: draft.notes,
    scheduledDate: draft.scheduledDate || null,
    estimateMinutes,
  }
}

export function toUpdateTaskInput(draft: TaskDraft): UpdateTaskInput {
  if (!draft.id) {
    throw new Error("An id is required to update a task.")
  }

  const estimateMinutes = parseTaskDuration(draft.estimateMinutes)
  if (estimateMinutes === null) {
    throw new Error("A valid task duration is required.")
  }

  return {
    id: draft.id,
    title: draft.title,
    notes: draft.notes,
    scheduledDate: draft.scheduledDate || null,
    estimateMinutes,
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
