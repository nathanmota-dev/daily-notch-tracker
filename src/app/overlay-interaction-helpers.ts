import type { OverlayPresentationMode } from "../lib/desktop/overlay-window"
import type { CollapseState } from "./overlay-interaction-types"

export const OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS = 1000
export const OVERLAY_WIDGET_COLLAPSE_DELAY_MS = 3000
export const OVERLAY_COLLAPSE_DELAY_MS = OVERLAY_WIDGET_COLLAPSE_DELAY_MS

export function safelyUnlisten(unlisten: () => void) {
  try {
    unlisten()
  } catch {
    return
  }
}

export function scheduleOverlayCollapse({
  activeRef,
  pointerInsideRef,
  holdsRef,
  childWindowOpenRef,
  collapseTimerRef,
  clearTimer,
  setPresentationMode,
  presentationModeRef,
}: CollapseState) {
  if (
    !activeRef.current ||
    pointerInsideRef.current ||
    holdsRef.current > 0 ||
    childWindowOpenRef.current
  ) {
    return
  }

  const nextMode = getNextPresentationMode(presentationModeRef.current)
  if (nextMode === null) {
    return
  }

  clearTimer()
  collapseTimerRef.current = setTimeout(() => {
    collapseTimerRef.current = null

    if (
      !activeRef.current ||
      pointerInsideRef.current ||
      holdsRef.current > 0 ||
      childWindowOpenRef.current
    ) {
      return
    }

    presentationModeRef.current = nextMode
    setPresentationMode(nextMode)

    if (nextMode === "peek") {
      scheduleOverlayCollapse({
        activeRef,
        pointerInsideRef,
        holdsRef,
        childWindowOpenRef,
        collapseTimerRef,
        clearTimer,
        setPresentationMode,
        presentationModeRef,
      })
    }
  }, getCollapseDelay(presentationModeRef.current))
}

function getNextPresentationMode(
  mode: OverlayPresentationMode,
): OverlayPresentationMode | null {
  if (mode === "expanded") {
    return "peek"
  }

  return mode === "peek" ? "collapsed" : null
}

function getCollapseDelay(mode: OverlayPresentationMode) {
  return mode === "expanded"
    ? OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS
    : OVERLAY_WIDGET_COLLAPSE_DELAY_MS
}

export function releaseOverlayHold(
  state: CollapseState,
  scheduleCollapse: () => void,
) {
  state.holdsRef.current = Math.max(0, state.holdsRef.current - 1)

  if (
    state.activeRef.current &&
    state.holdsRef.current === 0 &&
    !state.pointerInsideRef.current
  ) {
    scheduleCollapse()
  }
}

export function modeAfterPointerEnter(mode: OverlayPresentationMode) {
  return mode === "expanded" ? "expanded" : "peek"
}
