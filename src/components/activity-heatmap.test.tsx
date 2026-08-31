import { render, screen } from "@testing-library/react"

import {
  ACTIVITY_HEATMAP_COLUMN_COUNT,
  ACTIVITY_HEATMAP_INTENSITIES,
  getActivityHeatmapModel,
  getMockActivityIntensity,
} from "./activity-heatmap-model"
import { ActivityHeatmap } from "./activity-heatmap"

function localDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 12)
}

describe("getActivityHeatmapModel", () => {
  it.each([
    { month: 0, weekday: 4 },
    { month: 1, weekday: 0 },
    { month: 3, weekday: 3 },
    { month: 4, weekday: 5 },
    { month: 5, weekday: 1 },
    { month: 7, weekday: 6 },
    { month: 8, weekday: 2 },
  ])(
    "starts the first day in the Monday-first column for weekday $weekday",
    ({ month, weekday }) => {
      const model = getActivityHeatmapModel(
        localDate(2026, month, new Date(2026, month + 1, 0).getDate()),
      )
      const firstDayIndex = model.cells.findIndex(
        (cell) => cell.dayOfMonth === 1,
      )

      expect(firstDayIndex).toBe((weekday + 6) % 7)
      expect(model.cells[firstDayIndex]?.column).toBe((weekday + 6) % 7)
    },
  )

  it.each([
    { date: localDate(2021, 1, 28), rows: 4 },
    { date: localDate(2026, 8, 30), rows: 5 },
    { date: localDate(2026, 7, 31), rows: 6 },
  ])("supports a $rows-row month", ({ date, rows }) => {
    const model = getActivityHeatmapModel(date)

    expect(model.rowCount).toBe(rows)
    expect(model.cells).toHaveLength(rows * ACTIVITY_HEATMAP_COLUMN_COUNT)
  })

  it("stops at today while keeping future cells empty", () => {
    const model = getActivityHeatmapModel(localDate(2026, 7, 28))
    const activityCells = model.cells.filter(
      (cell) => cell.state === "activity",
    )
    const futureCells = model.cells.filter((cell) => cell.state === "future")

    expect(model.rowCount).toBe(5)
    expect(activityCells).toHaveLength(28)
    expect(futureCells.map((cell) => cell.dayOfMonth)).toEqual([29, 30])
    expect(model.cells.some((cell) => cell.dayOfMonth === 31)).toBe(false)
    expect(futureCells.every((cell) => cell.intensity === null)).toBe(true)
  })

  it("keeps cells outside the month empty", () => {
    const model = getActivityHeatmapModel(localDate(2026, 7, 31))
    const outsideCells = model.cells.filter(
      (cell) => cell.state === "outside-month",
    )

    expect(outsideCells).toHaveLength(11)
    expect(outsideCells.every((cell) => cell.intensity === null)).toBe(true)
    expect(outsideCells.every((cell) => cell.date === null)).toBe(true)
  })

  it("supports all five deterministic mock intensity levels", () => {
    const levels = new Set(
      Array.from({ length: 31 }, (_, index) =>
        getMockActivityIntensity(index + 1),
      ),
    )

    expect([...levels]).toEqual([...ACTIVITY_HEATMAP_INTENSITIES])
  })

  it("allows deterministic levels to be supplied by day", () => {
    const model = getActivityHeatmapModel(localDate(2026, 7, 5), {
      1: 0,
      2: 1,
      3: 2,
      4: 3,
      5: 4,
    })

    expect(
      model.cells
        .filter((cell) => cell.state === "activity")
        .map((cell) => cell.intensity),
    ).toEqual([0, 1, 2, 3, 4])
  })
})

describe("ActivityHeatmap", () => {
  it("renders the monthly grid with accessible month metadata", () => {
    render(
      <ActivityHeatmap
        levelsByDay={{ 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 }}
        today={localDate(2026, 7, 31)}
      />,
    )

    const heatmap = screen.getByRole("img", {
      name: "Activity heatmap for August 2026",
    })
    const cells = heatmap.querySelectorAll(".activity-heatmap__cell")

    expect(heatmap).toHaveAttribute("data-month", "2026-08")
    expect(heatmap).toHaveAttribute("data-row-count", "6")
    expect(cells).toHaveLength(42)
    expect(heatmap.querySelector('[data-day="1"]')).toHaveAttribute(
      "data-column",
      "5",
    )
    expect(heatmap.querySelector('[data-day="31"]')).toHaveAttribute(
      "data-cell-state",
      "activity",
    )
  })

  it("does not assign activity intensity to future or outside cells", () => {
    render(<ActivityHeatmap today={localDate(2026, 7, 28)} />)

    const emptyCells = document.querySelectorAll(
      '[data-cell-state="future"], [data-cell-state="outside-month"]',
    )

    expect(emptyCells.length).toBeGreaterThan(0)
    expect(
      [...emptyCells].every((cell) => !cell.hasAttribute("data-intensity")),
    ).toBe(true)
  })
})
