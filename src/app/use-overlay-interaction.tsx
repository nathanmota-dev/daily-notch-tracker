/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react"

import {
  modeAfterPointerEnter,
  releaseOverlayHold,
  scheduleOverlayCollapse,
} from "./overlay-interaction-helpers"
import {
  useOverlayInteractionLifecycleEffect,
  useOverlayPresentationRestoreEffect,
  useOverlayVisibilityEffect,
} from "./overlay-interaction-effects"
import { useOverlayInteractionState } from "./overlay-interaction-state"
import type {
  OverlayInteraction,
  UseOverlayInteractionOptions,
} from "./overlay-interaction-types"

export {
  OVERLAY_COLLAPSE_DELAY_MS,
  OVERLAY_DASHBOARD_COLLAPSE_DELAY_MS,
  OVERLAY_WIDGET_COLLAPSE_DELAY_MS,
} from "./overlay-interaction-helpers"
export type {
  OverlayInteraction,
  UseOverlayInteractionOptions,
} from "./overlay-interaction-types"

const OverlayInteractionContext = createContext<OverlayInteraction | null>(
  null,
)

export function useOverlayInteraction({
  adapter,
  api,
  focusState = "idle",
  initialPresentationMode = "collapsed",
}: UseOverlayInteractionOptions = {}): OverlayInteraction {
  const {
    childWindowOpenRef,
    clearCollapseTimer,
    collapseState,
    holdsRef,
    presentationMode,
    presentationModeRef,
    pointerInsideRef,
    resolvedAdapter,
    updatePresentationMode,
  } = useOverlayInteractionState(adapter, initialPresentationMode)
  const scheduleCollapse = useCallback(() => {
    scheduleOverlayCollapse(collapseState)
  }, [collapseState])

  useOverlayPresentationRestoreEffect(api, collapseState)

  const enterPeek = useCallback(() => {
    pointerInsideRef.current = true
    clearCollapseTimer()
    updatePresentationMode(modeAfterPointerEnter(presentationModeRef.current))
  }, [clearCollapseTimer, presentationModeRef, pointerInsideRef, updatePresentationMode])
  const onPointerEnter = enterPeek
  const onFocus = enterPeek

  const onClick = useCallback(() => {
    pointerInsideRef.current = true
    clearCollapseTimer()
    updatePresentationMode("expanded")
  }, [clearCollapseTimer, pointerInsideRef, updatePresentationMode])

  const onPointerLeave = useCallback(() => {
    pointerInsideRef.current = false

    if (holdsRef.current === 0 && !childWindowOpenRef.current) {
      scheduleCollapse()
    }
  }, [childWindowOpenRef, holdsRef, pointerInsideRef, scheduleCollapse])

  const acquireHold = useCallback(() => {
    holdsRef.current += 1
    clearCollapseTimer()
    updatePresentationMode("expanded")

    let released = false

    return () => {
      if (released) {
        return
      }

      released = true
      releaseOverlayHold(collapseState, scheduleCollapse)
    }
  }, [collapseState, clearCollapseTimer, holdsRef, scheduleCollapse, updatePresentationMode])

  useOverlayInteractionLifecycleEffect(collapseState)
  useOverlayVisibilityEffect(resolvedAdapter, focusState)

  return {
    acquireHold,
    onClick,
    onFocus,
    onPointerEnter,
    onPointerLeave,
    presentationMode,
  }
}

export function OverlayInteractionProvider({
  children,
  value,
}: {
  children: ReactNode
  value: OverlayInteraction
}) {
  return (
    <OverlayInteractionContext.Provider value={value}>
      {children}
    </OverlayInteractionContext.Provider>
  )
}

export function useOverlayInteractionContext() {
  return useContext(OverlayInteractionContext)
}

export function useOverlayHold(isHeld: boolean) {
  const interaction = useContext(OverlayInteractionContext)
  const acquireHold = interaction?.acquireHold

  useEffect(() => {
    if (!isHeld || !acquireHold) {
      return
    }

    return acquireHold()
  }, [acquireHold, isHeld])
}
