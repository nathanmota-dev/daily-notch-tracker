import { useCallback, useEffect, useRef } from "react"

import {
  isOverlayChildWindowChangedPayload,
  isSurfaceChangedPayload,
  type DesktopApi,
  type DesktopEventListener,
  type DesktopEventName,
  type FocusState,
} from "../lib/desktopApi"
import type { OverlayWindowAdapter } from "../lib/desktop/overlay-window"
import type { CollapseState } from "./overlay-interaction-types"
import {
  safelyUnlisten,
  scheduleOverlayCollapse,
} from "./overlay-interaction-helpers"

function useDesktopEventSubscription<EventName extends DesktopEventName>(
  api: DesktopApi | undefined,
  eventName: EventName,
  listener: DesktopEventListener<EventName>,
) {
  useEffect(() => {
    if (!api) {
      return
    }

    let active = true
    let unlisten: (() => void) | null = null

    void api
      .subscribe(eventName, (payload) => {
        if (active) {
          listener(payload)
        }
      })
      .then((nextUnlisten) => {
        if (!active) {
          safelyUnlisten(nextUnlisten)
          return
        }

        unlisten = nextUnlisten
      })
      .catch(() => undefined)

    return () => {
      active = false
      if (unlisten) {
        safelyUnlisten(unlisten)
      }
    }
  }, [api, eventName, listener])
}

export function useOverlayPresentationRestoreEffect(
  api: DesktopApi | undefined,
  collapseState: CollapseState,
) {
  const handleSurfaceChanged = useCallback(
    (payload: Parameters<DesktopEventListener<"surface-changed">>[0]) => {
      if (!isSurfaceChangedPayload(payload) || payload.surface !== "overlay") {
        return
      }

      collapseState.clearTimer()
      collapseState.pointerInsideRef.current = false
      const nextMode = payload.presentationMode ?? "collapsed"
      collapseState.presentationModeRef.current = nextMode
      collapseState.setPresentationMode(nextMode)
    },
    [collapseState],
  )
  useDesktopEventSubscription(api, "surface-changed", handleSurfaceChanged)

  const handleChildWindowChanged = useCallback(
    (
      payload: Parameters<
        DesktopEventListener<"overlay-child-window-changed">
      >[0],
    ) => {
      if (!isOverlayChildWindowChangedPayload(payload)) {
        return
      }

      if (payload.open) {
        collapseState.childWindowOpenRef.current = true
        collapseState.clearTimer()
        collapseState.presentationModeRef.current = payload.presentationMode
        collapseState.setPresentationMode(payload.presentationMode)
        return
      }

      collapseState.childWindowOpenRef.current = false
      collapseState.clearTimer()
      collapseState.presentationModeRef.current = payload.presentationMode
      collapseState.setPresentationMode(payload.presentationMode)
      if (
        !collapseState.pointerInsideRef.current &&
        collapseState.holdsRef.current === 0
      ) {
        scheduleOverlayCollapse(collapseState)
      }
    },
    [collapseState],
  )
  useDesktopEventSubscription(
    api,
    "overlay-child-window-changed",
    handleChildWindowChanged,
  )
}

export function useOverlayInteractionLifecycleEffect(
  collapseState: CollapseState,
) {
  useEffect(() => {
    collapseState.activeRef.current = true

    return () => {
      collapseState.activeRef.current = false
      collapseState.pointerInsideRef.current = false
      collapseState.holdsRef.current = 0
      collapseState.childWindowOpenRef.current = false
      collapseState.clearTimer()
    }
  }, [collapseState])
}

export function useOverlayBootstrapCollapseEffect(
  collapseState: CollapseState,
  autoCollapse: boolean,
) {
  useEffect(() => {
    if (!autoCollapse) {
      return
    }

    collapseState.pointerInsideRef.current = false
    collapseState.childWindowOpenRef.current = false
    scheduleOverlayCollapse(collapseState)

    return collapseState.clearTimer
  }, [autoCollapse, collapseState])
}

export function useOverlayVisibilityEffect(
  adapter: OverlayWindowAdapter | null | undefined,
  focusState: FocusState,
) {
  const previousStateRef = useRef<{
    adapter: OverlayWindowAdapter
    focusState: FocusState
  } | null>(null)

  useEffect(() => {
    if (!adapter) {
      previousStateRef.current = null
      return
    }

    const previousState = previousStateRef.current
    previousStateRef.current = { adapter, focusState }

    if (
      previousState === null ||
      previousState.adapter !== adapter ||
      previousState.focusState === focusState
    ) {
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
