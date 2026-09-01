import {
  createEmptyTaskDraft,
  normalizeTaskDuration,
  selectTasksForTasksSurface,
  sortTasksForTasksSurface,
  taskBucketForTab,
  toCreateTaskInput,
  validateTaskDraft,
} from "./tasks-model"
import type { Task } from "../../lib/desktopApi"

function task(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    title: "Task",
    notes: "",
    scheduledDate: "2026-09-01",
    estimateMinutes: 25,
    isDone: false,
    createdAt: "2026-09-01T10:00:00Z",
    focusedSeconds: 0,
    sortOrder: 0,
    ...overrides,
  }
}

describe("tasks model", () => {
  it("sorts pending tasks before completed tasks and keeps stable tie breakers", () => {
    const sorted = sortTasksForTasksSurface([
      task({ id: "done", isDone: true, sortOrder: 0 }),
      task({ id: "late", createdAt: "2026-09-01T11:00:00Z", sortOrder: 1 }),
      task({ id: "early", createdAt: "2026-09-01T09:00:00Z", sortOrder: 1 }),
    ])

    expect(sorted.map((item) => item.id)).toEqual(["early", "late", "done"])
  })

  it("selects the day and unscheduled buckets independently", () => {
    const tasks = [
      task({ id: "day", scheduledDate: "2026-09-01" }),
      task({ id: "other-day", scheduledDate: "2026-09-02" }),
      task({ id: "unscheduled", scheduledDate: null }),
    ]

    expect(
      selectTasksForTasksSurface(tasks, "day", "2026-09-01").map(
        (item) => item.id,
      ),
    ).toEqual(["day"])
    expect(
      selectTasksForTasksSurface(tasks, "unscheduled", "2026-09-01").map(
        (item) => item.id,
      ),
    ).toEqual(["unscheduled"])
  })

  it("validates draft text, date, and numeric shape", () => {
    const draft = {
      ...createEmptyTaskDraft(),
      title: "   ",
      notes: "x".repeat(501),
      scheduledDate: "2026-02-30",
      estimateMinutes: "25.5",
    }

    expect(validateTaskDraft(draft)).toEqual({
      title: "Title is required.",
      notes: "Notes must be 500 characters or fewer.",
      scheduledDate: "Enter a valid date.",
      estimateMinutes: "Enter a whole number of minutes.",
    })
  })

  it("clamps duration at the domain limits when creating an input", () => {
    expect(normalizeTaskDuration("0")).toBe(1)
    expect(normalizeTaskDuration("999")).toBe(180)
    expect(
      toCreateTaskInput({
        ...createEmptyTaskDraft(),
        title: "Clamped",
        estimateMinutes: "999",
      }),
    ).toMatchObject({
      title: "Clamped",
      scheduledDate: null,
      estimateMinutes: 180,
    })
  })

  it("maps the selected tab to its exact bucket", () => {
    expect(taskBucketForTab("day", "2026-09-01")).toEqual({
      scheduledDate: "2026-09-01",
    })
    expect(taskBucketForTab("unscheduled", "2026-09-01")).toEqual({
      scheduledDate: null,
    })
  })
})
