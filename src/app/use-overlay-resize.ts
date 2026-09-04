import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"

import { createOverlayResizeRuntime } from "./overlay-resize-runtime"
import { isTauriRuntime } from "../lib/desktop/tauri"
import type { FocusState } from "../lib/desktopApi"
import {
  createTauriOverlayWindowAdapter,
  type OverlayPresentationMode,
  type OverlayWindowAdapter,
} from "../lib/desktop/overlay-window"

type UseOverlayResizeOptions = {
  focusState?: FocusState
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

export function resolveOverlayWindowAdapter(
  adapter?: OverlayWindowAdapter | null,
) {
  return adapter === undefined ? getDefaultAdapter() : adapter
}

export function useOverlayWindowAdapter(
  adapter?: OverlayWindowAdapter | null,
) {
  return useMemo(() => resolveOverlayWindowAdapter(adapter), [adapter])
}

export function useOverlayResize({
  adapter,
  focusState = "running",
  minimalMode = false,
  presentationMode,
  showTimeline = true,
}: UseOverlayResizeOptions): UseOverlayResizeResult {
  const surfaceRef = useRef<HTMLElement | null>(null)
  const initializedAdapterRef = useRef<OverlayWindowAdapter | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const resolvedAdapter = useOverlayWindowAdapter(adapter)

  useEffect(() => {
    const surface = surfaceRef.current

    if (!surface || !resolvedAdapter) {
      return
    }
    const container = surface
    const windowAdapter = resolvedAdapter

    const visualSelector =
      presentationMode === "expanded"
        ? '[data-overlay-visual="expanded-dashboard"]'
        : '[data-slot="collapsed-focus-widget"]'
    const visualElement = container.querySelector<HTMLElement>(visualSelector)

    if (!visualElement) {
      return
    }
    const visual = visualElement

    const runtime = createOverlayResizeRuntime({
      container,
      visual,
      focusState,
      presentationMode,
      minimalMode,
      showTimeline,
      windowAdapter,
      initializedAdapterRef,
      setIsResizing,
    })
    runtime.start()

    return () => runtime.destroy()
  }, [focusState, minimalMode, presentationMode, resolvedAdapter, showTimeline])

  return { isResizing, surfaceRef }
}
