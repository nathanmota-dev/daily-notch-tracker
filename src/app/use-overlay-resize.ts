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
    let lastTargetKey: string | null = null

    function cancelAnimation() {
      animationFrame?.cancel()
      animationFrame = null
    }

    function finishTransition(id: number) {
      if (active && id === transitionId) {
        setIsResizing(false)
      }
    }

    function startTransition(targetSize: OverlayLogicalSize) {
      transitionId += 1
      const id = transitionId
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

    function requestTarget(entry?: ResizeObserverEntry) {
      const measuredVisualHeight =
        presentationMode === "expanded"
          ? measureOverlayVisualHeight(visual, entry)
          : undefined
      const targetSize = getOverlayTargetLogicalSize(presentationMode, {
        minimalMode,
        showTimeline,
        measuredVisualHeight,
        verticalGutter: readOverlayVerticalGutter(container),
      })
      const nextTargetKey = getOverlayTargetKey(targetSize)

      if (nextTargetKey === lastTargetKey) {
        return
      }

      lastTargetKey = nextTargetKey
      startTransition(targetSize)
    }

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(([entry]) => requestTarget(entry))

    observer?.observe(visual)
    requestTarget()

    return () => {
      active = false
      transitionId += 1
      cancelAnimation()
      operationQueue.cancelPending()
      setIsResizing(false)
      observer?.disconnect()
    }
  }, [minimalMode, presentationMode, resolvedAdapter, showTimeline])

  return { isResizing, surfaceRef }
}
