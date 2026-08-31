import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { vi } from "vitest"

import {
  createEmptyAppSnapshot,
  createMockDesktopApi,
  DesktopApiError,
  type AppSnapshot,
} from "../lib/desktopApi"
import { App, AppShell } from "./App"

function createPopulatedSnapshot(): AppSnapshot {
  return {
    ...createEmptyAppSnapshot(),
    revision: 4,
    tasks: [
      {
        id: "task-1",
        title: "Review the desktop contract",
        notes: "",
        scheduledDate: "2026-08-30",
        estimateMinutes: 25,
        isDone: false,
        createdAt: "2026-08-30T12:00:00Z",
        focusedSeconds: 0,
        sortOrder: 0,
      },
    ],
    sessions: [
      {
        id: "session-1",
        taskId: "task-1",
        startedAt: "2026-08-30T12:00:00Z",
        endedAt: "2026-08-30T12:25:00Z",
        focusedSeconds: 1500,
        completed: true,
      },
    ],
  }
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

    await act(async () => {
      resolveSnapshot?.(createEmptyAppSnapshot())
    })

    expect(
      await screen.findByRole("heading", {
        name: "Seu espaço de foco está pronto.",
      }),
    ).toBeInTheDocument()
  })

  it("renders the empty browser shell from a deterministic mock", async () => {
    const { api } = createMockDesktopApi()

    render(<App api={api} />)

    expect(
      await screen.findByText("Contrato desktop conectado"),
    ).toBeInTheDocument()
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-surface",
      "overlay",
    )
    expect(screen.getByText("0 tarefas")).toBeInTheDocument()
    expect(screen.getByText("Nenhuma tarefa ainda.")).toBeInTheDocument()
  })

  it("renders a supplied snapshot without coupling the shell to Tauri", () => {
    render(<AppShell snapshot={createPopulatedSnapshot()} />)

    expect(screen.getByText("1 tarefa")).toBeInTheDocument()
    expect(screen.getByText("1 sessão")).toBeInTheDocument()
    expect(screen.queryByText("Nenhuma tarefa ainda.")).not.toBeInTheDocument()
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
    expect(
      await screen.findByRole("heading", {
        name: "Seu espaço de foco está pronto.",
      }),
    ).toBeInTheDocument()
  })
})
