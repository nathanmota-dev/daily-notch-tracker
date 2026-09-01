import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"

import {
  getOverlayResizeProgress,
  getOverlayTargetKey,
  interpolateOverlayGeometry,
  measureOverlayVisualHeight,
  normalizeOverlayStartState,
  overlayResizeNow,
  readOverlayVerticalGutter,
  scheduleOverlayResizeFrame,
  type ScheduledOverlayFrame,
} from "./overlay-resize-helpers"
import {
  requestOverlayDisplayPlacement,
  startInitialOverlayPlacement,
  type OverlayPlacementRuntime,
} from "./overlay-placement"
import { isTauriRuntime } from "../lib/desktop/tauri"
import {
  calculateAnchoredGeometry,
  createOverlayWindowOperationQueue,
  createTauriOverlayWindowAdapter,
  getOverlayTargetLogicalSize,
  readOverlayWindowState,
  type OverlayLogicalSize,
  type OverlayPresentationMode,
  type OverlayWindowAdapter,
  type OverlayWindowGeometry,
  type OverlayWindowUnlisten,
} from "../lib/desktop/overlay-window"

type UseOverlayResizeOptions = {
  presentationMode: OverlayPresentationMode
  minimalMode?: boolean
  showTimeline?: boolean
  adapter?: OverlayWindowAdapter | null
}

export type UseOverlayResizeResult = {
  surfaceRef: RefObject<HTMLElement | null>
  isResizing: boolean
}

function getDefaultAdapter() {
  if (!isTauriRuntime()) {
    return null
  }

  try {
    return createTauriOverlayWindowAdapter()
  } catch {
    return null
  }
}

export function useOverlayResize({
  adapter,
  minimalMode = false,
  presentationMode,
  showTimeline = true,
}: UseOverlayResizeOptions): UseOverlayResizeResult {
  const surfaceRef = useRef<HTMLElement | null>(null)
  const initializedAdapterRef = useRef<OverlayWindowAdapter | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const resolvedAdapter = useMemo(
    () => (adapter === undefined ? getDefaultAdapter() : adapter),
    [adapter],
  )

  useEffect(() => {
    const surface = surfaceRef.current

    if (!surface || !resolvedAdapter) {
      return
    }
    const container = surface
    const windowAdapter = resolvedAdapter

    const visualSelector =
      presentationMode === "expanded"
        ? '[data-slot="expanded-dashboard-tray"]'
        : '[data-slot="collapsed-focus-widget"]'
    const visualElement = container.querySelector<HTMLElement>(visualSelector)

    if (!visualElement) {
      return
    }
    const visual = visualElement

    const operationQueue = createOverlayWindowOperationQueue(windowAdapter)
    let active = true
    let animationFrame: ScheduledOverlayFrame | null = null
    let transitionId = 0
    let displayRequestId = 0
    let lastTargetKey: string | null = null
    let displayUnlisten: OverlayWindowUnlisten | undefined

    function cancelAnimation() {
      animationFrame?.cancel()
      animationFrame = null
    }

    function finishTransition(id: number) {
      if (active && id === transitionId) {
        setIsResizing(false)
      }
    }

    function targetSize(entry?: ResizeObserverEntry) {
      const measuredVisualHeight =
        presentationMode === "expanded"
          ? measureOverlayVisualHeight(visual, entry)
          : undefined

      return getOverlayTargetLogicalSize(presentationMode, {
        minimalMode,
        showTimeline,
        measuredVisualHeight,
        verticalGutter: readOverlayVerticalGutter(container),
      })
    }

    const placementRuntime: OverlayPlacementRuntime = {
      windowAdapter,
      operationQueue,
      isActive: () => active,
      getTransitionId: () => transitionId,
      getDisplayRequestId: () => displayRequestId,
      beginTransition: () => {
        transitionId += 1
        return transitionId
      },
      beginDisplayRequest: () => {
        displayRequestId += 1
        return displayRequestId
      },
      cancelAnimation,
      finishTransition,
      setIsResizing,
      onInitialPlacementFailure: () => {
        if (initializedAdapterRef.current === windowAdapter) {
          initializedAdapterRef.current = null
        }
        lastTargetKey = null
      },
    }

    function startTransition(targetSize: OverlayLogicalSize) {
      const id = placementRuntime.beginTransition()
      placementRuntime.beginDisplayRequest()
      cancelAnimation()
      operationQueue.cancelPending()
      setIsResizing(true)

      void readOverlayWindowState(windowAdapter).then(
        (state) => {
          if (!active || id !== transitionId) {
            return
          }

          const destination = calculateAnchoredGeometry(
            state,
            targetSize,
            state.scaleFactor,
          )
          const startState = normalizeOverlayStartState(state, destination)
          const startGeometry: OverlayWindowGeometry = {
            size: startState.size,
            position: startState.position,
          }
          const endGeometry: OverlayWindowGeometry = {
            size: destination.size,
            position: destination.position,
          }
          const startedAt = overlayResizeNow()

          const tick: FrameRequestCallback = (timestamp) => {
            if (!active || id !== transitionId) {
              return
            }

            const progress = getOverlayResizeProgress(startedAt, timestamp)
            operationQueue.enqueue(
              interpolateOverlayGeometry(startGeometry, endGeometry, progress),
            )

            if (progress >= 1) {
              animationFrame = null
              void operationQueue.whenIdle().then(() => finishTransition(id))
              return
            }

            animationFrame = scheduleOverlayResizeFrame(tick)
          }

          animationFrame = scheduleOverlayResizeFrame(tick)
        },
        () => {
          if (active && id === transitionId) {
            lastTargetKey = null
            setIsResizing(false)
          }
        },
      )
    }

    function requestDisplayPlacement() {
      const nextTargetSize = targetSize()
      lastTargetKey = getOverlayTargetKey(nextTargetSize)
      requestOverlayDisplayPlacement(nextTargetSize, placementRuntime)
    }

    function requestTarget(entry?: ResizeObserverEntry) {
      const nextTargetSize = targetSize(entry)
      const nextTargetKey = getOverlayTargetKey(nextTargetSize)

      if (nextTargetKey === lastTargetKey) {
        return
      }

      lastTargetKey = nextTargetKey

      if (initializedAdapterRef.current !== windowAdapter) {
        initializedAdapterRef.current = windowAdapter
        startInitialOverlayPlacement(nextTargetSize, placementRuntime)
        return
      }

      startTransition(nextTargetSize)
    }

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(([entry]) => requestTarget(entry))

    observer?.observe(visual)
    requestTarget()

    void windowAdapter.subscribeToDisplayChanges(requestDisplayPlacement).then(
      (unlisten) => {
        if (!active) {
          unlisten()
          return
        }

        displayUnlisten = unlisten
      },
      () => undefined,
    )

    return () => {
      active = false
      transitionId += 1
      displayRequestId += 1
      cancelAnimation()
      operationQueue.cancelPending()
      displayUnlisten?.()
      setIsResizing(false)
      observer?.disconnect()
    }
  }, [minimalMode, presentationMode, resolvedAdapter, showTimeline])

  return { isResizing, surfaceRef }
}
