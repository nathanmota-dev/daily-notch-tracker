import type { SurfaceLabel } from "./contracts"

export type WindowMonitorSnapshot = {
  name: string | null
  x: number
  y: number
  width: number
  height: number
  scaleFactor: number
}

export type WindowPlacementSnapshot = {
  revision: number
  windowLabel: SurfaceLabel
  x: number
  y: number
  width: number
  height: number
  scaleFactor: number
  monitor: WindowMonitorSnapshot
}
