import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import {
  createCollapsedWidgetFixtureSnapshot,
  createExpandedDashboardFixtureSnapshot,
  createEmptyAppSnapshot,
  createMockDesktopApi,
  DesktopApiError,
  type AppSnapshot,
  type TasksWindowIntent,
} from "../lib/desktopApi"
import { getLocalDateString } from "../lib/local-date"
import {
  type OverlayWindowAdapter,
} from "../lib/desktop/overlay-window"
import { OVERLAY_COLLAPSE_DELAY_MS } from "./use-overlay-interaction"
import { App, AppShell } from "./App"

function createOverlayAdapter() {
  return {
    innerSize: vi.fn(async () => ({ width: 360, height: 72 })),
    innerPosition: vi.fn(async () => ({ x: 0, y: 0 })),
    scaleFactor: vi.fn(async () => 1),
    primaryMonitor: vi.fn(async () => null),
    setSize: vi.fn(async () => undefined),
    setPosition: vi.fn(async () => undefined),
    show: vi.fn(async () => undefined),
    hide: vi.fn(async () => undefined),
    subscribeToDisplayChanges: vi.fn(async () => vi.fn()),
  } satisfies OverlayWindowAdapter
}

describe("App", () => {
  it("renders loading before the desktop snapshot resolves", async () => {
    let resolveSnapshot: ((snapshot: AppSnapshot) => void) | undefined
    const getSnapshot = vi.fn(
      () =>
        new Promise<AppSnapshot>((resolve) => {
          resolveSnapshot = resolve
        }),
    )
    const api = createMockDesktopApi({ handlers: { getSnapshot } }).api

    render(<App api={api} />)

    expect(screen.getByRole("status")).toHaveTextContent(
      "Carregando o DailyNotch",
    )

    await waitFor(() => expect(getSnapshot).toHaveBeenCalledOnce())

    await act(async () => {
      resolveSnapshot?.(createEmptyAppSnapshot())
    })

    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="collapsed-focus-widget"]'),
      ).toHaveAttribute("data-state", "idle"),
    )
  })

  it("renders the empty browser overlay as an idle widget", async () => {
    const { api } = createMockDesktopApi()

    render(<App api={api} />)

    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="collapsed-focus-widget"]'),
      ).toBeInTheDocument(),
    )

    expect(screen.getByRole("main")).toHaveAttribute("data-surface", "overlay")
    expect(screen.getByRole("main")).toHaveClass("collapsed-focus-surface")
    expect(
      document.querySelector('[data-slot="collapsed-focus-widget"]'),
    ).toHaveAttribute("data-state", "idle")
    expect(screen.queryByText("Contrato desktop conectado")).not.toBeInTheDocument()
  })

  it("uses an opaque canvas for normal window surfaces", async () => {
    render(<App api={createMockDesktopApi().api} surface="tasks" />)

    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeInTheDocument()
    expect(screen.getByRole("main")).toHaveClass("bg-canvas")
  })

  it("renders a supplied focus snapshot without coupling the shell to Tauri", () => {
    render(
      <AppShell
        snapshot={createCollapsedWidgetFixtureSnapshot(
          "running",
          Date.now(),
        )}
      />,
    )

    expect(screen.getByRole("timer")).toHaveTextContent("14:32")
    expect(screen.getByText("Plan the next focused block")).toBeInTheDocument()
  })

  it("renders the expanded dashboard only when its presentation mode is selected", () => {
    render(
      <AppShell
        presentationMode="expanded"
        snapshot={createEmptyAppSnapshot()}
      />,
    )

    expect(screen.getByRole("main")).toHaveAttribute(
      "data-presentation-mode",
      "expanded",
    )
    expect(screen.getByRole("main")).toHaveClass(
      "expanded-dashboard-surface",
    )
    expect(screen.getByRole("main")).toHaveAttribute("data-resizing", "false")
    expect(
      screen.getByRole("region", { name: "Expanded dashboard" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toBeInTheDocument()
  })

  it("expands on pointer enter and collapses after the hover delay", () => {
    vi.useFakeTimers()

    try {
      render(
        <AppShell
          snapshot={createCollapsedWidgetFixtureSnapshot("running", Date.now())}
        />,
      )
      const surface = screen.getByRole("main")

      fireEvent.pointerEnter(surface)
      expect(surface).toHaveAttribute("data-presentation-mode", "expanded")

      fireEvent.pointerLeave(surface)
      act(() => vi.advanceTimersByTime(OVERLAY_COLLAPSE_DELAY_MS - 1))
      expect(surface).toHaveAttribute("data-presentation-mode", "expanded")

      act(() => vi.advanceTimersByTime(1))
      expect(surface).toHaveAttribute("data-presentation-mode", "collapsed")
    } finally {
      vi.useRealTimers()
    }
  })

  it("hides an idle overlay even when its initial presentation is expanded", () => {
    const adapter = createOverlayAdapter()

    render(
      <AppShell
        overlayWindowAdapter={adapter}
        presentationMode="expanded"
        snapshot={createEmptyAppSnapshot()}
      />,
    )

    expect(screen.getByRole("main")).toHaveAttribute(
      "data-presentation-mode",
      "expanded",
    )
    expect(adapter.hide).toHaveBeenCalledOnce()
    expect(adapter.show).not.toHaveBeenCalled()
  })

  it("shows a safe error and retries the snapshot request", async () => {
    const getSnapshot = vi
      .fn<() => Promise<AppSnapshot>>()
      .mockRejectedValueOnce(
        new DesktopApiError({
          operation: "getSnapshot",
          code: "command-unavailable",
          message: "This desktop command is not available yet.",
        }),
      )
      .mockResolvedValueOnce(createEmptyAppSnapshot())
    const api = createMockDesktopApi({ handlers: { getSnapshot } }).api

    render(<App api={api} />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "command-unavailable",
    )

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))

    await waitFor(() => expect(getSnapshot).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="collapsed-focus-widget"]'),
      ).toHaveAttribute("data-state", "idle"),
    )
  })

  it("still loads the snapshot when an event subscription is unavailable", async () => {
    const { api } = createMockDesktopApi({
      failures: { subscribe: "integration-unavailable" },
    })

    render(<App api={api} />)

    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="collapsed-focus-widget"]'),
      ).toHaveAttribute("data-state", "idle"),
    )
  })

  it("keeps the hover presentation while Rust updates the snapshot", async () => {
    const runningSnapshot = createCollapsedWidgetFixtureSnapshot(
      "running",
      Date.now(),
    )
    const controller = createMockDesktopApi({
      snapshot: runningSnapshot,
    })

    render(<App api={controller.api} />)

    const widget = await screen.findByRole("group", {
      name: "Foco em andamento",
    })
    fireEvent.pointerEnter(widget)

    expect(screen.getByRole("main")).toHaveAttribute(
      "data-presentation-mode",
      "expanded",
    )

    act(() => {
      controller.emit("focus-changed", {
        ...createEmptyAppSnapshot(),
        revision: runningSnapshot.revision + 1,
      })
    })

    expect(
      await screen.findByRole("region", { name: "Expanded dashboard" }),
    ).toBeInTheDocument()
  })

  it("accepts store changes emitted by Rust", async () => {
    const controller = createMockDesktopApi()
    const now = Date.now()

    render(
      <App
        api={controller.api}
        presentationMode="expanded"
      />,
    )

    await screen.findByRole("region", { name: "Expanded dashboard" })

    act(() => {
      controller.emit(
        "store-changed",
        createExpandedDashboardFixtureSnapshot(
          "expanded-one",
          now,
        ),
      )
    })

    expect(
      await screen.findByText("Plan the next focused block"),
    ).toBeInTheDocument()
    expect(screen.getByText("3d")).toBeInTheDocument()
    expect(
      document.querySelector(`[data-date="${getLocalDateString(now)}"]`),
    ).toHaveAttribute("data-intensity", "4")
  })

  it("keeps a newer event when the initial snapshot resolves late", async () => {
    let resolveSnapshot: ((snapshot: AppSnapshot) => void) | undefined
    const getSnapshot = vi.fn(
      () =>
        new Promise<AppSnapshot>((resolve) => {
          resolveSnapshot = resolve
        }),
    )
    const controller = createMockDesktopApi({ handlers: { getSnapshot } })

    render(<App api={controller.api} presentationMode="expanded" />)
    await waitFor(() => expect(getSnapshot).toHaveBeenCalledOnce())

    const newerSnapshot = createExpandedDashboardFixtureSnapshot(
      "expanded-one",
      Date.now(),
    )
    newerSnapshot.revision = 5
    act(() => controller.emit("store-changed", newerSnapshot))

    expect(
      await screen.findByText("Plan the next focused block"),
    ).toBeInTheDocument()

    await act(async () => {
      resolveSnapshot?.({ ...createEmptyAppSnapshot(), revision: 1 })
    })

    expect(screen.getByText("Plan the next focused block")).toBeInTheDocument()
  })

  it.each(["tasks", "settings"] as const)(
    "connects the %s surface to snapshot events",
    async (surface) => {
      const controller = createMockDesktopApi()
      render(<App api={controller.api} surface={surface} />)

      await screen.findByRole("heading", {
        name: surface === "tasks" ? "Tasks" : "Settings",
      })

      const updatedSnapshot = createEmptyAppSnapshot()
      updatedSnapshot.revision = 1
      updatedSnapshot.tasks = [
        {
          id: "task-1",
          title: "Shared task",
          notes: "",
          scheduledDate: null,
          estimateMinutes: 25,
          isDone: false,
          createdAt: "2026-08-31T12:00:00Z",
          focusedSeconds: 0,
          sortOrder: 0,
        },
      ]

      act(() => controller.emit("shortcut-changed", updatedSnapshot))

      expect(await screen.findByText("1 tarefa")).toBeInTheDocument()
    },
  )

  it("applies the snapshot returned by a real task mutation", async () => {
    const now = Date.now()
    const initialSnapshot = createExpandedDashboardFixtureSnapshot(
      "expanded",
      now,
    )
    const updatedSnapshot = {
      ...initialSnapshot,
      revision: initialSnapshot.revision + 1,
      tasks: initialSnapshot.tasks.map((task, index) =>
        index === 0 ? { ...task, isDone: true } : task,
      ),
    }
    const toggleTask = vi.fn(async () => updatedSnapshot)
    const controller = createMockDesktopApi({
      handlers: { toggleTask },
      snapshot: initialSnapshot,
    })

    render(
      <App
        api={controller.api}
        presentationMode="expanded"
      />,
    )

    await screen.findByRole("region", { name: "Expanded dashboard" })
    await userEvent.setup().click(
      screen.getByRole("checkbox", {
        name: "Mark Plan the next focused block as complete",
      }),
    )

    await waitFor(() =>
      expect(toggleTask).toHaveBeenCalledWith("expanded-task-1"),
    )
    await waitFor(() =>
      expect(
        document.querySelector('[data-task-id="expanded-task-1"]'),
      ).toHaveAttribute("data-completed", "true"),
    )
  })

  it("maps the active focus state to pause, resume, and start commands", async () => {
    const now = Date.now()
    const initialSnapshot = createExpandedDashboardFixtureSnapshot(
      "expanded",
      now,
    )
    const runningFocus = {
      ...initialSnapshot.focus,
      state: "running" as const,
      activeTaskId: "expanded-task-1",
      activeTaskTitle: initialSnapshot.tasks[0]?.title ?? null,
      startedAt: new Date(now).toISOString(),
      endAt: new Date(now + 60_000).toISOString(),
      totalMs: 60_000,
    }
    const runningSnapshot = {
      ...initialSnapshot,
      focus: runningFocus,
    }
    const pausedSnapshot = {
      ...runningSnapshot,
      revision: 2,
      focus: {
        ...runningFocus,
        state: "paused" as const,
        endAt: null,
        pausedRemainingMs: 30_000,
      },
    }
    const resumedSnapshot = {
      ...pausedSnapshot,
      revision: 3,
      focus: runningFocus,
    }
    const startedSnapshot = {
      ...resumedSnapshot,
      revision: 4,
      focus: {
        ...runningFocus,
        activeTaskId: "expanded-task-2",
        activeTaskTitle: initialSnapshot.tasks[1]?.title ?? null,
      },
    }
    const pauseFocus = vi.fn(async () => pausedSnapshot)
    const resumeFocus = vi.fn(async () => resumedSnapshot)
    const startFocus = vi.fn(async () => startedSnapshot)
    const controller = createMockDesktopApi({
      handlers: { pauseFocus, resumeFocus, startFocus },
      snapshot: runningSnapshot,
    })

    render(
      <App
        api={controller.api}
        presentationMode="expanded"
      />,
    )

    await screen.findByRole("region", { name: "Expanded dashboard" })
    const user = userEvent.setup()

    await user.click(
      screen.getByRole("button", {
        name: "Pause focus for Plan the next focused block",
      }),
    )
    await waitFor(() => expect(pauseFocus).toHaveBeenCalledOnce())

    await user.click(
      await screen.findByRole("button", {
        name: "Resume focus for Plan the next focused block",
      }),
    )
    await waitFor(() => expect(resumeFocus).toHaveBeenCalledOnce())

    await user.click(
      screen.getByRole("button", {
        name: "Start focus for Review the desktop contract",
      }),
    )
    await waitFor(() => expect(startFocus).toHaveBeenCalledWith("expanded-task-2"))
  })

  it("lets Rust focus events drive running, paused, and idle presentation", async () => {
    const now = Date.now()
    const runningSnapshot = createCollapsedWidgetFixtureSnapshot("running", now)
    const pausedSnapshot = {
      ...runningSnapshot,
      revision: runningSnapshot.revision + 1,
      focus: {
        ...runningSnapshot.focus,
        state: "paused" as const,
        endAt: null,
        pausedRemainingMs: 30_000,
      },
    }
    const completedSnapshot = {
      ...pausedSnapshot,
      revision: pausedSnapshot.revision + 1,
      focus: createEmptyAppSnapshot().focus,
      sessions: [
        {
          id: "session-1",
          taskId: runningSnapshot.focus.activeTaskId,
          startedAt: new Date(now - 60_000).toISOString(),
          endedAt: new Date(now).toISOString(),
          focusedSeconds: 60,
          completed: true,
        },
      ],
    }
    const controller = createMockDesktopApi({ snapshot: runningSnapshot })

    render(<App api={controller.api} />)
    await screen.findByRole("group", { name: "Foco em andamento" })

    act(() => controller.emit("focus-changed", pausedSnapshot))
    expect(
      await screen.findByRole("group", { name: "Foco pausado" }),
    ).toHaveAttribute("data-state", "paused")

    act(() => controller.emit("focus-changed", completedSnapshot))
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="collapsed-focus-widget"]'),
      ).toHaveAttribute("data-state", "idle"),
    )
  })

  it("propagates dashboard busy state and keeps rapid commands single-flight", async () => {
    const initialSnapshot = createExpandedDashboardFixtureSnapshot(
      "expanded",
      Date.now(),
    )
    const updatedSnapshot = {
      ...initialSnapshot,
      revision: initialSnapshot.revision + 1,
      tasks: initialSnapshot.tasks.map((task, index) =>
        index === 0 ? { ...task, isDone: true } : task,
      ),
    }
    let resolveToggle: ((snapshot: AppSnapshot) => void) | undefined
    const toggleTask = vi.fn(
      () =>
        new Promise<AppSnapshot>((resolve) => {
          resolveToggle = resolve
        }),
    )
    const controller = createMockDesktopApi({
      handlers: { toggleTask },
      snapshot: initialSnapshot,
    })

    render(
      <App
        api={controller.api}
        presentationMode="expanded"
      />,
    )

    await screen.findByRole("region", { name: "Expanded dashboard" })
    const checkbox = screen.getByRole("checkbox", {
      name: "Mark Plan the next focused block as complete",
    })
    fireEvent.click(checkbox)
    fireEvent.click(checkbox)

    await waitFor(() => expect(toggleTask).toHaveBeenCalledOnce())
    expect(checkbox).toHaveAttribute("data-disabled", "")
    expect(screen.getByRole("button", { name: "Open Tasks" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add a task" })).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: "Start focus for Plan the next focused block",
      }),
    ).toBeDisabled()

    await act(async () => {
      resolveToggle?.(updatedSnapshot)
    })

    await waitFor(() =>
      expect(
        document.querySelector('[data-task-id="expanded-task-1"]'),
      ).toHaveAttribute("data-completed", "true"),
    )
  })

  it("sends list, add, and task intents to the Tasks window", async () => {
    const snapshot = createExpandedDashboardFixtureSnapshot("expanded", Date.now())
    const openTasksWindow = vi.fn(async (intent?: TasksWindowIntent) => {
      void intent
    })
    const controller = createMockDesktopApi({
      handlers: { openTasksWindow },
      snapshot,
    })

    render(
      <App
        api={controller.api}
        presentationMode="expanded"
      />,
    )

    await screen.findByRole("region", { name: "Expanded dashboard" })
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Open Tasks" }))
    await user.click(screen.getByRole("button", { name: "Add a task" }))
    await user.click(
      screen.getByRole("button", {
        name: "Open details for Plan the next focused block",
      }),
    )

    await waitFor(() => expect(openTasksWindow).toHaveBeenCalledTimes(3))
    expect(openTasksWindow.mock.calls.map(([intent]) => intent)).toEqual([
      { kind: "list" },
      { kind: "add" },
      { kind: "task", taskId: "expanded-task-1" },
    ])
  })

  it("opens the add intent when the dashboard has no tasks", async () => {
    const snapshot = createExpandedDashboardFixtureSnapshot(
      "expanded-empty",
      Date.now(),
    )
    const openTasksWindow = vi.fn(async (intent?: TasksWindowIntent) => {
      void intent
    })
    const controller = createMockDesktopApi({
      handlers: { openTasksWindow },
      snapshot,
    })

    render(
      <App
        api={controller.api}
        presentationMode="expanded"
      />,
    )

    await screen.findByRole("region", { name: "Expanded dashboard" })
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Add your first task" }),
    )

    await waitFor(() =>
      expect(openTasksWindow).toHaveBeenCalledWith({ kind: "add" }),
    )
  })

  it("sends the complete current-day permutation and renders Rust's order", async () => {
    const now = Date.now()
    const initialSnapshot = createExpandedDashboardFixtureSnapshot(
      "expanded",
      now,
    )
    const updatedSnapshot = {
      ...initialSnapshot,
      revision: initialSnapshot.revision + 1,
      tasks: initialSnapshot.tasks.map((task, index) => ({
        ...task,
        sortOrder: index === 0 ? 1 : 0,
      })),
    }
    const moveTasks = vi.fn(async () => updatedSnapshot)
    const controller = createMockDesktopApi({
      handlers: { moveTasks },
      snapshot: initialSnapshot,
    })

    render(
      <App
        api={controller.api}
        presentationMode="expanded"
      />,
    )

    await screen.findByRole("region", { name: "Expanded dashboard" })
    const rows = document.querySelectorAll('[data-slot="compact-task-row"]')
    const dataTransfer = {
      effectAllowed: "none",
      dropEffect: "none",
      getData: vi.fn(() => "expanded-task-1"),
      setData: vi.fn(),
    }

    fireEvent.dragStart(
      screen.getByRole("button", {
        name: "Reorder Plan the next focused block",
      }),
      { dataTransfer },
    )
    fireEvent.dragOver(rows[1], { dataTransfer })
    fireEvent.drop(rows[1], { dataTransfer })

    expect(
      Array.from(
        document.querySelectorAll('[data-slot="compact-task-row"]'),
      ).map((row) => row.getAttribute("data-task-id")),
    ).toEqual(["expanded-task-1", "expanded-task-2"])
    await waitFor(() => expect(moveTasks).toHaveBeenCalledOnce())
    expect(moveTasks).toHaveBeenCalledWith({
      taskIds: ["expanded-task-2", "expanded-task-1"],
      source: { scheduledDate: getLocalDateString(now) },
      destination: { scheduledDate: getLocalDateString(now) },
    })
    await waitFor(() =>
      expect(
        Array.from(
          document.querySelectorAll('[data-slot="compact-task-row"]'),
        ).map((row) => row.getAttribute("data-task-id")),
      ).toEqual(["expanded-task-2", "expanded-task-1"]),
    )
  })

  it("reconciles a failed mutation without replacing the current snapshot", async () => {
    const now = Date.now()
    const initialSnapshot = createExpandedDashboardFixtureSnapshot(
      "expanded",
      now,
    )
    const reconciledSnapshot = {
      ...initialSnapshot,
      revision: initialSnapshot.revision + 1,
    }
    const getSnapshot = vi
      .fn<() => Promise<AppSnapshot>>()
      .mockResolvedValueOnce(initialSnapshot)
      .mockResolvedValueOnce(reconciledSnapshot)
    const toggleTask = vi.fn(async () => {
      throw new DesktopApiError({
        operation: "toggleTask",
        code: "conflict",
        message: "The private task title and note are not relevant here.",
      })
    })
    const controller = createMockDesktopApi({
      handlers: { getSnapshot, toggleTask },
      snapshot: initialSnapshot,
    })

    render(
      <App
        api={controller.api}
        presentationMode="expanded"
      />,
    )

    await screen.findByRole("region", { name: "Expanded dashboard" })
    await userEvent.setup().click(
      screen.getByRole("checkbox", {
        name: "Mark Plan the next focused block as complete",
      }),
    )

    const alert = await screen.findByRole("alert")
    await waitFor(() => expect(getSnapshot).toHaveBeenCalledTimes(2))
    expect(alert).toHaveTextContent("conflict")
    expect(alert).not.toHaveTextContent("private task title")
    expect(alert).not.toHaveTextContent("note")
    expect(
      document.querySelector('[data-task-id="expanded-task-1"]'),
    ).toBeInTheDocument()
  })
})
