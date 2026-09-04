/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  resolveOverlayWindowAdapter,
} from "./use-overlay-resize"
import type {
  DesktopApi,
  FocusState,
} from "../lib/desktopApi"
import type {
  OverlayPresentationMode,
  OverlayWindowAdapter,
} from "../lib/desktop/overlay-window"

export const OVERLAY_COLLAPSE_DELAY_MS = 400

export type UseOverlayInteractionOptions = {
  adapter?: OverlayWindowAdapter | null
  api?: DesktopApi
  focusState?: FocusState
  initialPresentationMode?: OverlayPresentationMode
}

export type OverlayInteraction = {
  presentationMode: OverlayPresentationMode
  onFocus: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  acquireHold: () => () => void
}

const OverlayInteractionContext = createContext<OverlayInteraction | null>(
  null,
)

type InteractionRef<T> = { current: T }

type CollapseState = {
  activeRef: InteractionRef<boolean>
  pointerInsideRef: InteractionRef<boolean>
  holdsRef: InteractionRef<number>
  collapseTimerRef: InteractionRef<ReturnType<typeof setTimeout> | null>
  clearTimer: () => void
  setPresentationMode: (mode: OverlayPresentationMode) => void
}

function scheduleOverlayCollapse({
  activeRef,
  pointerInsideRef,
  holdsRef,
  collapseTimerRef,
  clearTimer,
  setPresentationMode,
}: CollapseState) {
  if (
    !activeRef.current ||
    pointerInsideRef.current ||
    holdsRef.current > 0
  ) {
    return
  }

  clearTimer()
  collapseTimerRef.current = setTimeout(() => {
    collapseTimerRef.current = null

    if (
      !activeRef.current ||
      pointerInsideRef.current ||
      holdsRef.current > 0
    ) {
      return
    }

    setPresentationMode("collapsed")
  }, OVERLAY_COLLAPSE_DELAY_MS)
}

function releaseOverlayHold(
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

function useOverlayVisibilityEffect(
  adapter: OverlayWindowAdapter | null | undefined,
  focusState: FocusState,
) {
  useEffect(() => {
    if (!adapter) {
      return
    }

    try {
      const visibilityOperation = adapter.show()

      void visibilityOperation.catch(() => undefined)
    } catch {
      // Native visibility failures should not interrupt the React surface.
    }
  }, [adapter, focusState])
}

function useOverlayPresentationRestoreEffect(
  api: DesktopApi | undefined,
  collapseState: CollapseState,
) {
  useEffect(() => {
    if (!api) {
      return
    }

    let active = true
    let unlisten: (() => void) | null = null

    void api
      .subscribe("overlay-presentation-restored", (mode) => {
        if (!active) {
          return
        }

        collapseState.clearTimer()
        collapseState.pointerInsideRef.current = false
        collapseState.setPresentationMode(mode)
      })
      .then((nextUnlisten) => {
        if (!active) {
          nextUnlisten()
          return
        }

        unlisten = nextUnlisten
      })
      .catch(() => undefined)

    return () => {
      active = false
      unlisten?.()
    }
  }, [api, collapseState])
}

function useOverlayInteractionLifecycleEffect(collapseState: CollapseState) {
  useEffect(() => {
    collapseState.activeRef.current = true

    return () => {
      collapseState.activeRef.current = false
      collapseState.pointerInsideRef.current = false
      collapseState.holdsRef.current = 0
      collapseState.clearTimer()
    }
  }, [collapseState])
}

export function useOverlayInteraction({
  adapter,
  api,
  focusState = "idle",
  initialPresentationMode = "collapsed",
}: UseOverlayInteractionOptions = {}): OverlayInteraction {
  const [presentationMode, setPresentationMode] = useState(
    initialPresentationMode,
  )
  const pointerInsideRef = useRef(false)
  const holdsRef = useRef(0)
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

  const collapseState = useMemo<CollapseState>(
    () => ({
      activeRef,
      pointerInsideRef,
      holdsRef,
      collapseTimerRef,
      clearTimer: clearCollapseTimer,
      setPresentationMode,
    }),
    [clearCollapseTimer],
  )

  const scheduleCollapse = useCallback(() => {
    scheduleOverlayCollapse(collapseState)
  }, [collapseState])

  useOverlayPresentationRestoreEffect(api, collapseState)

  const onPointerEnter = useCallback(() => {
    pointerInsideRef.current = true
    clearCollapseTimer()
    setPresentationMode("expanded")
  }, [clearCollapseTimer])

  const onFocus = useCallback(() => {
    pointerInsideRef.current = true
    clearCollapseTimer()
    setPresentationMode("expanded")
  }, [clearCollapseTimer])

  const onPointerLeave = useCallback(() => {
    pointerInsideRef.current = false

    if (holdsRef.current === 0) {
      scheduleCollapse()
    }
  }, [scheduleCollapse])

  const acquireHold = useCallback(() => {
    holdsRef.current += 1
    clearCollapseTimer()
    setPresentationMode("expanded")

    let released = false

    return () => {
      if (released) {
        return
      }

      released = true
      releaseOverlayHold(collapseState, scheduleCollapse)
    }
  }, [collapseState, clearCollapseTimer, scheduleCollapse])

  useOverlayInteractionLifecycleEffect(collapseState)

  useOverlayVisibilityEffect(resolvedAdapter, focusState)

  return useMemo(
    () => ({
      acquireHold,
      onFocus,
      onPointerEnter,
      onPointerLeave,
      presentationMode,
    }),
    [acquireHold, onFocus, onPointerEnter, onPointerLeave, presentationMode],
  )
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
