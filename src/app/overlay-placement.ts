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
  onInitialPlacementSuccess: () => void
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

async function showOverlayWindow(adapter: OverlayWindowAdapter) {
  try {
    await adapter.show()
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
        .then(async () => {
          if (!runtime.isActive() || id !== runtime.getTransitionId()) {
            return
          }

          await showOverlayWindow(runtime.windowAdapter)
          if (!runtime.isActive() || id !== runtime.getTransitionId()) {
            return
          }

          // Some compositors remap a hidden window at their default location.
          // Reapplying the geometry after show keeps the first visible frame on
          // the selected monitor without changing later resize transitions.
          runtime.operationQueue.enqueue(geometry)
          await runtime.operationQueue.whenIdle()
          if (!runtime.isActive() || id !== runtime.getTransitionId()) {
            return
          }

          runtime.onInitialPlacementSuccess()
          runtime.finishTransition(id)
        })
    },
    () => {
      if (runtime.isActive() && id === runtime.getTransitionId()) {
        runtime.onInitialPlacementFailure()
        void showOverlayWindow(runtime.windowAdapter)
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
