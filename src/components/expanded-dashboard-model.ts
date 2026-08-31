import type { FocusSnapshot, Task } from "../lib/desktopApi"

import {
  getFocusProgress,
  getFocusRemainingMs,
} from "./collapsed-focus"

export const EXPANDED_DASHBOARD_MAX_VISIBLE_ROWS = 2

export function sortTasksForDashboard(tasks: readonly Task[]) {
  return [...tasks].sort((left, right) => {
    if (left.isDone !== right.isDone) {
      return left.isDone ? 1 : -1
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder
    }

    return Date.parse(left.createdAt) - Date.parse(right.createdAt)
  })
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
