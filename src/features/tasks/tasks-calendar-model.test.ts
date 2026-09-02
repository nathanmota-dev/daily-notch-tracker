import { describe, expect, it } from "vitest"

import { getLocalDateString } from "../../lib/local-date"
import {
  getTasksCalendarModel,
  shiftTasksCalendarMonth,
  TASK_CALENDAR_COLUMN_COUNT,
} from "./tasks-calendar-model"

function localDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 12)
}

describe("getTasksCalendarModel", () => {
  it.each([
    { month: 0, weekday: 4 },
    { month: 1, weekday: 0 },
    { month: 3, weekday: 3 },
    { month: 4, weekday: 5 },
    { month: 5, weekday: 1 },
    { month: 7, weekday: 6 },
    { month: 8, weekday: 2 },
  ])(
    "starts day one in the Monday-first column for weekday $weekday",
    ({ month, weekday }) => {
      const date = localDate(2026, month, 15)
      const model = getTasksCalendarModel(date, "2026-09-02", date)
      const firstDay = model.cells.find((cell) => cell.dayOfMonth === 1)

      expect(firstDay?.column).toBe((weekday + 6) % 7)
    },
  )

  it.each([
    { date: localDate(2021, 1, 28), rows: 4 },
    { date: localDate(2026, 8, 30), rows: 5 },
    { date: localDate(2026, 7, 31), rows: 6 },
  ])("supports a $rows-row month", ({ date, rows }) => {
    const model = getTasksCalendarModel(date, "2026-09-02", date)

    expect(model.rowCount).toBe(rows)
    expect(model.cells).toHaveLength(rows * TASK_CALENDAR_COLUMN_COUNT)
  })

  it("keeps February 29 in a leap year", () => {
    const model = getTasksCalendarModel(
      localDate(2024, 1, 29),
      "2024-02-29",
      localDate(2024, 1, 29),
    )
    const leapDay = model.cells.find((cell) => cell.dayOfMonth === 29)

    expect(leapDay).toMatchObject({
      date: "2024-02-29",
      isSelected: true,
      isToday: true,
      state: "day",
    })
  })

  it("marks selected and current days independently", () => {
    const model = getTasksCalendarModel(
      localDate(2026, 8, 1),
      "2026-09-03",
      localDate(2026, 8, 2),
    )

    expect(model.cells.find((cell) => cell.date === "2026-09-02")).toMatchObject({
      isSelected: false,
      isToday: true,
    })
    expect(model.cells.find((cell) => cell.date === "2026-09-03")).toMatchObject({
      isSelected: true,
      isToday: false,
    })
  })

  it("keeps future days available in the monthly grid", () => {
    const model = getTasksCalendarModel(
      localDate(2026, 8, 1),
      "2026-09-30",
      localDate(2026, 8, 2),
    )

    expect(model.cells.find((cell) => cell.date === "2026-09-30")).toMatchObject({
      date: "2026-09-30",
      state: "day",
    })
  })

  it("handles the December to January rollover", () => {
    const previous = shiftTasksCalendarMonth(localDate(2026, 0, 15), -1)
    const next = shiftTasksCalendarMonth(localDate(2025, 11, 15), 1)

    expect(getLocalDateString(previous)).toBe("2025-12-01")
    expect(getLocalDateString(next)).toBe("2026-01-01")
  })
})
