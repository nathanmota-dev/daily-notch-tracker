import type { ReactNode } from "react"

import type { ExpandedDashboardProps } from "../components/expanded-dashboard"
import type { SurfaceLabel } from "../lib/desktopApi"

export type StackedContentSurfaceProps = {
  activeSurface: Exclude<SurfaceLabel, "overlay">
  dashboardProps: ExpandedDashboardProps
  settings: ReactNode
  tasks: ReactNode
}
