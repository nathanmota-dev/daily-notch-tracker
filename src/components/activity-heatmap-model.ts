export const ACTIVITY_HEATMAP_COLUMN_COUNT = 7

export const ACTIVITY_HEATMAP_INTENSITIES = [0, 1, 2, 3, 4] as const

export type ActivityIntensity =
  (typeof ACTIVITY_HEATMAP_INTENSITIES)[number]

export type ActivityCellState = "activity" | "future" | "outside-month"

export type ActivityLevelsByDay = Readonly<
  Partial<Record<number, ActivityIntensity>>
>

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

export const MOCK_ACTIVITY_LEVELS: readonly ActivityIntensity[] = [
  0, 1, 0, 2, 1, 0, 3, 0, 1, 2, 3, 1, 0, 2, 4, 1, 0, 3, 2, 1, 0, 2, 3,
  4, 1, 0, 2, 3, 1, 4, 2,
]

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
})

function padDatePart(value: number) {
  return value.toString().padStart(2, "0")
}

export function formatActivityDateKey(date: Date) {
  return [
    date.getFullYear().toString().padStart(4, "0"),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-")
}

export function getMockActivityIntensity(dayOfMonth: number) {
  return MOCK_ACTIVITY_LEVELS[dayOfMonth - 1] ?? 0
}

export function getActivityHeatmapModel(
  today: Date,
  levelsByDay: ActivityLevelsByDay = {},
): ActivityHeatmapModel {
  const year = today.getFullYear()
  const month = today.getMonth()
  const monthStart = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingEmptyCells = (monthStart.getDay() + 6) % 7
  const todayDay = Math.min(Math.max(today.getDate(), 1), daysInMonth)
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
        intensity:
          levelsByDay[dayOfMonth] ?? getMockActivityIntensity(dayOfMonth),
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
