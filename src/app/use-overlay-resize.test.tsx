import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  OVERLAY_RESIZE_DURATION_MS,
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
  return {
    innerSize: vi.fn(async () => ({ width: 360, height: 72 })),
    innerPosition: vi.fn(async () => ({ x: 100, y: 48 })),
    scaleFactor: vi.fn(async () => 1),
    setSize: vi.fn(async (size: OverlayPhysicalSize): Promise<void> => {
      void size
    }),
    setPosition: vi.fn(
      async (position: OverlayPhysicalPosition): Promise<void> => {
        void position
      },
    ),
  } satisfies OverlayWindowAdapter
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
        <div data-slot="expanded-dashboard-tray" />
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
  it("resizes on mode changes while preserving the current center and top", async () => {
    const adapter = createAdapter()
    const { rerender } = render(
      <OverlayResizeHarness
        adapter={adapter}
        minimalMode
        presentationMode="collapsed"
      />,
    )

    await settleAsyncWork()
    expect(animationFrame.pending()).toBe(1)
    animationFrame.flush(performance.now() + OVERLAY_RESIZE_DURATION_MS + 1)
    await settleAsyncWork()

    expect(adapter.setSize).toHaveBeenLastCalledWith({ width: 104, height: 72 })
    expect(adapter.setPosition).toHaveBeenLastCalledWith({ x: 228, y: 48 })

    rerender(
      <OverlayResizeHarness adapter={adapter} presentationMode="expanded" />,
    )
    await settleAsyncWork()
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
        presentationMode="collapsed"
      />,
    )

    await settleAsyncWork()
    rerender(
      <OverlayResizeHarness adapter={adapter} presentationMode="expanded" />,
    )
    await settleAsyncWork()

    expect(animationFrame.cancel).toHaveBeenCalled()
    expect(animationFrame.pending()).toBe(1)

    animationFrame.flush(performance.now() + OVERLAY_RESIZE_DURATION_MS + 1)
    await settleAsyncWork()

    expect(adapter.setSize).not.toHaveBeenCalledWith({ width: 104, height: 72 })
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
})
