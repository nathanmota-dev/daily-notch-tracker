import { describe, expect, it, vi } from "vitest"

import {
  createEmptyAppSnapshot,
  createMockDesktopApi,
  type AppSnapshot,
  type Task,
} from "../desktopApi"

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Write docs",
    notes: "",
    scheduledDate: "2026-09-02",
    estimateMinutes: 25,
    isDone: false,
    createdAt: "2026-09-02T10:00:00.000Z",
    focusedSeconds: 0,
    sortOrder: 0,
    ...overrides,
  }
}

function createSnapshot(tasks: Task[] = []): AppSnapshot {
  return {
    ...createEmptyAppSnapshot(),
    revision: 10,
    tasks,
  }
}

describe("stateful browser desktop mock", () => {
  it("uses a custom duration for one session without changing the task estimate", async () => {
    const controller = createMockDesktopApi({
      snapshot: createSnapshot([createTask()]),
    })

    const started = await controller.api.startFocus({
      taskId: "task-1",
      durationSeconds: 90,
    })

    expect(started.focus).toMatchObject({
      activeTaskId: "task-1",
      state: "running",
      totalMs: 90_000,
    })
    expect(started.tasks[0]?.estimateMinutes).toBe(25)
    expect(started.revision).toBe(11)

    await controller.api.pauseFocus()
    expect(controller.getSnapshot().focus.state).toBe("paused")
    await controller.api.resumeFocus()
    expect(controller.getSnapshot().focus.state).toBe("running")
  })

  it("falls back to the task estimate and rejects invalid custom durations atomically", async () => {
    const initialSnapshot = createSnapshot([createTask()])
    const controller = createMockDesktopApi({ snapshot: initialSnapshot })

    const fallback = await controller.api.startFocus({
      taskId: "task-1",
      durationSeconds: null,
    })
    expect(fallback.focus.totalMs).toBe(25 * 60_000)

    await controller.api.stopFocus()
    const beforeInvalidStart = controller.getSnapshot()
    await expect(
      controller.api.startFocus({ taskId: "task-1", durationSeconds: 0 }),
    ).rejects.toMatchObject({
      code: "validation",
      field: "durationSeconds",
    })
    expect(controller.getSnapshot()).toEqual(beforeInvalidStart)
  })

  it("emits focus events for focus transitions and store events for task mutations", async () => {
    const controller = createMockDesktopApi({ snapshot: createSnapshot() })
    const focusChanged = vi.fn()
    const storeChanged = vi.fn()
    await controller.api.subscribe("focus-changed", focusChanged)
    await controller.api.subscribe("store-changed", storeChanged)

    await controller.api.startFocus({ taskId: null, durationSeconds: 1 })
    expect(focusChanged).toHaveBeenCalledOnce()
    expect(storeChanged).not.toHaveBeenCalled()

    await controller.api.addTask({
      title: "New task",
      notes: "",
      scheduledDate: null,
      estimateMinutes: 25,
    })
    expect(storeChanged).toHaveBeenCalledOnce()
  })

  it("records elapsed focus time and rejects invalid focus transitions", async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-09-02T12:00:00.000Z"))
      const controller = createMockDesktopApi({
        snapshot: createSnapshot([createTask()]),
      })

      await controller.api.startFocus({ taskId: "task-1", durationSeconds: 90 })
      vi.setSystemTime(new Date("2026-09-02T12:00:02.500Z"))
      const stopped = await controller.api.stopFocus()

      expect(stopped.focus.state).toBe("idle")
      expect(stopped.sessions).toEqual([
        expect.objectContaining({ focusedSeconds: 2, completed: false }),
      ])
      await expect(controller.api.stopFocus()).rejects.toMatchObject({
        code: "conflict",
      })
      await expect(controller.api.pauseFocus()).rejects.toMatchObject({
        code: "conflict",
      })
      await expect(controller.api.resumeFocus()).rejects.toMatchObject({
        code: "conflict",
      })

      const toggled = await controller.api.toggleFocus()
      expect(toggled.focus.activeTaskId).toBe("task-1")
      await controller.api.stopFocus()
    } finally {
      vi.useRealTimers()
    }
  })

  it("handles completed and missing tasks without mutating the snapshot", async () => {
    const completed = createTask({ id: "done-task", isDone: true })
    const controller = createMockDesktopApi({
      snapshot: createSnapshot([completed]),
    })
    const before = controller.getSnapshot()

    await expect(
      controller.api.startFocus({ taskId: "missing", durationSeconds: null }),
    ).rejects.toMatchObject({ code: "not-found" })
    await expect(
      controller.api.startFocus({ taskId: "done-task", durationSeconds: null }),
    ).rejects.toMatchObject({ code: "conflict" })
    expect(controller.getSnapshot()).toEqual(before)
  })
})
