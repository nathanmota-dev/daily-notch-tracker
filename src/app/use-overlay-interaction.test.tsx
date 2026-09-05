import { act, fireEvent, render, screen } from "@testing-library/react"
import { StrictMode, useEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { OverlayWindowAdapter } from "../lib/desktop/overlay-window"
import {
  createMockDesktopApi,
  type DesktopApi,
} from "../lib/desktopApi"
import {
  OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS,
  OVERLAY_WIDGET_COLLAPSE_DELAY_MS,
  OverlayInteractionProvider,
  useOverlayHold,
  useOverlayInteraction,
  useOverlayInteractionContext,
} from "./use-overlay-interaction"

function createAdapter() {
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

function Hold({ isHeld }: { isHeld: boolean }) {
  useOverlayHold(isHeld)
  return null
}

function ManualHold({
  releaseRef,
}: {
  releaseRef: { current: (() => void) | null }
}) {
  const acquireHold = useOverlayInteractionContext()?.acquireHold

  useEffect(() => {
    if (!acquireHold) {
      return
    }

    const release = acquireHold()
    releaseRef.current = release

    return () => {
      release()
      releaseRef.current = null
    }
  }, [acquireHold, releaseRef])

  return null
}

function InteractionHarness({
  adapter,
  api,
  firstHold = false,
  focusState = "running",
  initialPresentationMode = "collapsed",
  secondHold = false,
}: {
  adapter?: OverlayWindowAdapter | null
  api?: DesktopApi
  firstHold?: boolean
  focusState?: "idle" | "running" | "paused"
  initialPresentationMode?: "collapsed" | "peek" | "expanded"
  secondHold?: boolean
}) {
  const interaction = useOverlayInteraction({
    adapter,
    api,
    focusState,
    initialPresentationMode,
  })

  return (
    <OverlayInteractionProvider value={interaction}>
      <main
        data-presentation-mode={interaction.presentationMode}
        onClick={interaction.onClick}
        onPointerEnter={interaction.onPointerEnter}
        onPointerLeave={interaction.onPointerLeave}
      >
        <Hold isHeld={firstHold} />
        <Hold isHeld={secondHold} />
      </main>
    </OverlayInteractionProvider>
  )
}

function ManualInteractionHarness({
  releaseRef,
}: {
  releaseRef: { current: (() => void) | null }
}) {
  const interaction = useOverlayInteraction({ focusState: "running" })

  return (
    <OverlayInteractionProvider value={interaction}>
      <main
        data-presentation-mode={interaction.presentationMode}
        onPointerEnter={interaction.onPointerEnter}
        onPointerLeave={interaction.onPointerLeave}
      >
        <ManualHold releaseRef={releaseRef} />
      </main>
    </OverlayInteractionProvider>
  )
}

describe("useOverlayInteraction", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("enters the compact peek when the pointer enters", () => {
    render(<InteractionHarness />)
    const surface = screen.getByRole("main")

    expect(surface).toHaveAttribute("data-presentation-mode", "collapsed")

    fireEvent.pointerEnter(surface)

    expect(surface).toHaveAttribute("data-presentation-mode", "peek")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("restores the presentation mode from the desktop lifecycle", async () => {
    const controller = createMockDesktopApi()
    render(<InteractionHarness api={controller.api} />)
    const surface = screen.getByRole("main")

    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.pointerEnter(surface)
    fireEvent.pointerLeave(surface)
    expect(vi.getTimerCount()).toBe(1)

    act(() =>
      controller.emit("surface-changed", {
        surface: "overlay",
        intent: null,
        presentationMode: "expanded",
      }),
    )

    expect(surface).toHaveAttribute("data-presentation-mode", "expanded")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("keeps the overlay expanded while a native child window is open", async () => {
    const controller = createMockDesktopApi()
    render(<InteractionHarness api={controller.api} />)
    const surface = screen.getByRole("main")

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    fireEvent.pointerEnter(surface)
    fireEvent.click(surface)
    fireEvent.pointerLeave(surface)

    act(() => {
      controller.emit("overlay-child-window-changed", { open: true })
      vi.advanceTimersByTime(
        OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS +
          OVERLAY_WIDGET_COLLAPSE_DELAY_MS,
      )
    })

    expect(surface).toHaveAttribute("data-presentation-mode", "expanded")
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      controller.emit("surface-changed", {
        intent: null,
        presentationMode: "expanded",
        surface: "overlay",
      })
      controller.emit("overlay-child-window-changed", { open: false })
    })

    act(() => vi.advanceTimersByTime(OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS - 1))
    expect(surface).toHaveAttribute("data-presentation-mode", "expanded")

    act(() => vi.advanceTimersByTime(1))
    expect(surface).toHaveAttribute("data-presentation-mode", "peek")
  })

  it("collapses the dashboard and widget using their separate delays", () => {
    render(<InteractionHarness />)
    const surface = screen.getByRole("main")
    fireEvent.pointerEnter(surface)
    fireEvent.click(surface)
    fireEvent.pointerLeave(surface)

    act(() => vi.advanceTimersByTime(OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS - 1))
    expect(surface).toHaveAttribute("data-presentation-mode", "expanded")

    act(() => vi.advanceTimersByTime(1))
    expect(surface).toHaveAttribute("data-presentation-mode", "peek")

    act(() => vi.advanceTimersByTime(OVERLAY_WIDGET_COLLAPSE_DELAY_MS - 1))
    expect(surface).toHaveAttribute("data-presentation-mode", "peek")

    act(() => vi.advanceTimersByTime(1))
    expect(surface).toHaveAttribute("data-presentation-mode", "collapsed")
  })

  it("cancels a pending collapse when the pointer returns", () => {
    render(<InteractionHarness />)
    const surface = screen.getByRole("main")
    fireEvent.pointerEnter(surface)
    fireEvent.click(surface)
    fireEvent.pointerLeave(surface)

    act(() => vi.advanceTimersByTime(250))
    fireEvent.pointerEnter(surface)
    act(() => vi.advanceTimersByTime(OVERLAY_WIDGET_COLLAPSE_DELAY_MS))

    expect(surface).toHaveAttribute("data-presentation-mode", "expanded")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("keeps only one collapse timer during rapid pointer changes", () => {
    render(<InteractionHarness />)
    const surface = screen.getByRole("main")

    fireEvent.pointerEnter(surface)
    fireEvent.pointerLeave(surface)
    fireEvent.pointerLeave(surface)
    expect(vi.getTimerCount()).toBe(1)

    fireEvent.pointerEnter(surface)
    fireEvent.pointerLeave(surface)
    expect(vi.getTimerCount()).toBe(1)
  })

  it("keeps the overlay expanded while a hold is active", () => {
    const { rerender } = render(<InteractionHarness />)
    const surface = screen.getByRole("main")
    fireEvent.pointerEnter(surface)
    fireEvent.pointerLeave(surface)
    expect(vi.getTimerCount()).toBe(1)

    rerender(<InteractionHarness firstHold />)
    act(() => vi.advanceTimersByTime(OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS))

    expect(surface).toHaveAttribute("data-presentation-mode", "expanded")
    expect(vi.getTimerCount()).toBe(0)

    rerender(<InteractionHarness />)
    expect(vi.getTimerCount()).toBe(1)
    act(() => vi.advanceTimersByTime(OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS))
    expect(surface).toHaveAttribute("data-presentation-mode", "peek")
    act(() => vi.advanceTimersByTime(OVERLAY_WIDGET_COLLAPSE_DELAY_MS))
    expect(surface).toHaveAttribute("data-presentation-mode", "collapsed")
  })

  it("waits for every hold to release before collapsing", () => {
    const { rerender } = render(
      <InteractionHarness firstHold secondHold />,
    )
    const surface = screen.getByRole("main")

    fireEvent.pointerLeave(surface)
    expect(vi.getTimerCount()).toBe(0)

    rerender(<InteractionHarness secondHold />)
    act(() => vi.advanceTimersByTime(OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS))
    expect(surface).toHaveAttribute("data-presentation-mode", "expanded")
    expect(vi.getTimerCount()).toBe(0)

    rerender(<InteractionHarness />)
    expect(vi.getTimerCount()).toBe(1)
    act(() => vi.advanceTimersByTime(OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS))
    expect(surface).toHaveAttribute("data-presentation-mode", "peek")
    act(() => vi.advanceTimersByTime(OVERLAY_WIDGET_COLLAPSE_DELAY_MS))
    expect(surface).toHaveAttribute("data-presentation-mode", "collapsed")
  })

  it("makes a hold release idempotent", () => {
    const releaseRef: { current: (() => void) | null } = { current: null }
    render(<ManualInteractionHarness releaseRef={releaseRef} />)
    const surface = screen.getByRole("main")

    fireEvent.pointerLeave(surface)
    expect(vi.getTimerCount()).toBe(0)

    releaseRef.current?.()
    releaseRef.current?.()
    expect(vi.getTimerCount()).toBe(1)

    act(() => vi.advanceTimersByTime(OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS))
    expect(surface).toHaveAttribute("data-presentation-mode", "peek")
    act(() => vi.advanceTimersByTime(OVERLAY_WIDGET_COLLAPSE_DELAY_MS))
    expect(surface).toHaveAttribute("data-presentation-mode", "collapsed")
  })

  it("cleans up the timer when the interaction unmounts", () => {
    const { unmount } = render(<InteractionHarness />)
    const surface = screen.getByRole("main")
    fireEvent.pointerEnter(surface)
    fireEvent.pointerLeave(surface)
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it("cleans up an asynchronously registered listener after unmount", async () => {
    let resolveCleanup: ((cleanup: () => void) => void) | undefined
    const cleanup = vi.fn()
    const baseApi = createMockDesktopApi().api
    const api = {
      ...baseApi,
      subscribe: vi.fn(
        () =>
          new Promise<() => void>((resolve) => {
            resolveCleanup = resolve
          }),
      ),
    } as DesktopApi
    const { unmount } = render(<InteractionHarness api={api} />)

    unmount()

    await act(async () => {
      resolveCleanup?.(cleanup)
      await Promise.resolve()
    })

    expect(cleanup).toHaveBeenCalledOnce()
  })

  it("keeps the idle notch visible and shows it for active sessions", () => {
    const adapter = createAdapter()
    const { rerender } = render(
      <InteractionHarness adapter={adapter} focusState="idle" />,
    )

    expect(adapter.show).not.toHaveBeenCalled()
    expect(adapter.hide).not.toHaveBeenCalled()

    rerender(<InteractionHarness adapter={adapter} focusState="running" />)
    expect(adapter.show).toHaveBeenCalledOnce()

    rerender(<InteractionHarness adapter={adapter} focusState="paused" />)
    expect(adapter.show).toHaveBeenCalledTimes(2)
  })

  it("does not show before initial placement during strict effect replay", () => {
    const adapter = createAdapter()

    render(
      <StrictMode>
        <InteractionHarness adapter={adapter} focusState="idle" />
      </StrictMode>,
    )

    expect(adapter.show).not.toHaveBeenCalled()
  })

  it("absorbs native visibility failures", () => {
    const adapter = createAdapter()
    const { rerender } = render(
      <InteractionHarness adapter={adapter} focusState="idle" />,
    )
    adapter.show.mockRejectedValueOnce(new Error("window unavailable"))

    expect(() =>
      rerender(<InteractionHarness adapter={adapter} focusState="running" />),
    ).not.toThrow()
  })
})
