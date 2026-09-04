import type {
  OverlayWindowDimensionContract,
  WindowDimensionContract,
} from "./window-dimension-types"

export const OVERLAY_VERTICAL_GUTTER = 8

const CONTENT_WINDOW_DIMENSIONS = {
  preferred: { width: 800, height: 550 },
  minimum: { width: 760, height: 480 },
  maximum: { width: 800, height: 550 },
} as const satisfies WindowDimensionContract

export const WINDOW_DIMENSIONS = {
  overlay: {
    idle: { width: 204, height: 32 },
    collapsed: { width: 360, height: 72 },
    minimal: { width: 104, height: 72 },
    timelineOff: { width: 360, height: 52 },
    expanded: { width: 620, minHeight: 206 },
  } satisfies OverlayWindowDimensionContract,
  tasks: CONTENT_WINDOW_DIMENSIONS,
  settings: CONTENT_WINDOW_DIMENSIONS,
} as const

export const OVERLAY_WINDOW_DIMENSIONS = WINDOW_DIMENSIONS.overlay
export const TASKS_WINDOW_DIMENSIONS = WINDOW_DIMENSIONS.tasks
export const SETTINGS_WINDOW_DIMENSIONS = WINDOW_DIMENSIONS.settings

// Keep these names as compatibility aliases for the overlay resize runtime.
export const OVERLAY_WINDOW_SIZES = {
  idle: OVERLAY_WINDOW_DIMENSIONS.idle,
  collapsed: OVERLAY_WINDOW_DIMENSIONS.collapsed,
  minimal: OVERLAY_WINDOW_DIMENSIONS.minimal,
  timelineOff: OVERLAY_WINDOW_DIMENSIONS.timelineOff,
} as const

export const EXPANDED_DASHBOARD_SIZE = {
  width: OVERLAY_WINDOW_DIMENSIONS.expanded.width,
  minHeight:
    OVERLAY_WINDOW_DIMENSIONS.expanded.minHeight - OVERLAY_VERTICAL_GUTTER * 2,
} as const
