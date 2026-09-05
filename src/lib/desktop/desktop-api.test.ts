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
  type TasksWindowOrigin,
  type UpdateTaskInput,
  type WindowMonitorSnapshot,
  type WindowPlacementSnapshot,
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

const sampleWindowPlacement: WindowPlacementSnapshot = {
  revision: 2,
  windowLabel: "overlay",
  x: 120,
  y: 80,
  width: 800,
  height: 550,
  scaleFactor: 1,
  monitor: {
    name: "primary",
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    scaleFactor: 1,
  } satisfies WindowMonitorSnapshot,
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
    const settingsPatch = { focusMinutes: 30 }
    const tasksIntent = { kind: "task", taskId: "task-1" } as const
    const tasksOrigin: TasksWindowOrigin = { presentationMode: "expanded" }

    await api.getSnapshot()
    await api.getWindowPlacement()
    await api.saveWindowPlacement()
    await api.addTask(createTaskInput)
    await api.updateTask(updateTaskInput)
    await api.deleteTask("task-1")
    await api.toggleTask("task-1")
    await api.moveTasks(moveInput)
    await api.startFocus({ taskId: "task-1", durationSeconds: 90 })
    await api.pauseFocus()
    await api.resumeFocus()
    await api.stopFocus()
    await api.toggleFocus()
    await api.updateSettings(settingsPatch)
    await api.getAppDiagnostics()
    await api.setAutostart(true)
    await api.openTasksWindow(tasksIntent, tasksOrigin)
    await api.closeTasksWindow()
    await api.openSettingsWindow()
    await api.closeSettingsWindow()
    await api.returnToTasksWindow()
    await api.openExternalRelease("https://github.com/example/release")

    expect(invoke.mock.calls).toEqual([
      ["get_snapshot", undefined],
      ["get_window_placement", undefined],
      ["save_window_placement", undefined],
      ["add_task", { input: createTaskInput }],
      ["update_task", { input: updateTaskInput }],
      ["delete_task", { taskId: "task-1" }],
      ["toggle_task", { taskId: "task-1" }],
      ["move_tasks", { input: moveInput }],
      [
        "start_focus",
        { input: { taskId: "task-1", durationSeconds: 90 } },
      ],
      ["pause_focus", undefined],
      ["resume_focus", undefined],
      ["stop_focus", undefined],
      ["toggle_focus", undefined],
      ["update_settings", { patch: settingsPatch }],
      ["get_app_diagnostics", undefined],
      ["set_autostart", { enabled: true }],
      ["open_tasks_window", { intent: tasksIntent, origin: tasksOrigin }],
      ["close_tasks_window", undefined],
      ["open_settings_window", undefined],
      ["close_settings_window", undefined],
      ["return_to_tasks_window", undefined],
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

  it("normalizes serialized Rust unit results to undefined", async () => {
    const api = createTauriDesktopApi({
      invoke: vi.fn(async () => null),
      listen: vi.fn(async () => vi.fn()),
    })

    await expect(api.openSettingsWindow()).resolves.toBeUndefined()
    await expect(api.returnToTasksWindow()).resolves.toBeUndefined()
    await expect(api.closeTasksWindow()).resolves.toBeUndefined()
  })

  it("drops invalid native surface payloads before they reach listeners", async () => {
    let emit: ((payload: unknown) => void) | undefined
    const api = createTauriDesktopApi({
      invoke: vi.fn(async () => createSnapshot()),
      listen: vi.fn(async (_eventName, listener) => {
        emit = listener
        return vi.fn()
      }),
    })
    const listener = vi.fn()

    await api.subscribe("surface-changed", listener)
    emit?.({
      surface: "tasks",
      intent: { kind: "task", taskId: "" },
      presentationMode: null,
    })
    emit?.({
      surface: "tasks",
      intent: { kind: "list" },
      presentationMode: null,
    })

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith({
      surface: "tasks",
      intent: { kind: "list" },
      presentationMode: null,
    })
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
    expect(mutationResult).toMatchObject({
      revision: 1,
      tasks: [
        expect.objectContaining({
          title: createTaskInput.title,
          scheduledDate: createTaskInput.scheduledDate,
          estimateMinutes: createTaskInput.estimateMinutes,
        }),
      ],
    })
    expect(await api.getSnapshot()).toEqual(mutationResult)
    const diagnostics = await api.getAppDiagnostics()
    expect(diagnostics).toEqual(createBrowserDiagnostics())
    expect(diagnostics.tray.status).toBe("unavailable")
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

    const explicitFailure = new DesktopApiError({
      operation: "openSettingsWindow",
      code: "integration-unavailable",
      message: "Settings are unavailable.",
    })
    const explicitFailureApi = createMockDesktopApi({
      failures: { openSettingsWindow: explicitFailure },
    }).api
    await expect(explicitFailureApi.openSettingsWindow()).rejects.toBe(
      explicitFailure,
    )

    const subscribeFailureApi = createMockDesktopApi({
      failures: { subscribe: "integration-unavailable" },
    }).api
    await expect(
      subscribeFailureApi.subscribe("store-changed", vi.fn()),
    ).rejects.toMatchObject({ code: "integration-unavailable" })
  })

  it("persists and emits the shared extended window placement in the browser mock", async () => {
    const controller = createMockDesktopApi({
      windowPlacement: sampleWindowPlacement,
    })
    const placementChanged = vi.fn()
    await controller.api.subscribe("window-placement-changed", placementChanged)

    const loaded = await controller.api.getWindowPlacement()
    const saved = await controller.api.saveWindowPlacement()

    expect(loaded).toEqual(sampleWindowPlacement)
    expect(saved).toEqual({ ...sampleWindowPlacement, revision: 3 })
    expect(placementChanged).toHaveBeenCalledWith(saved)
    expect(await controller.api.getWindowPlacement()).toEqual(saved)
  })

  it("mutates task buckets, settings, and browser window routes", async () => {
    window.history.replaceState({}, "", "/")
    const controller = createMockDesktopApi()
    const { api } = controller

    const first = await api.addTask({
      title: " First task ",
      notes: "A note",
      scheduledDate: null,
      estimateMinutes: 10,
    })
    const firstId = first.tasks[0]?.id
    expect(firstId).toBeTruthy()

    const second = await api.addTask({
      title: "Second task",
      notes: "",
      scheduledDate: null,
      estimateMinutes: 20,
    })
    const secondId = second.tasks[1]?.id
    expect(secondId).toBeTruthy()

    await api.moveTasks({
      taskIds: [secondId!, firstId!],
      source: { scheduledDate: null },
      destination: { scheduledDate: null },
    })
    expect(controller.getSnapshot().tasks.map((task) => task.sortOrder)).toEqual([1, 0])

    await api.moveTasks({
      taskIds: [firstId!],
      source: { scheduledDate: null },
      destination: { scheduledDate: "2026-09-03" },
    })
    await api.updateTask({
      id: firstId!,
      title: "Updated task",
      notes: "Updated note",
      scheduledDate: "2026-09-04",
      estimateMinutes: 15,
      isDone: false,
    })
    await api.toggleTask(firstId!)
    await api.toggleTask(firstId!)
    await api.updateSettings({ focusMinutes: 45 })
    await expect(api.setAutostart(true)).rejects.toMatchObject({
      code: "integration-unavailable",
    })

    expect(controller.getSnapshot()).toMatchObject({
      settings: { focusMinutes: 45, launchAtLogin: false },
      tasks: expect.arrayContaining([
        expect.objectContaining({ id: firstId, title: "Updated task", isDone: false }),
      ]),
    })

    await api.openTasksWindow({ kind: "add" })
    expect(window.location.search).toContain("surface=tasks")
    expect(window.location.search).toContain("intent=add")
    await api.closeTasksWindow()
    expect(window.location.search).toContain("surface=overlay")
    await api.openSettingsWindow()
    expect(window.location.search).toContain("surface=settings")
    await api.closeSettingsWindow()
    expect(window.location.search).toContain("surface=overlay")

    await api.openTasksWindow(
      { kind: "list" },
      { presentationMode: "expanded" },
    )
    await api.openSettingsWindow()
    await api.returnToTasksWindow()
    expect(window.location.search).toContain("surface=tasks")
    await api.closeTasksWindow()
    expect(window.location.search).toContain("surface=overlay")
    expect(window.location.search).toContain("presentation=expanded")
    await api.deleteTask(secondId!)
    expect(controller.getSnapshot().tasks).toHaveLength(1)

    window.history.replaceState({}, "", "/")
  })

  it("uses system operation handlers in the browser mock", async () => {
    const diagnostics = createBrowserDiagnostics()
    const getSnapshot = vi.fn(async () => createSnapshot(7))
    const getAppDiagnostics = vi.fn(async () => diagnostics)
    const openTasksWindow = vi.fn(async () => undefined)
    const closeTasksWindow = vi.fn(async () => undefined)
    const openSettingsWindow = vi.fn(async () => undefined)
    const closeSettingsWindow = vi.fn(async () => undefined)
    const returnToTasksWindow = vi.fn(async () => undefined)
    const openExternalRelease = vi.fn(async () => undefined)
    const controller = createMockDesktopApi({
      handlers: {
        closeTasksWindow,
        closeSettingsWindow,
        getAppDiagnostics,
        getSnapshot,
        openExternalRelease,
        openSettingsWindow,
        openTasksWindow,
        returnToTasksWindow,
      },
    })

    await expect(controller.api.getSnapshot()).resolves.toEqual(createSnapshot(7))
    await expect(controller.api.getAppDiagnostics()).resolves.toEqual(diagnostics)
    await controller.api.openTasksWindow({ kind: "list" })
    await controller.api.closeTasksWindow()
    await controller.api.openSettingsWindow()
    await controller.api.closeSettingsWindow()
    await controller.api.returnToTasksWindow()
    await controller.api.openExternalRelease("https://example.com/release")

    expect(getSnapshot).toHaveBeenCalledOnce()
    expect(getAppDiagnostics).toHaveBeenCalledOnce()
    expect(openTasksWindow).toHaveBeenCalledWith({ kind: "list" }, undefined)
    expect(closeTasksWindow).toHaveBeenCalledOnce()
    expect(openSettingsWindow).toHaveBeenCalledOnce()
    expect(closeSettingsWindow).toHaveBeenCalledOnce()
    expect(returnToTasksWindow).toHaveBeenCalledOnce()
    expect(openExternalRelease).toHaveBeenCalledWith("https://example.com/release")
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
