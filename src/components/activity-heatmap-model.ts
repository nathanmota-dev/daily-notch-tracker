import { getLocalDateString } from "../lib/local-date"

import {
  getActivityIntensity,
  type ActivityCountsByDate,
} from "./activity-model"

export const ACTIVITY_HEATMAP_COLUMN_COUNT = 7

export const ACTIVITY_HEATMAP_INTENSITIES = [0, 1, 2, 3, 4] as const

export type ActivityIntensity =
  (typeof ACTIVITY_HEATMAP_INTENSITIES)[number]

export type ActivityCellState = "activity" | "future" | "outside-month"

export type ActivityHeatmapCell = {
  column: number
  date: string | null
  dayOfMonth: number | null
  intensity: ActivityIntensity | null
  row: number
  state: ActivityCellState
}

export type ActivityHeatmapModel = {
  cells: readonly ActivityHeatmapCell[]
  month: number
  monthLabel: string
  rowCount: number
  year: number
}

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
})

export function formatActivityDateKey(date: Date) {
  return getLocalDateString(date)
}

export function getActivityHeatmapModel(
  today: Date | number = Date.now(),
  countsByDate: ActivityCountsByDate = {},
): ActivityHeatmapModel {
  const currentDate =
    today instanceof Date ? new Date(today.getTime()) : new Date(today)
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthStart = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingEmptyCells = (monthStart.getDay() + 6) % 7
  const todayDay = Math.min(Math.max(currentDate.getDate(), 1), daysInMonth)
  const rowCount = Math.max(
    1,
    Math.ceil(
      (leadingEmptyCells + todayDay) / ACTIVITY_HEATMAP_COLUMN_COUNT,
    ),
  )

  const cells = Array.from(
    { length: rowCount * ACTIVITY_HEATMAP_COLUMN_COUNT },
    (_, index): ActivityHeatmapCell => {
      const row = Math.floor(index / ACTIVITY_HEATMAP_COLUMN_COUNT)
      const column = index % ACTIVITY_HEATMAP_COLUMN_COUNT
      const dayOfMonth = index - leadingEmptyCells + 1

      if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
        return {
          column,
          date: null,
          dayOfMonth: null,
          intensity: null,
          row,
          state: "outside-month",
        }
      }

      const date = new Date(year, month, dayOfMonth)
      const dateKey = formatActivityDateKey(date)

      if (dayOfMonth > todayDay) {
        return {
          column,
          date: dateKey,
          dayOfMonth,
          intensity: null,
          row,
          state: "future",
        }
      }

      return {
        column,
        date: dateKey,
        dayOfMonth,
        intensity: getActivityIntensity(countsByDate[dateKey] ?? 0),
        row,
        state: "activity",
      }
    },
  )

  return {
    cells,
    month,
    monthLabel: monthLabelFormatter.format(monthStart),
    rowCount,
    year,
  }
}
