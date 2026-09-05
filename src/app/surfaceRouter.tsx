import {
  desktopApi,
  type DesktopApi,
  type SurfaceLabel,
} from "../lib/desktopApi"
import type { ExpandedDashboardCallbacks } from "../components/expanded-dashboard"
import type { OverlayWindowAdapter } from "../lib/desktop/overlay-window"
import { App, type PresentationMode } from "./App"
import {
  useRuntimePresentationMode,
  useRuntimeSurface,
} from "./use-runtime-surface"

export type SurfaceRouterProps = {
  api?: DesktopApi
  surface?: SurfaceLabel
  presentationMode?: PresentationMode
  overlayWindowAdapter?: OverlayWindowAdapter | null
} & Partial<ExpandedDashboardCallbacks>

export function SurfaceRouter({
  api = desktopApi,
  overlayWindowAdapter,
  presentationMode = "collapsed",
  surface,
  ...callbacks
}: SurfaceRouterProps) {
  const runtimeSurface = useRuntimeSurface({
    api,
    enabled: surface === undefined,
    fallbackPresentationMode: presentationMode,
  })
  const runtimePresentationMode = useRuntimePresentationMode(presentationMode)
  const resolvedSurface = surface ?? runtimeSurface.surface
  const resolvedPresentationMode =
    surface === undefined
      ? runtimeSurface.presentationMode ?? runtimePresentationMode
      : runtimePresentationMode
  const tasksIntent =
    surface === undefined && resolvedSurface === "tasks"
      ? runtimeSurface.intent ?? { kind: "list" as const }
      : undefined
  return (
    <App
      api={api}
      overlayWindowAdapter={overlayWindowAdapter}
      presentationMode={resolvedPresentationMode}
      surface={resolvedSurface}
      tasksIntent={tasksIntent}
      {...callbacks}
    />
  )
}
