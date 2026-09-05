import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react"

import { resolveOverlayWindowAdapter } from "./use-overlay-resize"
import type {
  OverlayPresentationMode,
  OverlayWindowAdapter,
} from "../lib/desktop/overlay-window"
import type {
  CollapseState,
  OverlayInteractionState,
} from "./overlay-interaction-types"

export function useOverlayInteractionState(
  adapter: OverlayWindowAdapter | null | undefined,
  initialPresentationMode: OverlayPresentationMode,
): OverlayInteractionState {
  const [presentationMode, setPresentationMode] = useState(
    initialPresentationMode,
  )
  const presentationModeRef = useRef(initialPresentationMode)
  const pointerInsideRef = useRef(false)
  const holdsRef = useRef(0)
  const childWindowOpenRef = useRef(false)
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRef = useRef(true)
  const resolvedAdapter = useMemo(
    () => resolveOverlayWindowAdapter(adapter),
    [adapter],
  )

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current === null) {
      return
    }

    clearTimeout(collapseTimerRef.current)
    collapseTimerRef.current = null
  }, [])

  const updatePresentationMode = useCallback(
    (mode: OverlayPresentationMode) => {
      presentationModeRef.current = mode
      setPresentationMode(mode)
    },
    [],
  )

  const collapseState = useMemo<CollapseState>(
    () => ({
      activeRef,
      pointerInsideRef,
      holdsRef,
      childWindowOpenRef,
      collapseTimerRef,
      clearTimer: clearCollapseTimer,
      presentationModeRef,
      setPresentationMode: updatePresentationMode,
    }),
    [clearCollapseTimer, updatePresentationMode],
  )

  return {
    childWindowOpenRef,
    clearCollapseTimer,
    collapseState,
    holdsRef,
    presentationMode,
    presentationModeRef,
    pointerInsideRef,
    resolvedAdapter,
    updatePresentationMode,
  }
}
