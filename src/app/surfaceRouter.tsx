import type { ComponentType } from "react"

import {
  desktopApi,
  type DesktopApi,
  type TasksWindowIntent,
  type SurfaceLabel,
} from "../lib/desktopApi"
import type { ExpandedDashboardCallbacks } from "../components/expanded-dashboard"
import { App, type PresentationMode } from "./App"
import {
  useRuntimePresentationMode,
  useRuntimeSurface,
} from "./use-runtime-surface"

type SurfaceComponentProps = {
  api: DesktopApi
  presentationMode: PresentationMode
  tasksIntent?: TasksWindowIntent
} & Partial<ExpandedDashboardCallbacks>

type SurfaceComponent = ComponentType<SurfaceComponentProps>

function OverlaySurface({
  api,
  presentationMode,
  ...callbacks
}: SurfaceComponentProps) {
  return (
    <App
      api={api}
      presentationMode={presentationMode}
      surface="overlay"
      {...callbacks}
    />
  )
}

function TasksSurface({ api, tasksIntent }: SurfaceComponentProps) {
  return <App api={api} surface="tasks" tasksIntent={tasksIntent} />
}

function SettingsSurface({ api }: SurfaceComponentProps) {
  return <App api={api} surface="settings" />
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
} & Partial<ExpandedDashboardCallbacks>

export function SurfaceRouter({
  api = desktopApi,
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
      presentationMode={resolvedPresentationMode}
      tasksIntent={tasksIntent}
      {...callbacks}
    />
  )
}
