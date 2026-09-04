import { act, render, waitFor } from "@testing-library/react"
import { vi } from "vitest"

import {
  createEmptyAppSnapshot,
  createMockDesktopApi,
  type DesktopApi,
  type SurfaceLabel,
  type WindowMonitorSnapshot,
  type WindowPlacementSnapshot,
} from "../lib/desktopApi"
import type {
  OverlayDisplayMetrics,
  OverlayPhysicalPosition,
  OverlayWindowAdapter,
} from "../lib/desktop/overlay-window"
import { useWindowPlacement } from "./use-window-placement"

const primaryMonitor: WindowMonitorSnapshot = {
  name: "primary",
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  scaleFactor: 1,
}

const primaryDisplay: OverlayDisplayMetrics = {
  name: primaryMonitor.name ?? undefined,
  position: { x: primaryMonitor.x, y: primaryMonitor.y },
  size: { width: primaryMonitor.width, height: primaryMonitor.height },
  scaleFactor: primaryMonitor.scaleFactor,
}

const savedPlacement: WindowPlacementSnapshot = {
  revision: 4,
  windowLabel: "overlay",
  x: 300,
  y: 180,
  width: 800,
  height: 550,
  scaleFactor: 1,
  monitor: primaryMonitor,
}

type PlacementHarnessProps = {
  adapter: OverlayWindowAdapter | null
  api: DesktopApi
  debounceMs?: number
  surface: SurfaceLabel
}

function PlacementHarness({
  adapter,
  api,
  debounceMs,
  surface,
}: PlacementHarnessProps) {
  useWindowPlacement({ adapter, api, debounceMs, surface })
  return null
}

function createAdapter() {
  let moveListener: ((position: OverlayPhysicalPosition) => void) | undefined
  const unlisten = vi.fn()
  const adapter: OverlayWindowAdapter = {
    innerSize: vi.fn(async () => ({ width: 800, height: 550 })),
    innerPosition: vi.fn(async () => ({ x: 0, y: 0 })),
    scaleFactor: vi.fn(async () => 1),
    primaryMonitor: vi.fn(async () => primaryDisplay),
    availableMonitors: vi.fn(async () => [primaryMonitor]),
    setSize: vi.fn(async () => undefined),
    setPosition: vi.fn(async () => undefined),
    show: vi.fn(async () => undefined),
    hide: vi.fn(async () => undefined),
    subscribeToWindowMoves: vi.fn(
      async (listener: (position: OverlayPhysicalPosition) => void) => {
        moveListener = listener
        return unlisten
      },
    ),
    subscribeToDisplayChanges: vi.fn(async () => vi.fn()),
  }

  return {
    adapter,
    emitMove: (position: OverlayPhysicalPosition) => moveListener?.(position),
    unlisten,
  }
}

function renderPlacement(
  surface: SurfaceLabel,
  controller = createMockDesktopApi({
    snapshot: createEmptyAppSnapshot(),
    windowPlacement: savedPlacement,
  }),
) {
  const native = createAdapter()
  vi.spyOn(controller.api, "getWindowPlacement")
  vi.spyOn(controller.api, "saveWindowPlacement")
  const view = render(
    <PlacementHarness
      adapter={native.adapter}
      api={controller.api}
      surface={surface}
    />,
  )

  return { controller, native, view }
}

describe("useWindowPlacement", () => {
  it("does not restore or subscribe for the minimized overlay surface", async () => {
    const { controller, native } = renderPlacement("overlay")

    await act(async () => {
      await Promise.resolve()
    })

    expect(controller.api.getWindowPlacement).not.toHaveBeenCalled()
    expect(native.adapter.availableMonitors).not.toHaveBeenCalled()
    expect(native.adapter.subscribeToWindowMoves).not.toHaveBeenCalled()
    expect(native.adapter.setPosition).not.toHaveBeenCalled()
  })

  it("restores the shared placement when Tasks and Settings are opened", async () => {
    const rendered = renderPlacement("tasks")

    await waitFor(() => {
      expect(rendered.native.adapter.setPosition).toHaveBeenCalledWith({
        x: savedPlacement.x,
        y: savedPlacement.y,
      })
    })
    expect(rendered.native.adapter.setSize).toHaveBeenCalledWith({
      width: savedPlacement.width,
      height: savedPlacement.height,
    })

    rendered.view.rerender(
      <PlacementHarness
        adapter={rendered.native.adapter}
        api={rendered.controller.api}
        surface="settings"
      />,
    )

    await waitFor(() =>
      expect(rendered.native.adapter.setPosition).toHaveBeenCalledTimes(2),
    )
    expect(rendered.native.adapter.setPosition).toHaveBeenLastCalledWith({
      x: savedPlacement.x,
      y: savedPlacement.y,
    })
    expect(rendered.controller.api.getWindowPlacement).toHaveBeenCalledTimes(2)
  })

  it("debounces native moves and ignores moves caused by restoration", async () => {
    vi.useFakeTimers()
    const rendered = renderPlacement("tasks")

    await act(async () => {
      for (let index = 0; index < 8; index += 1) {
        await Promise.resolve()
      }
    })

    expect(rendered.native.adapter.setPosition).toHaveBeenCalledOnce()

    rendered.native.emitMove({ x: 400, y: 200 })
    rendered.native.emitMove({ x: 420, y: 220 })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(249)
    })
    expect(rendered.controller.api.saveWindowPlacement).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await act(async () => {
      for (let index = 0; index < 4; index += 1) {
        await Promise.resolve()
      }
    })
    expect(rendered.controller.api.saveWindowPlacement).toHaveBeenCalledOnce()

    rendered.view.unmount()
    vi.useRealTimers()
  })

  it("removes the native move listener when the extended surface unmounts", async () => {
    const rendered = renderPlacement("settings")

    await waitFor(() =>
      expect(rendered.native.adapter.subscribeToWindowMoves).toHaveBeenCalledOnce(),
    )
    rendered.view.unmount()

    expect(rendered.native.unlisten).toHaveBeenCalledOnce()
    rendered.native.emitMove({ x: 900, y: 400 })
    expect(rendered.controller.api.saveWindowPlacement).not.toHaveBeenCalled()
  })
})
