import { act, render } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  OVERLAY_RESIZE_DURATION_MS,
  type OverlayDisplayMetrics,
  type OverlayPhysicalPosition,
  type OverlayPhysicalSize,
  type OverlayPresentationMode,
  type OverlayWindowAdapter,
} from "../lib/desktop/overlay-window"
import { useOverlayResize } from "./use-overlay-resize"

class TestResizeObserver {
  static instances: TestResizeObserver[] = []

  readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    TestResizeObserver.instances.push(this)
  }

  observe() {}

  disconnect() {}

  trigger(height: number) {
    this.callback(
      [
        {
          contentRect: { height } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    )
  }
}

type AnimationFrameController = {
  cancel: ReturnType<typeof vi.fn>
  flush(timestamp: number): void
  pending(): number
  request: ReturnType<typeof vi.fn>
}

function createAnimationFrameController(): AnimationFrameController {
  let nextId = 1
  const callbacks = new Map<number, FrameRequestCallback>()
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId
    nextId += 1
    callbacks.set(id, callback)
    return id
  })
  const cancel = vi.fn((id: number) => {
    callbacks.delete(id)
  })

  return {
    cancel,
    flush(timestamp) {
      const [id, callback] = callbacks.entries().next().value ?? []
      if (id === undefined || callback === undefined) {
        return
      }

      callbacks.delete(id)
      callback(timestamp)
    },
    pending: () => callbacks.size,
    request,
  }
}

function createAdapter() {
  let display: OverlayDisplayMetrics | null = {
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
    workArea: {
      position: { x: 0, y: 32 },
      size: { width: 1920, height: 1048 },
    },
  }
  const displayListeners = new Set<() => void>()
  const adapter = {
    innerSize: vi.fn(async () => ({ width: 360, height: 72 })),
    innerPosition: vi.fn(async () => ({ x: 100, y: 48 })),
    scaleFactor: vi.fn(async () => 1),
    primaryMonitor: vi.fn(async () => display),
    setSize: vi.fn(async (size: OverlayPhysicalSize): Promise<void> => {
      void size
    }),
    setPosition: vi.fn(
      async (position: OverlayPhysicalPosition): Promise<void> => {
        void position
      },
    ),
    show: vi.fn(async () => undefined),
    hide: vi.fn(async () => undefined),
    subscribeToDisplayChanges: vi.fn(async (listener: () => void) => {
      displayListeners.add(listener)
      return () => displayListeners.delete(listener)
    }),
  } satisfies OverlayWindowAdapter

  return Object.assign(adapter, {
    emitDisplayChange() {
      displayListeners.forEach((listener) => listener())
    },
    setDisplay(nextDisplay: OverlayDisplayMetrics | null) {
      display = nextDisplay
    },
  })
}

function OverlayResizeHarness({
  adapter,
  minimalMode = false,
  presentationMode,
  showTimeline = true,
}: {
  adapter?: OverlayWindowAdapter | null
  minimalMode?: boolean
  presentationMode: OverlayPresentationMode
  showTimeline?: boolean
}) {
  const { isResizing, surfaceRef } = useOverlayResize({
    adapter,
    minimalMode,
    presentationMode,
    showTimeline,
  })

  return (
    <main ref={surfaceRef} data-resizing={isResizing ? "true" : "false"}>
      {presentationMode === "expanded" ? (
        <div data-overlay-visual="expanded-dashboard" data-slot="progress-tray" />
      ) : (
        <div data-slot="collapsed-focus-widget" />
      )}
    </main>
  )
}

async function settleAsyncWork() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

let restoreAnimationFrame: (() => void) | undefined
let animationFrame: AnimationFrameController

beforeEach(() => {
  TestResizeObserver.instances = []
  animationFrame = createAnimationFrameController()

  const previousRequest = Object.getOwnPropertyDescriptor(
    window,
    "requestAnimationFrame",
  )
  const previousCancel = Object.getOwnPropertyDescriptor(
    window,
    "cancelAnimationFrame",
  )

  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: animationFrame.request,
  })
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    value: animationFrame.cancel,
  })
  vi.stubGlobal("ResizeObserver", TestResizeObserver)

  restoreAnimationFrame = () => {
    if (previousRequest) {
      Object.defineProperty(window, "requestAnimationFrame", previousRequest)
    } else {
      delete (window as Partial<Window>).requestAnimationFrame
    }

    if (previousCancel) {
      Object.defineProperty(window, "cancelAnimationFrame", previousCancel)
    } else {
      delete (window as Partial<Window>).cancelAnimationFrame
    }
  }
})

afterEach(() => {
  restoreAnimationFrame?.()
  restoreAnimationFrame = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("useOverlayResize", () => {
  it("shows the overlay only after its initial size and position are applied", async () => {
    const adapter = createAdapter()

    render(<OverlayResizeHarness adapter={adapter} presentationMode="collapsed" />)
    await settleAsyncWork()

    expect(adapter.show).toHaveBeenCalledOnce()
    expect(adapter.setSize).toHaveBeenCalled()
    expect(adapter.setPosition).toHaveBeenCalled()
    expect(adapter.show.mock.invocationCallOrder[0]).toBeGreaterThan(
      adapter.setSize.mock.invocationCallOrder[0] ?? 0,
    )
    expect(adapter.show.mock.invocationCallOrder[0]).toBeGreaterThan(
      adapter.setPosition.mock.invocationCallOrder[0] ?? 0,
    )
    expect(adapter.setPosition.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      adapter.show.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it("retries initial placement after strict effect replay", async () => {
    const adapter = createAdapter()

    render(
      <StrictMode>
        <OverlayResizeHarness adapter={adapter} presentationMode="collapsed" />
      </StrictMode>,
    )
    await settleAsyncWork()

    expect(adapter.show).toHaveBeenCalledOnce()
    expect(adapter.setPosition).toHaveBeenLastCalledWith({ x: 858, y: 38 })
    expect(animationFrame.pending()).toBe(0)
  })

  it("resizes on mode changes while preserving the current center and top", async () => {
    const adapter = createAdapter()
    const { rerender } = render(
      <OverlayResizeHarness
        adapter={adapter}
        minimalMode
        presentationMode="peek"
      />,
    )

    await settleAsyncWork()

    expect(adapter.setSize).toHaveBeenLastCalledWith({ width: 104, height: 72 })
    expect(adapter.setPosition).toHaveBeenLastCalledWith({ x: 908, y: 38 })

    rerender(
      <OverlayResizeHarness adapter={adapter} presentationMode="expanded" />,
    )
    await settleAsyncWork()
    expect(animationFrame.pending()).toBe(1)
    animationFrame.flush(performance.now() + OVERLAY_RESIZE_DURATION_MS + 1)
    await settleAsyncWork()

    expect(adapter.setSize).toHaveBeenLastCalledWith({ width: 620, height: 206 })
    expect(adapter.setPosition).toHaveBeenLastCalledWith({ x: -30, y: 48 })
    expect(document.querySelector("main")).toHaveAttribute(
      "data-resizing",
      "false",
    )
  })

  it("cancels a previous animation when presentation mode changes again", async () => {
    const adapter = createAdapter()
    const { rerender } = render(
      <OverlayResizeHarness
        adapter={adapter}
        minimalMode
        presentationMode="peek"
      />,
    )

    await settleAsyncWork()
    const initialSetSizeCalls = adapter.setSize.mock.calls.length
    rerender(
      <OverlayResizeHarness adapter={adapter} presentationMode="expanded" />,
    )
    await settleAsyncWork()

    expect(animationFrame.pending()).toBe(1)

    rerender(
      <OverlayResizeHarness
        adapter={adapter}
        minimalMode
        presentationMode="peek"
      />,
    )
    await settleAsyncWork()

    expect(animationFrame.cancel).toHaveBeenCalled()
    expect(animationFrame.pending()).toBe(1)

    rerender(
      <OverlayResizeHarness adapter={adapter} presentationMode="expanded" />,
    )
    await settleAsyncWork()

    animationFrame.flush(performance.now() + OVERLAY_RESIZE_DURATION_MS + 1)
    await settleAsyncWork()

    expect(
      adapter.setSize.mock.calls.slice(initialSetSizeCalls),
    ).not.toContainEqual([{ width: 104, height: 72 }])
    expect(adapter.setSize).toHaveBeenLastCalledWith({ width: 620, height: 206 })
  })

  it("coalesces a new measured target while a native operation is in flight", async () => {
    const adapter = createAdapter()
    let releaseFirstSize: (() => void) | undefined
    const firstSize = new Promise<void>((resolve) => {
      releaseFirstSize = resolve
    })
    adapter.setSize = vi
      .fn<OverlayWindowAdapter["setSize"]>()
      .mockImplementationOnce(() => firstSize)
      .mockResolvedValue(undefined)

    render(
      <OverlayResizeHarness adapter={adapter} presentationMode="expanded" />,
    )
    await settleAsyncWork()
    animationFrame.flush(performance.now() + OVERLAY_RESIZE_DURATION_MS + 1)

    expect(adapter.setSize).toHaveBeenCalledTimes(1)
    TestResizeObserver.instances[0]?.trigger(220)
    await settleAsyncWork()
    animationFrame.flush(performance.now() + OVERLAY_RESIZE_DURATION_MS + 1)

    expect(adapter.setSize).toHaveBeenCalledTimes(1)
    releaseFirstSize?.()
    await settleAsyncWork()

    expect(adapter.setSize).toHaveBeenCalledTimes(2)
    expect(adapter.setSize).toHaveBeenLastCalledWith({
      width: 620,
      height: 236,
    })
    expect(adapter.setPosition).toHaveBeenCalledTimes(2)
  })

  it("does not restart a transition for the same ResizeObserver measurement", async () => {
    const adapter = createAdapter()

    render(
      <OverlayResizeHarness adapter={adapter} presentationMode="expanded" />,
    )
    await settleAsyncWork()
    animationFrame.flush(performance.now() + OVERLAY_RESIZE_DURATION_MS + 1)
    await settleAsyncWork()

    const initialReads = adapter.innerSize.mock.calls.length
    TestResizeObserver.instances[0]?.trigger(190)
    await settleAsyncWork()

    expect(adapter.innerSize).toHaveBeenCalledTimes(initialReads)
    expect(animationFrame.pending()).toBe(0)
  })

  it("is a no-op in browser/jsdom runtime", async () => {
    render(<OverlayResizeHarness presentationMode="expanded" />)

    await settleAsyncWork()

    expect(document.querySelector("main")).toHaveAttribute(
      "data-resizing",
      "false",
    )
    expect(animationFrame.pending()).toBe(0)
  })

  it("uses the primary display scale for its initial physical placement", async () => {
    const adapter = createAdapter()
    adapter.setDisplay({
      position: { x: -1280, y: -40 },
      size: { width: 1920, height: 1200 },
      scaleFactor: 1.5,
      workArea: {
        position: { x: -1280, y: 8 },
        size: { width: 1920, height: 1152 },
      },
    })

    render(
      <OverlayResizeHarness
        adapter={adapter}
        presentationMode="peek"
      />,
    )
    await settleAsyncWork()

    expect(adapter.setSize).toHaveBeenLastCalledWith({
      width: 540,
      height: 108,
    })
    expect(adapter.setPosition).toHaveBeenLastCalledWith({
      x: -590,
      y: 14,
    })
  })

  it("recalculates size and position when the primary display changes", async () => {
    const adapter = createAdapter()

    render(<OverlayResizeHarness adapter={adapter} presentationMode="peek" />)
    await settleAsyncWork()

    adapter.setDisplay({
      position: { x: -1280, y: -20 },
      size: { width: 1280, height: 720 },
      scaleFactor: 1.25,
      workArea: {
        position: { x: -1280, y: 20 },
        size: { width: 1280, height: 680 },
      },
    })
    act(() => adapter.emitDisplayChange())
    await settleAsyncWork()

    expect(adapter.setSize).toHaveBeenLastCalledWith({
      width: 450,
      height: 90,
    })
    expect(adapter.setPosition).toHaveBeenLastCalledWith({
      x: -865,
      y: 26,
    })
  })

  it("preserves the current position when the primary display is unavailable", async () => {
    const adapter = createAdapter()
    adapter.setDisplay(null)

    render(
      <OverlayResizeHarness
        adapter={adapter}
        minimalMode
        presentationMode="peek"
      />,
    )
    await settleAsyncWork()

    expect(adapter.setSize).toHaveBeenLastCalledWith({ width: 104, height: 72 })
    expect(adapter.setPosition).toHaveBeenLastCalledWith({ x: 100, y: 48 })
    expect(document.querySelector("main")).toHaveAttribute(
      "data-resizing",
      "false",
    )
  })

  it("cleans up display listeners when the hook unmounts", async () => {
    const adapter = createAdapter()
    const unlisten = vi.fn()
    adapter.subscribeToDisplayChanges = vi.fn(async () => unlisten)
    const { unmount } = render(
      <OverlayResizeHarness adapter={adapter} presentationMode="peek" />,
    )

    await settleAsyncWork()
    unmount()
    await settleAsyncWork()

    expect(unlisten).toHaveBeenCalledOnce()
  })

  it("ignores a stale display response after a newer display request", async () => {
    const adapter = createAdapter()

    render(<OverlayResizeHarness adapter={adapter} presentationMode="peek" />)
    await settleAsyncWork()

    const nextDisplay: OverlayDisplayMetrics = {
      position: { x: -1280, y: 0 },
      size: { width: 1280, height: 720 },
      scaleFactor: 1,
      workArea: {
        position: { x: -1280, y: 32 },
        size: { width: 1280, height: 688 },
      },
    }
    let releaseStale: ((display: OverlayDisplayMetrics) => void) | undefined
    const staleResponse = new Promise<OverlayDisplayMetrics>((resolve) => {
      releaseStale = resolve
    })
    adapter.primaryMonitor
      .mockReset()
      .mockImplementationOnce(() => staleResponse)
      .mockResolvedValueOnce(nextDisplay)

    act(() => {
      adapter.emitDisplayChange()
      adapter.emitDisplayChange()
    })
    await settleAsyncWork()

    expect(adapter.setPosition).toHaveBeenLastCalledWith({ x: -820, y: 38 })
    const positionCalls = adapter.setPosition.mock.calls.length

    releaseStale?.({
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
      scaleFactor: 1,
      workArea: {
        position: { x: 0, y: 32 },
        size: { width: 1920, height: 1048 },
      },
    })
    await settleAsyncWork()

    expect(adapter.setPosition).toHaveBeenCalledTimes(positionCalls)
  })

  it("keeps native position failures out of the React surface", async () => {
    const adapter = createAdapter()
    adapter.setPosition.mockRejectedValue(new Error("compositor rejected"))

    render(<OverlayResizeHarness adapter={adapter} presentationMode="collapsed" />)
    await settleAsyncWork()

    expect(adapter.setPosition).toHaveBeenCalled()
    expect(document.querySelector("main")).toHaveAttribute(
      "data-resizing",
      "false",
    )
  })
})
