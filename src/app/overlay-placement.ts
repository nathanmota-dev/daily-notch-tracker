import { calculateOverlayPosition } from "../lib/desktop/overlay-position"
import {
  logicalSizeToPhysical,
  readOverlayDisplayMetrics,
  readOverlayWindowState,
  type OverlayLogicalSize,
  type OverlayWindowAdapter,
  type OverlayWindowGeometry,
  type OverlayWindowOperationQueue,
} from "../lib/desktop/overlay-window"

export type OverlayPlacementRuntime = {
  windowAdapter: OverlayWindowAdapter
  operationQueue: OverlayWindowOperationQueue
  isActive: () => boolean
  getTransitionId: () => number
  getDisplayRequestId: () => number
  beginTransition: () => number
  beginDisplayRequest: () => number
  cancelAnimation: () => void
  finishTransition: (id: number) => void
  setIsResizing: (isResizing: boolean) => void
  onInitialPlacementFailure: () => void
}

function currentPosition(
  state: Pick<OverlayWindowGeometry, "position">,
) {
  return {
    x: Number.isFinite(state.position.x) ? state.position.x : 0,
    y: Number.isFinite(state.position.y) ? state.position.y : 0,
  }
}

function showOverlayWindow(adapter: OverlayWindowAdapter) {
  try {
    const visibilityOperation = adapter.show()

    void visibilityOperation.catch(() => undefined)
  } catch {
    // Native visibility failures should not interrupt initial placement.
  }
}

export function startInitialOverlayPlacement(
  targetLogicalSize: OverlayLogicalSize,
  runtime: OverlayPlacementRuntime,
) {
  const id = runtime.beginTransition()
  runtime.beginDisplayRequest()
  runtime.cancelAnimation()
  runtime.operationQueue.cancelPending()
  runtime.setIsResizing(true)

  void Promise.all([
    readOverlayWindowState(runtime.windowAdapter),
    readOverlayDisplayMetrics(runtime.windowAdapter),
  ]).then(
    ([state, display]) => {
      if (!runtime.isActive() || id !== runtime.getTransitionId()) {
        return
      }

      const scaleFactor = display?.scaleFactor ?? state.scaleFactor
      const targetSize = logicalSizeToPhysical(targetLogicalSize, scaleFactor)
      const geometry: OverlayWindowGeometry = display
        ? {
            size: targetSize,
            position: calculateOverlayPosition(display, targetSize),
          }
        : {
            size: targetSize,
            position: currentPosition(state),
          }

      runtime.operationQueue.enqueue(geometry)
      void runtime.operationQueue
        .whenIdle()
        .then(() => {
          if (!runtime.isActive() || id !== runtime.getTransitionId()) {
            return
          }

          showOverlayWindow(runtime.windowAdapter)
          runtime.finishTransition(id)
        })
    },
    () => {
      if (runtime.isActive() && id === runtime.getTransitionId()) {
        runtime.onInitialPlacementFailure()
        showOverlayWindow(runtime.windowAdapter)
        runtime.setIsResizing(false)
      }
    },
  )
}

export function requestOverlayDisplayPlacement(
  targetLogicalSize: OverlayLogicalSize,
  runtime: OverlayPlacementRuntime,
) {
  const requestId = runtime.beginDisplayRequest()
  const id = runtime.beginTransition()
  runtime.cancelAnimation()
  runtime.operationQueue.cancelPending()
  runtime.setIsResizing(true)

  void readOverlayDisplayMetrics(runtime.windowAdapter).then(
    (display) => {
      if (
        !runtime.isActive() ||
        requestId !== runtime.getDisplayRequestId() ||
        id !== runtime.getTransitionId()
      ) {
        return
      }

      if (!display) {
        runtime.setIsResizing(false)
        return
      }

      const size = logicalSizeToPhysical(
        targetLogicalSize,
        display.scaleFactor,
      )
      runtime.operationQueue.enqueue({
        size,
        position: calculateOverlayPosition(display, size),
      })
      void runtime.operationQueue
        .whenIdle()
        .then(() => runtime.finishTransition(id))
    },
    () => {
      if (
        runtime.isActive() &&
        requestId === runtime.getDisplayRequestId() &&
        id === runtime.getTransitionId()
      ) {
        runtime.setIsResizing(false)
      }
    },
  )
}
