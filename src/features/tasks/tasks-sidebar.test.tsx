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
      />,
    )

    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="tasks-calendar"]'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Selected day")).toHaveValue("2026-09-02")
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
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Settings" }))
    fireEvent.change(screen.getByLabelText("Selected day"), {
      target: { value: "2026-09-03" },
    })

    expect(onOpenSettings).toHaveBeenCalledOnce()
    expect(onDateChange).toHaveBeenCalledWith("2026-09-03")
  })
})
