import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import {
  createExpandedDashboardFixtureSnapshot,
  type Task,
} from "../lib/desktopApi"
import { ExpandedDashboard } from "./expanded-dashboard"
import {
  formatTaskDuration,
  getLocalDateString,
  reorderTaskIds,
  selectTasksForDashboard,
  sortTasksForDashboard,
} from "./expanded-dashboard-model"
import {
  finishPointerTaskDrag,
  mockSortableRects,
  startPointerTaskDrag,
} from "../test/task-reorder-helpers"

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
      now={FIXTURE_NOW}
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
    expect(
      screen.getByText(fixture === "expanded-empty" ? "0d" : "3d"),
    ).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Focus timeline" })).toBeInTheDocument()
    expect(
      document.querySelectorAll('[data-slot="compact-task-row"]'),
    ).toHaveLength(taskCount)
  })

  it("derives the activity intensity from the fixture session history", () => {
    renderFixture("expanded")

    const todayKey = getLocalDateString(FIXTURE_NOW)
    const todayCell = document.querySelector(`[data-date="${todayKey}"]`)

    expect(todayCell).toHaveAttribute("data-intensity", "4")
    expect(document.querySelector('[data-slot="streak-count"]')).toHaveTextContent(
      "3d",
    )
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
    const grid = document.querySelector(
      '[data-slot="expanded-dashboard-grid"]',
    )

    expect(title).toHaveAttribute(
      "title",
      "Review and refine the complete DailyNotch Linux focus workflow before the next implementation milestone",
    )
    expect(activity).toBeInTheDocument()
    expect(grid).toHaveClass("grid", "grid-cols-[minmax(0,1fr)_var(--expanded-dashboard-activity-width)]")
  })

  it("updates the timeline from the local running clock", () => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXTURE_NOW)

    try {
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

      render(<ExpandedDashboard snapshot={snapshot} />)
      const tray = document.querySelector('[data-slot="progress-tray"]')

      expect(tray).toHaveAttribute("data-progress", "0")

      act(() => vi.advanceTimersByTime(1_000))

      expect(tray).toHaveAttribute("data-progress", "0.016666666666666666")
    } finally {
      vi.useRealTimers()
    }
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

describe("selectTasksForDashboard", () => {
  function createTask(
    id: string,
    scheduledDate: string | null,
    options: Pick<Task, "isDone" | "sortOrder">,
  ): Task {
    return {
      id,
      title: id,
      notes: "",
      scheduledDate,
      estimateMinutes: 25,
      createdAt: "2026-08-31T08:00:00.000Z",
      focusedSeconds: 0,
      ...options,
    }
  }

  it("selects only today's local bucket and keeps completed tasks last", () => {
    const now = Date.parse("2026-08-31T12:00:00.000Z")
    const today = getLocalDateString(now)
    const yesterday = getLocalDateString(now - 24 * 60 * 60 * 1000)
    const tomorrow = getLocalDateString(now + 24 * 60 * 60 * 1000)

    const tasks = [
      createTask("tomorrow", tomorrow, { isDone: false, sortOrder: 0 }),
      createTask("done-today", today, { isDone: true, sortOrder: 0 }),
      createTask("unscheduled", null, { isDone: false, sortOrder: 0 }),
      createTask("yesterday", yesterday, { isDone: false, sortOrder: 0 }),
      createTask("pending-today", today, { isDone: false, sortOrder: 1 }),
    ]

    expect(selectTasksForDashboard(tasks, now).map((task) => task.id)).toEqual([
      "pending-today",
      "done-today",
    ])
  })

  it("returns an empty list when no task is scheduled for today", () => {
    const now = Date.parse("2026-08-31T12:00:00.000Z")
    const tasks = [
      createTask("unscheduled", null, { isDone: false, sortOrder: 0 }),
      createTask("tomorrow", getLocalDateString(now + 86_400_000), {
        isDone: false,
        sortOrder: 1,
      }),
    ]

    expect(selectTasksForDashboard(tasks, now)).toEqual([])
    expect(selectTasksForDashboard([], now)).toEqual([])
  })
})

describe("reorderTaskIds", () => {
  it("moves a dragged task to the drop target position without mutating the input", () => {
    const taskIds = ["first", "second", "third"]

    expect(reorderTaskIds(taskIds, "first", "third")).toEqual([
      "second",
      "third",
      "first",
    ])
    expect(taskIds).toEqual(["first", "second", "third"])
  })
})

describe("ExpandedDashboard callbacks", () => {
  it("notifies task, focus, add, open, detail, and reorder actions", async () => {
    const user = userEvent.setup()
    const onToggleTask = vi.fn()
    const onToggleFocus = vi.fn()
    const onAddTask = vi.fn()
    const onOpenTasks = vi.fn()
    const onOpenTask = vi.fn()
    const onReorder = vi.fn()

    render(
      <ExpandedDashboard
        onAddTask={onAddTask}
        onOpenTask={onOpenTask}
        onOpenTasks={onOpenTasks}
        onReorder={onReorder}
        onToggleFocus={onToggleFocus}
        onToggleTask={onToggleTask}
        now={FIXTURE_NOW}
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
    await user.click(
      screen.getByRole("button", {
        name: "Open details for Plan the next focused block",
      }),
    )
    mockSortableRects('[data-slot="compact-task-row"]')
    startPointerTaskDrag(
      screen.getByRole("button", {
        name: "Reorder Plan the next focused block",
      }),
    )
    await finishPointerTaskDrag(100)

    expect(onToggleTask).toHaveBeenCalledWith("expanded-task-1", true)
    expect(onToggleFocus).toHaveBeenCalledWith("expanded-task-1")
    expect(onAddTask).toHaveBeenCalledOnce()
    expect(onOpenTasks).toHaveBeenCalledOnce()
    expect(onOpenTask).toHaveBeenCalledWith("expanded-task-1")
    expect(onReorder).toHaveBeenCalledWith([
      "expanded-task-2",
      "expanded-task-1",
    ])
  })

  it("makes task cards sortable and keeps the task controls interactive", async () => {
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
        now={FIXTURE_NOW}
        snapshot={snapshot}
      />,
    )

    const dragHandles = Array.from(
      document.querySelectorAll('[data-slot="drag-handle"]'),
    )
    const rows = Array.from(
      document.querySelectorAll('[data-slot="compact-task-row"]'),
    )

    expect(dragHandles).toHaveLength(2)
    expect(rows.every((row) => row.getAttribute("role") === "button")).toBe(true)
    expect(
      rows.every((row) => row.getAttribute("aria-roledescription") === "sortable"),
    ).toBe(true)
    expect(rows.every((row) => !row.hasAttribute("draggable"))).toBe(true)
    expect(document.querySelectorAll('[data-slot="drag-dot"]')).toHaveLength(12)

    await userEvent.setup().click(
      screen.getByRole("button", {
        name: "Pause focus for Plan the next focused block",
      }),
    )

    expect(onToggleFocus).toHaveBeenCalledWith("expanded-task-1")
  })

  it("opens task details from the body with Enter and Space", async () => {
    const user = userEvent.setup()
    const onOpenTask = vi.fn()

    render(
      <ExpandedDashboard
        onOpenTask={onOpenTask}
        now={FIXTURE_NOW}
        snapshot={createExpandedDashboardFixtureSnapshot(
          "expanded",
          FIXTURE_NOW,
        )}
      />,
    )

    const body = screen.getByRole("button", {
      name: "Open details for Plan the next focused block",
    })

    await user.click(body)
    body.focus()
    await user.keyboard("{Enter}")
    await user.keyboard(" ")

    expect(onOpenTask).toHaveBeenCalledTimes(3)
    expect(onOpenTask).toHaveBeenCalledWith("expanded-task-1")
  })

  it("opens the add intent from the empty state", async () => {
    const onAddTask = vi.fn()

    render(
      <ExpandedDashboard
        onAddTask={onAddTask}
        now={FIXTURE_NOW}
        snapshot={createExpandedDashboardFixtureSnapshot(
          "expanded-empty",
          FIXTURE_NOW,
        )}
      />,
    )

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Add your first task" }),
    )

    expect(onAddTask).toHaveBeenCalledOnce()
  })

  it("blocks focus for completed tasks", async () => {
    const onToggleFocus = vi.fn()

    render(
      <ExpandedDashboard
        onToggleFocus={onToggleFocus}
        now={FIXTURE_NOW}
        snapshot={createExpandedDashboardFixtureSnapshot(
          "expanded-completed",
          FIXTURE_NOW,
        )}
      />,
    )

    const focusButton = screen.getByRole("button", {
      name: "Start focus for Ship the completed dashboard draft",
    })

    expect(focusButton).toBeDisabled()
    await userEvent.setup().click(focusButton)
    expect(onToggleFocus).not.toHaveBeenCalled()
  })

  it("disables dashboard actions while a command is busy", async () => {
    const onAddTask = vi.fn()
    const onOpenTasks = vi.fn()
    const onOpenTask = vi.fn()
    const onToggleFocus = vi.fn()
    const onToggleTask = vi.fn()
    const onReorder = vi.fn()

    render(
      <ExpandedDashboard
        busy
        onAddTask={onAddTask}
        onOpenTask={onOpenTask}
        onOpenTasks={onOpenTasks}
        onReorder={onReorder}
        onToggleFocus={onToggleFocus}
        onToggleTask={onToggleTask}
        now={FIXTURE_NOW}
        snapshot={createExpandedDashboardFixtureSnapshot(
          "expanded",
          FIXTURE_NOW,
        )}
      />,
    )

    expect(screen.getByRole("button", { name: "Open Tasks" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add a task" })).toBeDisabled()
    expect(
      screen.getByRole("checkbox", {
        name: "Mark Plan the next focused block as complete",
      }),
    ).toHaveAttribute("data-disabled", "")
    expect(
      screen.getByRole("button", {
        name: "Start focus for Plan the next focused block",
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: "Reorder Plan the next focused block",
      }),
    ).toHaveAttribute("aria-disabled", "true")

    const body = screen.getByRole("button", {
      name: "Open details for Plan the next focused block",
    })
    expect(body).toHaveAttribute("aria-disabled", "true")

    await userEvent.setup().click(body)
    expect(onOpenTask).not.toHaveBeenCalled()
    expect(onAddTask).not.toHaveBeenCalled()
    expect(onOpenTasks).not.toHaveBeenCalled()
    expect(onToggleFocus).not.toHaveBeenCalled()
    expect(onToggleTask).not.toHaveBeenCalled()
    expect(onReorder).not.toHaveBeenCalled()
  })
})
