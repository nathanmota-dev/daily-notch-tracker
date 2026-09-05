import type { MutableRefObject } from "react"

import type { ScheduledOverlayFrame } from "./overlay-resize-helpers"
import type {
  OverlayWindowAdapter,
  OverlayWindowOperationQueue,
  OverlayWindowUnlisten,
} from "../lib/desktop/overlay-window"

export type OverlayResizeRuntimeState = {
  active: boolean
  animationFrame: ScheduledOverlayFrame | null
  transitionId: number
  displayRequestId: number
  initialPlacementPending: boolean
  lastTargetKey: string | null
  displayUnlisten?: OverlayWindowUnlisten
}

export function createRuntimeState(): OverlayResizeRuntimeState {
  return {
    active: true,
    animationFrame: null,
    transitionId: 0,
    displayRequestId: 0,
    initialPlacementPending: false,
    lastTargetKey: null,
  }
}

export function cancelAnimation(state: OverlayResizeRuntimeState) {
  state.animationFrame?.cancel()
  state.animationFrame = null
}

export function destroyResizeRuntime(
  state: OverlayResizeRuntimeState,
  operationQueue: OverlayWindowOperationQueue,
  observer: ResizeObserver | null,
  initializedAdapterRef: MutableRefObject<OverlayWindowAdapter | null>,
  windowAdapter: OverlayWindowAdapter,
  setIsResizing: (isResizing: boolean) => void,
) {
  if (
    state.initialPlacementPending &&
    initializedAdapterRef.current === windowAdapter
  ) {
    initializedAdapterRef.current = null
  }

  state.initialPlacementPending = false
  state.active = false
  state.transitionId += 1
  state.displayRequestId += 1
  cancelAnimation(state)
  operationQueue.cancelPending()
  state.displayUnlisten?.()
  setIsResizing(false)
  observer?.disconnect()
}
