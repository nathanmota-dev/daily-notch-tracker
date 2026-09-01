import type { FocusSnapshot, Task } from "../lib/desktopApi"
import { getLocalDateString } from "../lib/local-date"

import {
  getFocusProgress,
  getFocusRemainingMs,
} from "./collapsed-focus"

export const EXPANDED_DASHBOARD_MAX_VISIBLE_ROWS = 2

export { getLocalDateString }

export function sortTasksForDashboard(tasks: readonly Task[]) {
  return [...tasks].sort((left, right) => {
    if (left.isDone !== right.isDone) {
      return left.isDone ? 1 : -1
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder
    }

    const createdAtComparison =
      Date.parse(left.createdAt) - Date.parse(right.createdAt)

    return createdAtComparison || left.id.localeCompare(right.id)
  })
}

export function selectTasksForDashboard(
  tasks: readonly Task[],
  now: Date | number = Date.now(),
) {
  const today = getLocalDateString(now)

  return sortTasksForDashboard(
    tasks.filter((task) => task.scheduledDate === today),
  )
}

export function reorderTaskIds(
  taskIds: readonly string[],
  draggedTaskId: string,
  targetTaskId: string,
) {
  const sourceIndex = taskIds.indexOf(draggedTaskId)
  const targetIndex = taskIds.indexOf(targetTaskId)

  if (
    sourceIndex === -1 ||
    targetIndex === -1 ||
    draggedTaskId === targetTaskId
  ) {
    return [...taskIds]
  }

  const reorderedTaskIds = taskIds.filter((taskId) => taskId !== draggedTaskId)
  const insertionIndex = Math.min(targetIndex, reorderedTaskIds.length)

  reorderedTaskIds.splice(insertionIndex, 0, draggedTaskId)

  return reorderedTaskIds
}

export function getExpandedDashboardProgress(
  focus: FocusSnapshot,
  now = Date.now(),
) {
  return getFocusProgress(focus.totalMs, getFocusRemainingMs(focus, now))
}

export function formatTaskDuration(estimateMinutes: number) {
  const safeMinutes =
    Number.isFinite(estimateMinutes) && estimateMinutes >= 0
      ? Math.round(estimateMinutes)
      : 0

  return safeMinutes + " min"
}
