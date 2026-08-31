import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import {
  createExpandedDashboardFixtureSnapshot,
  type Task,
} from "../lib/desktopApi"
import { ExpandedDashboard } from "./expanded-dashboard"
import {
  formatTaskDuration,
  sortTasksForDashboard,
} from "./expanded-dashboard-model"

const FIXTURE_NOW = Date.parse("2026-08-31T12:00:00.000Z")

function renderFixture(
  fixture:
    | "expanded"
    | "expanded-empty"
    | "expanded-one"
    | "expanded-overflow"
    | "expanded-completed"
    | "expanded-long-title",
) {
  return render(
    <ExpandedDashboard
      snapshot={createExpandedDashboardFixtureSnapshot(fixture, FIXTURE_NOW)}
    />,
  )
}

describe("ExpandedDashboard", () => {
  it.each([
    { fixture: "expanded" as const, taskCount: 2 },
    { fixture: "expanded-empty" as const, taskCount: 0 },
    { fixture: "expanded-one" as const, taskCount: 1 },
    { fixture: "expanded-overflow" as const, taskCount: 6 },
    { fixture: "expanded-completed" as const, taskCount: 3 },
    { fixture: "expanded-long-title" as const, taskCount: 2 },
  ])("renders the $fixture layout", ({ fixture, taskCount }) => {
    renderFixture(fixture)

    expect(
      screen.getByRole("region", { name: "Expanded dashboard" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "To Do" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Journey Streak" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("img", { name: /Activity heatmap for/ }),
    ).toBeInTheDocument()
    expect(screen.getByText("5d")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Focus timeline" })).toBeInTheDocument()
    expect(
      document.querySelectorAll('[data-slot="compact-task-row"]'),
    ).toHaveLength(taskCount)
  })

  it("keeps the idle timeline visible and exposes the two-row scroll contract", () => {
    const { unmount } = renderFixture("expanded-empty")

    const tray = document.querySelector('[data-slot="progress-tray"]')
    const scrollArea = document.querySelector('[data-slot="scroll-area"]')

    expect(tray).toHaveAttribute("data-timeline", "on")
    expect(screen.getByRole("progressbar")).toBeInTheDocument()
    expect(screen.getByText("No tasks yet")).toBeInTheDocument()
    expect(scrollArea).toHaveAttribute("data-overflow", "off")
    expect(scrollArea).toHaveAttribute("data-visible-rows", "2")

    unmount()
    renderFixture("expanded-overflow")

    expect(
      document.querySelector('[data-slot="scroll-area"]'),
    ).toHaveAttribute("data-overflow", "on")
  })

  it("keeps completed tasks at the end of the ordered list", () => {
    renderFixture("expanded-completed")

    const rows = Array.from(
      document.querySelectorAll('[data-slot="compact-task-row"]'),
    )

    expect(rows.map((row) => row.getAttribute("data-completed"))).toEqual([
      "false",
      "false",
      "true",
    ])
    expect(rows[2]).toHaveTextContent("Ship the completed dashboard draft")
    expect(rows[2]?.querySelector('[aria-checked="true"]')).toBeInTheDocument()
  })

  it("truncates a long title without removing the fixed activity column", () => {
    renderFixture("expanded-long-title")

    const title = document.querySelector('[data-slot="task-title"]')
    const activity = document.querySelector('[data-slot="activity-panel"]')
    const grid = document.querySelector(".expanded-dashboard__grid")

    expect(title).toHaveAttribute(
      "title",
      "Review and refine the complete DailyNotch Linux focus workflow before the next implementation milestone",
    )
    expect(activity).toHaveClass("activity-panel")
    expect(grid).toHaveClass("expanded-dashboard__grid")
  })
})

describe("sortTasksForDashboard", () => {
  function createTask(
    id: string,
    options: Pick<Task, "createdAt" | "isDone" | "sortOrder">,
  ): Task {
    return {
      id,
      title: id,
      notes: "",
      scheduledDate: null,
      estimateMinutes: 25,
      focusedSeconds: 0,
      ...options,
    }
  }

  it("sorts pending tasks first, then order, then creation time without mutation", () => {
    const tasks = [
      createTask("done", {
        createdAt: "2026-08-31T08:00:00.000Z",
        isDone: true,
        sortOrder: 0,
      }),
      createTask("pending-later", {
        createdAt: "2026-08-31T08:00:00.000Z",
        isDone: false,
        sortOrder: 2,
      }),
      createTask("pending-newer", {
        createdAt: "2026-08-31T10:00:00.000Z",
        isDone: false,
        sortOrder: 1,
      }),
      createTask("pending-older", {
        createdAt: "2026-08-31T09:00:00.000Z",
        isDone: false,
        sortOrder: 1,
      }),
    ]
    const originalOrder = tasks.map((task) => task.id)

    expect(sortTasksForDashboard(tasks).map((task) => task.id)).toEqual([
      "pending-older",
      "pending-newer",
      "pending-later",
      "done",
    ])
    expect(tasks.map((task) => task.id)).toEqual(originalOrder)
  })

  it("formats task durations for the compact row", () => {
    expect(formatTaskDuration(25)).toBe("25 min")
    expect(formatTaskDuration(Number.NaN)).toBe("0 min")
  })
})

describe("ExpandedDashboard callbacks", () => {
  it("notifies task, focus, add, open, and reorder actions", async () => {
    const user = userEvent.setup()
    const onToggleTask = vi.fn()
    const onToggleFocus = vi.fn()
    const onAddTask = vi.fn()
    const onOpenTasks = vi.fn()
    const onReorderStart = vi.fn()

    render(
      <ExpandedDashboard
        onAddTask={onAddTask}
        onOpenTasks={onOpenTasks}
        onReorderStart={onReorderStart}
        onToggleFocus={onToggleFocus}
        onToggleTask={onToggleTask}
        snapshot={createExpandedDashboardFixtureSnapshot(
          "expanded",
          FIXTURE_NOW,
        )}
      />,
    )

    await user.click(
      screen.getByRole("checkbox", {
        name: "Mark Plan the next focused block as complete",
      }),
    )
    await user.click(
      screen.getByRole("button", {
        name: "Start focus for Plan the next focused block",
      }),
    )
    await user.click(screen.getByRole("button", { name: "Add a task" }))
    await user.click(screen.getByRole("button", { name: "Open Tasks" }))
    fireEvent.dragStart(
      screen.getByRole("button", {
        name: "Reorder Plan the next focused block",
      }),
    )

    expect(onToggleTask).toHaveBeenCalledWith("expanded-task-1", true)
    expect(onToggleFocus).toHaveBeenCalledWith("expanded-task-1")
    expect(onAddTask).toHaveBeenCalledOnce()
    expect(onOpenTasks).toHaveBeenCalledOnce()
    expect(onReorderStart).toHaveBeenCalledWith("expanded-task-1")
  })

  it("makes only drag handles draggable and sends the pause action for an active task", async () => {
    const onToggleFocus = vi.fn()
    const snapshot = createExpandedDashboardFixtureSnapshot(
      "expanded",
      FIXTURE_NOW,
    )
    snapshot.focus = {
      ...snapshot.focus,
      state: "running",
      activeTaskId: "expanded-task-1",
      activeTaskTitle: snapshot.tasks[0]?.title ?? null,
      startedAt: new Date(FIXTURE_NOW).toISOString(),
      endAt: new Date(FIXTURE_NOW + 60_000).toISOString(),
      totalMs: 60_000,
    }

    render(
      <ExpandedDashboard
        onToggleFocus={onToggleFocus}
        snapshot={snapshot}
      />,
    )

    const draggableElements = Array.from(
      document.querySelectorAll('[draggable="true"]'),
    )
    const rows = Array.from(
      document.querySelectorAll('[data-slot="compact-task-row"]'),
    )

    expect(draggableElements).toHaveLength(2)
    expect(rows.every((row) => !row.hasAttribute("draggable"))).toBe(true)
    expect(document.querySelectorAll('[data-slot="drag-dot"]')).toHaveLength(12)

    await userEvent.setup().click(
      screen.getByRole("button", {
        name: "Pause focus for Plan the next focused block",
      }),
    )

    expect(onToggleFocus).toHaveBeenCalledWith("expanded-task-1")
  })
})
