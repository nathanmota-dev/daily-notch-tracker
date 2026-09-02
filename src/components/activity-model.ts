import type { FocusSession } from "../lib/desktopApi"
import { getLocalDateString } from "../lib/local-date"

import type { ActivityIntensity } from "./activity-heatmap-model"

export type ActivityCountsByDate = Readonly<Record<string, number>>

export type ActivitySummary = {
  countsByDate: ActivityCountsByDate
  streak: number
}

type ActivityClock = Date | number

export function countSessionsByLocalDate(
  sessions: readonly FocusSession[],
): ActivityCountsByDate {
  const countsByDate: Record<string, number> = {}

  sessions.forEach((session) => {
    const startedAt = Date.parse(session.startedAt)

    if (!Number.isFinite(startedAt)) {
      return
    }

    const dateKey = getLocalDateString(startedAt)
    countsByDate[dateKey] = (countsByDate[dateKey] ?? 0) + 1
  })

  return countsByDate
}

export function getActivityIntensity(sessionCount: number): ActivityIntensity {
  if (!Number.isFinite(sessionCount) || sessionCount <= 0) {
    return 0
  }

  if (sessionCount >= 4) {
    return 4
  }

  return Math.floor(sessionCount) as ActivityIntensity
}

function toDate(value: ActivityClock) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value)
}

function previousLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
}

function hasActivity(countsByDate: ActivityCountsByDate, date: Date) {
  return (countsByDate[getLocalDateString(date)] ?? 0) > 0
}

export function calculateActivityStreak(
  countsByDate: ActivityCountsByDate,
  today: ActivityClock = Date.now(),
) {
  let currentDate = toDate(today)

  if (!Number.isFinite(currentDate.getTime())) {
    return 0
  }

  if (!hasActivity(countsByDate, currentDate)) {
    currentDate = previousLocalDate(currentDate)

    if (!hasActivity(countsByDate, currentDate)) {
      return 0
    }
  }

  let streak = 0

  while (hasActivity(countsByDate, currentDate)) {
    streak += 1
    currentDate = previousLocalDate(currentDate)
  }

  return streak
}

export function getActivitySummary(
  sessions: readonly FocusSession[],
  today: ActivityClock = Date.now(),
): ActivitySummary {
  const countsByDate = countSessionsByLocalDate(sessions)

  return {
    countsByDate,
    streak: calculateActivityStreak(countsByDate, today),
  }
}
