import { vi } from "vitest"

import {
  createBrowserDiagnostics,
  createEmptyAppSnapshot,
  createMockDesktopApi,
  createTauriDesktopApi,
  DesktopApiError,
  type AppSnapshot,
  type CreateTaskInput,
  type TauriTransport,
  type UpdateTaskInput,
} from "../desktopApi"

const createTaskInput: CreateTaskInput = {
  title: "Prepare release",
  notes: "",
  scheduledDate: "2026-08-30",
  estimateMinutes: 25,
}

const updateTaskInput: UpdateTaskInput = {
  id: "task-1",
  title: "Prepare release notes",
  notes: "Keep the notes concise.",
  scheduledDate: "2026-08-30",
  estimateMinutes: 30,
  isDone: false,
}

function createSnapshot(revision = 0): AppSnapshot {
  return {
    ...createEmptyAppSnapshot(),
    revision,
  }
}

describe("createTauriDesktopApi", () => {
  it("maps every public method to its Tauri command and payload", async () => {
    const snapshot = createSnapshot()
    const invoke = vi.fn(async () => snapshot as unknown)
    const transport: TauriTransport = {
      invoke,
      listen: vi.fn(async () => vi.fn()),
    }
    const api = createTauriDesktopApi(transport)
    const moveInput = {
      taskIds: ["task-1", "task-2"],
      source: { scheduledDate: "2026-08-30" },
      destination: { scheduledDate: null },
    }
    const settingsPatch = { focusMinutes: 30, playSound: false }
    const tasksIntent = { kind: "task", taskId: "task-1" } as const

    await api.getSnapshot()
    await api.addTask(createTaskInput)
    await api.updateTask(updateTaskInput)
    await api.deleteTask("task-1")
    await api.toggleTask("task-1")
    await api.moveTasks(moveInput)
    await api.startFocus("task-1")
    await api.pauseFocus()
    await api.resumeFocus()
    await api.stopFocus()
    await api.toggleFocus()
    await api.updateSettings(settingsPatch)
    await api.getAppDiagnostics()
    await api.setAutostart(true)
    await api.openTasksWindow(tasksIntent)
    await api.openSettingsWindow()
    await api.openExternalRelease("https://github.com/example/release")

    expect(invoke.mock.calls).toEqual([
      ["get_snapshot", undefined],
      ["add_task", { input: createTaskInput }],
      ["update_task", { input: updateTaskInput }],
      ["delete_task", { taskId: "task-1" }],
      ["toggle_task", { taskId: "task-1" }],
      ["move_tasks", { input: moveInput }],
      ["start_focus", { taskId: "task-1" }],
      ["pause_focus", undefined],
      ["resume_focus", undefined],
      ["stop_focus", undefined],
      ["toggle_focus", undefined],
      ["update_settings", { patch: settingsPatch }],
      ["get_app_diagnostics", undefined],
      ["set_autostart", { enabled: true }],
      ["open_tasks_window", { intent: tasksIntent }],
      ["open_settings_window", undefined],
      ["open_external_release", { url: "https://github.com/example/release" }],
    ])
  })

  it("forwards typed event payloads and returns the transport cleanup", async () => {
    const snapshot = createSnapshot(2)
    const unlisten = vi.fn()
    let emit: ((payload: unknown) => void) | undefined
    const listen = vi.fn(
      async (_eventName: string, listener: (payload: unknown) => void) => {
        emit = listener
        return unlisten
      },
    )
    const api = createTauriDesktopApi({
      invoke: vi.fn(async () => snapshot),
      listen,
    })
    const listener = vi.fn()

    const cleanup = await api.subscribe("store-changed", listener)
    emit?.(snapshot)
    cleanup()

    expect(listen).toHaveBeenCalledWith("store-changed", expect.any(Function))
    expect(listener).toHaveBeenCalledWith(snapshot)
    expect(unlisten).toHaveBeenCalledOnce()
  })

  it("normalizes commands that the Rust backend does not expose yet", async () => {
    const api = createTauriDesktopApi({
      invoke: vi.fn(async () => {
        throw new Error("unknown command get_snapshot")
      }),
      listen: vi.fn(async () => vi.fn()),
    })

    await expect(api.getSnapshot()).rejects.toMatchObject({
      name: "DesktopApiError",
      operation: "getSnapshot",
      code: "command-unavailable",
      message: "This desktop command is not available yet.",
    })
  })

  it("preserves structured backend error codes without leaking payloads", async () => {
    const api = createTauriDesktopApi({
      invoke: vi.fn(async () => {
        throw {
          code: "validation",
          message: "The title is required.",
          field: "title",
        }
      }),
      listen: vi.fn(async () => vi.fn()),
    })

    await expect(api.addTask(createTaskInput)).rejects.toMatchObject({
      operation: "addTask",
      code: "validation",
      message: "The title is required.",
      field: "title",
    })
  })
})

describe("createMockDesktopApi", () => {
  it("returns deterministic snapshots without sharing mutable data", async () => {
    const { api } = createMockDesktopApi()

    const firstSnapshot = await api.getSnapshot()
    firstSnapshot.tasks.push({
      id: "local-change",
      ...createTaskInput,
      isDone: false,
      createdAt: "2026-08-30T12:00:00Z",
      focusedSeconds: 0,
      sortOrder: 0,
    })

    const secondSnapshot = await api.getSnapshot()
    const mutationResult = await api.addTask(createTaskInput)

    expect(secondSnapshot).toEqual(createEmptyAppSnapshot())
    expect(mutationResult).toEqual(createEmptyAppSnapshot())
    expect(await api.getAppDiagnostics()).toEqual(createBrowserDiagnostics())
  })

  it("supports command overrides and normalized failures", async () => {
    const updatedSnapshot = createSnapshot(1)
    const addTask = vi.fn(async () => updatedSnapshot)
    const { api } = createMockDesktopApi({ handlers: { addTask } })

    await expect(api.addTask(createTaskInput)).resolves.toEqual(updatedSnapshot)
    expect(addTask).toHaveBeenCalledWith(createTaskInput)

    const failedApi = createMockDesktopApi({
      failures: { updateTask: "validation" },
    }).api

    await expect(failedApi.updateTask(updateTaskInput)).rejects.toEqual(
      new DesktopApiError({
        operation: "updateTask",
        code: "validation",
        message: "The mock updateTask operation failed.",
      }),
    )
  })

  it("emits cloned event payloads and unsubscribes idempotently", async () => {
    const controller = createMockDesktopApi()
    const listener = vi.fn()
    const snapshot = createSnapshot(3)
    const unlisten = await controller.api.subscribe("focus-changed", listener)

    controller.emit("focus-changed", snapshot)
    snapshot.revision = 99

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 3 }),
    )

    unlisten()
    unlisten()
    controller.emit("focus-changed", createSnapshot(4))

    expect(listener).toHaveBeenCalledOnce()
  })
})
