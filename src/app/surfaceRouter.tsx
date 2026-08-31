import type { ComponentType } from "react"

import {
  desktopApi,
  type DesktopApi,
  type SurfaceLabel,
} from "../lib/desktopApi"
import { App } from "./App"
import { getRuntimeSurfaceLabel } from "./surfaceResolver"

type SurfaceComponentProps = {
  api: DesktopApi
}

type SurfaceComponent = ComponentType<SurfaceComponentProps>

function OverlaySurface({ api }: SurfaceComponentProps) {
  return <App api={api} surface="overlay" />
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
}

export function SurfaceRouter({
  api = desktopApi,
  surface,
}: SurfaceRouterProps) {
  const resolvedSurface = surface ?? getRuntimeSurfaceLabel()
  const Surface = surfaceComponents[resolvedSurface]

  return <Surface api={api} />
}
