import type { ComponentType } from "react"

import {
  desktopApi,
  type DesktopApi,
  type SurfaceLabel,
} from "../lib/desktopApi"
import type { ExpandedDashboardCallbacks } from "../components/expanded-dashboard"
import { App, type PresentationMode } from "./App"
import { getRuntimeSurfaceLabel } from "./surfaceResolver"

type SurfaceComponentProps = {
  api: DesktopApi
  presentationMode: PresentationMode
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

function TasksSurface({ api }: SurfaceComponentProps) {
  return <App api={api} surface="tasks" />
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
  const resolvedSurface = surface ?? getRuntimeSurfaceLabel()
  const Surface = surfaceComponents[resolvedSurface]

  return (
    <Surface
      api={api}
      presentationMode={presentationMode}
      {...callbacks}
    />
  )
}
