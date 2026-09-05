import type { MutableRefObject } from "react"

import {
  getOverlayResizeProgress,
  getOverlayTargetKey,
  interpolateOverlayGeometry,
  measureOverlayVisualHeight,
  normalizeOverlayStartState,
  overlayResizeNow,
  readOverlayVerticalGutter,
  scheduleOverlayResizeFrame,
} from "./overlay-resize-helpers"
import {
  requestOverlayDisplayPlacement,
  startInitialOverlayPlacement,
  type OverlayPlacementRuntime,
} from "./overlay-placement"
import {
  calculateAnchoredGeometry,
  createOverlayWindowOperationQueue,
  getOverlayTargetLogicalSize,
  readOverlayWindowState,
  type OverlayLogicalSize,
  type OverlayPresentationMode,
  type OverlayWindowAdapter,
  type OverlayWindowGeometry,
} from "../lib/desktop/overlay-window"
import {
  cancelAnimation,
  createRuntimeState,
  destroyResizeRuntime,
  type OverlayResizeRuntimeState,
} from "./overlay-resize-state"

type OverlayResizeRuntimeOptions = {
  container: HTMLElement
  visual: HTMLElement
  focusState: "idle" | "running" | "paused"
  presentationMode: OverlayPresentationMode
  minimalMode: boolean
  showTimeline: boolean
  windowAdapter: OverlayWindowAdapter
  initializedAdapterRef: MutableRefObject<OverlayWindowAdapter | null>
  setIsResizing: (isResizing: boolean) => void
}

type ResizeTransitionOptions = {
  id: number
  state: OverlayResizeRuntimeState
  operationQueue: ReturnType<typeof createOverlayWindowOperationQueue>
  setIsResizing: (isResizing: boolean) => void
}

function finishTransition(
  state: OverlayResizeRuntimeState,
  id: number,
  setIsResizing: (isResizing: boolean) => void,
) {
  if (state.active && id === state.transitionId) {
    setIsResizing(false)
  }
}

function createTargetSizeReader(options: OverlayResizeRuntimeOptions) {
  return (entry?: ResizeObserverEntry): OverlayLogicalSize => {
    const measuredVisualHeight =
      options.presentationMode === "expanded"
        ? measureOverlayVisualHeight(options.visual, entry)
        : undefined

    return getOverlayTargetLogicalSize(options.presentationMode, {
      focusState: options.focusState,
      minimalMode: options.minimalMode,
      showTimeline: options.showTimeline,
      measuredVisualHeight,
      verticalGutter: readOverlayVerticalGutter(options.container),
    })
  }
}

function createPlacementRuntime(
  options: OverlayResizeRuntimeOptions,
  state: OverlayResizeRuntimeState,
  operationQueue: ReturnType<typeof createOverlayWindowOperationQueue>,
): OverlayPlacementRuntime {
  return {
    windowAdapter: options.windowAdapter,
    operationQueue,
    isActive: () => state.active,
    getTransitionId: () => state.transitionId,
    getDisplayRequestId: () => state.displayRequestId,
    beginTransition: () => {
      state.transitionId += 1
      return state.transitionId
    },
    beginDisplayRequest: () => {
      state.displayRequestId += 1
      return state.displayRequestId
    },
    cancelAnimation: () => cancelAnimation(state),
    finishTransition: (id) =>
      finishTransition(state, id, options.setIsResizing),
    setIsResizing: options.setIsResizing,
    onInitialPlacementSuccess: () => {
      state.initialPlacementPending = false
    },
    onInitialPlacementFailure: () => {
      state.initialPlacementPending = false
      if (options.initializedAdapterRef.current === options.windowAdapter) {
        options.initializedAdapterRef.current = null
      }
      state.lastTargetKey = null
    },
  }
}

function scheduleTransitionFrame(
  startedAt: number,
  startGeometry: OverlayWindowGeometry,
  endGeometry: OverlayWindowGeometry,
  transition: ResizeTransitionOptions,
) {
  const tick: FrameRequestCallback = (timestamp) => {
    if (
      !transition.state.active ||
      transition.id !== transition.state.transitionId
    ) {
      return
    }

    const progress = getOverlayResizeProgress(startedAt, timestamp)
    transition.operationQueue.enqueue(
      interpolateOverlayGeometry(startGeometry, endGeometry, progress),
    )

    if (progress >= 1) {
      transition.state.animationFrame = null
      void transition.operationQueue
        .whenIdle()
        .then(() =>
          finishTransition(
            transition.state,
            transition.id,
            transition.setIsResizing,
          ),
        )
      return
    }

    transition.state.animationFrame = scheduleOverlayResizeFrame(tick)
  }

  return tick
}

function startResizeTransition(
  targetSize: OverlayLogicalSize,
  state: OverlayResizeRuntimeState,
  operationQueue: ReturnType<typeof createOverlayWindowOperationQueue>,
  windowAdapter: OverlayWindowAdapter,
  setIsResizing: (isResizing: boolean) => void,
) {
  const id = state.transitionId + 1
  state.transitionId = id
  state.displayRequestId += 1
  cancelAnimation(state)
  operationQueue.cancelPending()
  setIsResizing(true)

  void readOverlayWindowState(windowAdapter).then(
    (windowState) => {
      if (!state.active || id !== state.transitionId) {
        return
      }

      const destination = calculateAnchoredGeometry(
        windowState,
        targetSize,
        windowState.scaleFactor,
      )
      const startState = normalizeOverlayStartState(windowState, destination)
      const startGeometry: OverlayWindowGeometry = {
        size: startState.size,
        position: startState.position,
      }
      const endGeometry: OverlayWindowGeometry = {
        size: destination.size,
        position: destination.position,
      }
      const tick = scheduleTransitionFrame(
        overlayResizeNow(),
        startGeometry,
        endGeometry,
        { id, state, operationQueue, setIsResizing },
      )

      state.animationFrame = scheduleOverlayResizeFrame(tick)
    },
    () => {
      if (state.active && id === state.transitionId) {
        state.lastTargetKey = null
        setIsResizing(false)
      }
    },
  )
}

function createTargetRequest(
  options: OverlayResizeRuntimeOptions,
  state: OverlayResizeRuntimeState,
  placementRuntime: OverlayPlacementRuntime,
  operationQueue: ReturnType<typeof createOverlayWindowOperationQueue>,
  readTargetSize: (entry?: ResizeObserverEntry) => OverlayLogicalSize,
) {
  return (entry?: ResizeObserverEntry) => {
    const nextTargetSize = readTargetSize(entry)
    const nextTargetKey = getOverlayTargetKey(nextTargetSize)

    if (nextTargetKey === state.lastTargetKey) {
      return
    }

    state.lastTargetKey = nextTargetKey

    if (options.initializedAdapterRef.current !== options.windowAdapter) {
      options.initializedAdapterRef.current = options.windowAdapter
      state.initialPlacementPending = true
      startInitialOverlayPlacement(nextTargetSize, placementRuntime)
      return
    }

    startResizeTransition(
      nextTargetSize,
      state,
      operationQueue,
      options.windowAdapter,
      options.setIsResizing,
    )
  }
}

function subscribeToDisplayChanges(
  options: OverlayResizeRuntimeOptions,
  state: OverlayResizeRuntimeState,
  placementRuntime: OverlayPlacementRuntime,
  readTargetSize: () => OverlayLogicalSize,
) {
  const requestPlacement = () => {
    const targetSize = readTargetSize()
    state.lastTargetKey = getOverlayTargetKey(targetSize)
    requestOverlayDisplayPlacement(targetSize, placementRuntime)
  }

  void options.windowAdapter.subscribeToDisplayChanges(requestPlacement).then(
    (unlisten) => {
      if (!state.active) {
        unlisten()
        return
      }

      state.displayUnlisten = unlisten
    },
    () => undefined,
  )
}

function createResizeObserver(
  visual: HTMLElement,
  requestTarget: (entry?: ResizeObserverEntry) => void,
) {
  if (typeof ResizeObserver === "undefined") {
    return null
  }

  const observer = new ResizeObserver(([entry]) => requestTarget(entry))
  observer.observe(visual)
  return observer
}

export type OverlayResizeRuntime = {
  start: () => void
  destroy: () => void
}

export function createOverlayResizeRuntime(
  options: OverlayResizeRuntimeOptions,
): OverlayResizeRuntime {
  const state = createRuntimeState()
  const operationQueue = createOverlayWindowOperationQueue(options.windowAdapter)
  const placementRuntime = createPlacementRuntime(
    options,
    state,
    operationQueue,
  )
  const readTargetSize = createTargetSizeReader(options)
  const requestTarget = createTargetRequest(
    options,
    state,
    placementRuntime,
    operationQueue,
    readTargetSize,
  )
  const observer = createResizeObserver(options.visual, requestTarget)

  return {
    start() {
      requestTarget()
      subscribeToDisplayChanges(options, state, placementRuntime, readTargetSize)
    },
    destroy() {
      destroyResizeRuntime(
        state,
        operationQueue,
        observer,
        options.initializedAdapterRef,
        options.windowAdapter,
        options.setIsResizing,
      )
    },
  }
}
