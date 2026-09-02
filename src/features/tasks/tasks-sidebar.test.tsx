import { fireEvent, render, screen } from "@testing-library/react"
import { vi } from "vitest"

import { TasksSidebar } from "./tasks-sidebar"

describe("Tasks sidebar", () => {
  it("renders the Tasks heading and Calendar slot", () => {
    render(
      <TasksSidebar
        busy={false}
        onDateChange={vi.fn()}
        onOpenSettings={vi.fn()}
        selectedDate="2026-09-02"
        today={new Date(2026, 8, 2, 12)}
      />,
    )

    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="tasks-calendar"]'),
    ).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="tasks-calendar-widget"]'),
    ).toBeInTheDocument()
    expect(
      document.querySelector('[data-date="2026-09-02"][data-selected="true"]'),
    ).toBeInTheDocument()
  })

  it("forwards Settings and selected-day actions", () => {
    const onDateChange = vi.fn()
    const onOpenSettings = vi.fn()

    render(
      <TasksSidebar
        busy={false}
        onDateChange={onDateChange}
        onOpenSettings={onOpenSettings}
        selectedDate="2026-09-02"
        today={new Date(2026, 8, 2, 12)}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Settings" }))
    fireEvent.click(screen.getByRole("button", { name: "September 3, 2026" }))

    expect(onOpenSettings).toHaveBeenCalledOnce()
    expect(onDateChange).toHaveBeenCalledWith("2026-09-03")
  })
})
