import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { vi } from "vitest"

import {
  createCollapsedWidgetFixtureSnapshot,
  createExpandedDashboardFixtureSnapshot,
  createEmptyAppSnapshot,
  createMockDesktopApi,
  DesktopApiError,
  type AppSnapshot,
} from "../lib/desktopApi"
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
          Date.parse("2026-08-31T12:00:00.000Z"),
        ),
      )
    })

    expect(
      await screen.findByText("Plan the next focused block"),
    ).toBeInTheDocument()
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
      Date.parse("2026-08-31T12:00:00.000Z"),
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
})
