import { render, screen, waitFor } from "@testing-library/react"

import {
  createEmptyAppSnapshot,
  createMockDesktopApi,
} from "../lib/desktopApi"
import {
  resolveSurfaceLabel,
} from "./surfaceResolver"
import { SurfaceRouter } from "./surfaceRouter"

const surfaceLabels = ["overlay", "tasks", "settings"] as const

describe("resolveSurfaceLabel", () => {
  it.each(surfaceLabels)("accepts the %s Tauri label", (label) => {
    expect(
      resolveSurfaceLabel({ runtime: "tauri", windowLabel: label }),
    ).toBe(label)
  })

  it("reads a valid browser query string", () => {
    expect(
      resolveSurfaceLabel({
        runtime: "browser",
        search: "?surface=settings&debug=true",
      }),
    ).toBe("settings")
  })

  it.each([
    { runtime: "browser" as const, search: "", expected: "overlay" },
    {
      runtime: "browser" as const,
      search: "?surface=unknown",
      expected: "overlay",
    },
    {
      runtime: "tauri" as const,
      windowLabel: "main",
      expected: "overlay",
    },
  ])("falls back to overlay for an invalid source", (context) => {
    expect(resolveSurfaceLabel(context)).toBe(context.expected)
  })
})

describe("SurfaceRouter", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/")
  })

  afterEach(() => {
    window.history.replaceState({}, "", "/")
  })

  it.each(surfaceLabels)("renders the %s surface", async (surface) => {
    const api = createMockDesktopApi({
      snapshot: createEmptyAppSnapshot(),
    }).api

    render(<SurfaceRouter api={api} surface={surface} />)

    expect(await screen.findByRole("main")).toHaveAttribute(
      "data-surface",
      surface,
    )

    if (surface === "overlay") {
      await waitFor(() =>
        expect(
          document.querySelector('[data-slot="collapsed-focus-widget"]'),
        ).toHaveAttribute("data-state", "idle"),
      )
    } else {
      const headingName = surface === "tasks" ? "Tasks" : "Settings"

      expect(
        await screen.findByRole("heading", { name: headingName }),
      ).toBeInTheDocument()
      if (surface === "tasks") {
        expect(document.querySelector('[data-slot="tasks-day-title"]')).toHaveTextContent(
          "0 tasks",
        )
      } else {
        expect(screen.getByRole("heading", { name: "Timer" })).toBeInTheDocument()
        expect(screen.getByRole("heading", { name: "Diagnostics" })).toBeInTheDocument()
      }
    }
  })

  it("uses the browser query string when no surface override is provided", async () => {
    window.history.replaceState({}, "", "/?surface=tasks")

    render(<SurfaceRouter api={createMockDesktopApi().api} />)

    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeVisible()
    expect(screen.getByRole("main")).toHaveAttribute("data-surface", "tasks")
  })

  it("forwards the expanded presentation mode to the overlay", async () => {
    render(
      <SurfaceRouter
        api={createMockDesktopApi().api}
        presentationMode="expanded"
        surface="overlay"
      />,
    )

    expect(
      await screen.findByRole("region", { name: "Expanded dashboard" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-presentation-mode",
      "expanded",
    )
  })

  it("preserves the selected surface when snapshot loading fails", async () => {
    const api = createMockDesktopApi({
      failures: { getSnapshot: "command-unavailable" },
    }).api

    render(<SurfaceRouter api={api} surface="settings" />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "command-unavailable",
    )
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-surface",
      "settings",
    )
  })
})
