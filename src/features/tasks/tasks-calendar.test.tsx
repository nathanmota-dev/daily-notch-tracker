import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TasksCalendar } from "./tasks-calendar"

function localDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 12)
}

describe("TasksCalendar", () => {
  it("renders a Monday-first month with selected and current states", () => {
    render(
      <TasksCalendar
        busy={false}
        onSelectDate={vi.fn()}
        selectedDate="2026-09-02"
        today={localDate(2026, 8, 2)}
      />,
    )

    const calendar = screen.getByRole("group", {
      name: "Calendar for September 2026",
    })
    const selectedDay = screen.getByRole("button", {
      name: "September 2, 2026",
    })

    expect(calendar).toHaveAttribute("data-month", "2026-09")
    expect(calendar).toHaveAttribute("data-row-count", "5")
    expect(calendar.querySelectorAll("button[data-date]")).toHaveLength(30)
    expect(selectedDay).toHaveAttribute("aria-pressed", "true")
    expect(selectedDay).toHaveAttribute("aria-current", "date")
    expect(selectedDay).toHaveAttribute("data-selected", "true")
    expect(selectedDay).toHaveAttribute("data-today", "true")
  })

  it("navigates across year boundaries without changing the selected day", async () => {
    const onSelectDate = vi.fn()
    render(
      <TasksCalendar
        busy={false}
        onSelectDate={onSelectDate}
        selectedDate="2026-01-15"
        today={localDate(2026, 0, 15)}
      />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Previous month" }))
    expect(
      screen.getByRole("group", { name: "Calendar for December 2025" }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Next month" }))
    expect(
      screen.getByRole("group", { name: "Calendar for January 2026" }),
    ).toBeInTheDocument()
    expect(onSelectDate).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "January 15, 2026" }),
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("selects a day and returns to Today", async () => {
    const onSelectDate = vi.fn()
    render(
      <TasksCalendar
        busy={false}
        onSelectDate={onSelectDate}
        selectedDate="2026-09-02"
        today={localDate(2026, 10, 21)}
      />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "September 8, 2026" }))
    expect(onSelectDate).toHaveBeenCalledWith("2026-09-08")

    await user.click(screen.getByRole("button", { name: "Today" }))
    expect(onSelectDate).toHaveBeenLastCalledWith("2026-11-21")
    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: "Calendar for November 2026" }),
      ).toBeInTheDocument(),
    )
  })

  it("disables navigation and date actions while busy", () => {
    render(
      <TasksCalendar
        busy
        onSelectDate={vi.fn()}
        selectedDate="2026-09-02"
        today={localDate(2026, 8, 2)}
      />,
    )

    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "September 8, 2026" }),
    ).toBeDisabled()
  })

  it("moves the visible month when an external selection changes", async () => {
    const onSelectDate = vi.fn()
    const view = render(
      <TasksCalendar
        busy={false}
        onSelectDate={onSelectDate}
        selectedDate="2026-09-02"
        today={localDate(2026, 8, 2)}
      />,
    )

    view.rerender(
      <TasksCalendar
        busy={false}
        onSelectDate={onSelectDate}
        selectedDate="2026-12-05"
        today={localDate(2026, 8, 2)}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: "Calendar for December 2026" }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole("button", { name: "December 5, 2026" }),
    ).toHaveAttribute("aria-pressed", "true")
  })
})
