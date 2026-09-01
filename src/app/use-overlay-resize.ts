import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"

import { createOverlayResizeRuntime } from "./overlay-resize-runtime"
import { isTauriRuntime } from "../lib/desktop/tauri"
import {
  createTauriOverlayWindowAdapter,
  type OverlayPresentationMode,
  type OverlayWindowAdapter,
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
        ? '[data-slot="expanded-dashboard-tray"]'
        : '[data-slot="collapsed-focus-widget"]'
    const visualElement = container.querySelector<HTMLElement>(visualSelector)

    if (!visualElement) {
      return
    }
    const visual = visualElement

    const runtime = createOverlayResizeRuntime({
      container,
      visual,
      presentationMode,
      minimalMode,
      showTimeline,
      windowAdapter,
      initializedAdapterRef,
      setIsResizing,
    })
    runtime.start()

    return () => runtime.destroy()
  }, [minimalMode, presentationMode, resolvedAdapter, showTimeline])

  return { isResizing, surfaceRef }
}
