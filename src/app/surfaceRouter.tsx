import type { ComponentType } from "react"

import {
  desktopApi,
  type DesktopApi,
  type TasksWindowIntent,
  type SurfaceLabel,
} from "../lib/desktopApi"
import type { ExpandedDashboardCallbacks } from "../components/expanded-dashboard"
import type { OverlayWindowAdapter } from "../lib/desktop/overlay-window"
import { App, type PresentationMode } from "./App"
import {
  useRuntimePresentationMode,
  useRuntimeSurface,
} from "./use-runtime-surface"

type SurfaceComponentProps = {
  api: DesktopApi
  presentationMode: PresentationMode
  tasksIntent?: TasksWindowIntent
  overlayWindowAdapter?: OverlayWindowAdapter | null
} & Partial<ExpandedDashboardCallbacks>

type SurfaceComponent = ComponentType<SurfaceComponentProps>

function OverlaySurface({
  api,
  overlayWindowAdapter,
  presentationMode,
  ...callbacks
}: SurfaceComponentProps) {
  return (
    <App
      api={api}
      overlayWindowAdapter={overlayWindowAdapter}
      presentationMode={presentationMode}
      surface="overlay"
      {...callbacks}
    />
  )
}

function TasksSurface({ api, overlayWindowAdapter, tasksIntent }: SurfaceComponentProps) {
  return (
    <App
      api={api}
      overlayWindowAdapter={overlayWindowAdapter}
      surface="tasks"
      tasksIntent={tasksIntent}
    />
  )
}

function SettingsSurface({ api, overlayWindowAdapter }: SurfaceComponentProps) {
  return (
    <App
      api={api}
      overlayWindowAdapter={overlayWindowAdapter}
      surface="settings"
    />
  )
}

const surfaceComponents: Record<SurfaceLabel, SurfaceComponent> = {
  overlay: OverlaySurface,
  tasks: TasksSurface,
  settings: SettingsSurface,
}

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
  const Surface = surfaceComponents[resolvedSurface]

  return (
    <Surface
      api={api}
      overlayWindowAdapter={overlayWindowAdapter}
      presentationMode={resolvedPresentationMode}
      tasksIntent={tasksIntent}
      {...callbacks}
    />
  )
}
