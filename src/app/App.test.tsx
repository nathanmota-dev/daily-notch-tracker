import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { vi } from "vitest"

import {
  createCollapsedWidgetFixtureSnapshot,
  createEmptyAppSnapshot,
  createMockDesktopApi,
  DesktopApiError,
  type AppSnapshot,
} from "../lib/desktopApi"
import { App, AppShell } from "./App"

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

  it("returns to idle when Rust emits an idle snapshot under the pointer", async () => {
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

    act(() => {
      controller.emit("focus-changed", {
        ...createEmptyAppSnapshot(),
        revision: runningSnapshot.revision + 1,
      })
    })

    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="collapsed-focus-widget"]'),
      ).toHaveAttribute("hidden"),
    )
  })
})
