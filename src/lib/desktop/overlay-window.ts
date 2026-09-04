import type {
  OverlayDisplayMetrics,
  OverlayPhysicalPosition,
  OverlayPhysicalSize,
} from "./overlay-position"
import {
  EXPANDED_DASHBOARD_SIZE,
  OVERLAY_VERTICAL_GUTTER,
  OVERLAY_WINDOW_SIZES,
} from "./window-dimensions"
import type { WindowSize } from "./window-dimension-types"

export {
  EXPANDED_DASHBOARD_SIZE,
  OVERLAY_VERTICAL_GUTTER,
  OVERLAY_WINDOW_DIMENSIONS,
  OVERLAY_WINDOW_SIZES,
  SETTINGS_WINDOW_DIMENSIONS,
  TASKS_WINDOW_DIMENSIONS,
  WINDOW_DIMENSIONS,
} from "./window-dimensions"
export type {
  OverlayExpandedDimension,
  OverlayWindowDimensionContract,
  WindowDimensionContract,
  WindowSize,
} from "./window-dimension-types"

export type {
  OverlayDisplayMetrics,
  OverlayPhysicalPosition,
  OverlayPhysicalSize,
  OverlayWorkArea,
} from "./overlay-position"

export const OVERLAY_RESIZE_DURATION_MS = 240

export type OverlayPresentationMode = "collapsed" | "expanded"

export type OverlayLogicalSize = WindowSize

export type OverlayWindowState = {
  size: OverlayPhysicalSize
  position: OverlayPhysicalPosition
  scaleFactor: number
}

export type AnchoredOverlayGeometry = {
  size: OverlayPhysicalSize
  position: OverlayPhysicalPosition
  centerX: number
}

export interface OverlayWindowAdapter {
  innerSize(): Promise<OverlayPhysicalSize>
  innerPosition(): Promise<OverlayPhysicalPosition>
  scaleFactor(): Promise<number>
  primaryMonitor(): Promise<OverlayDisplayMetrics | null>
  /**
   * Constrains the native window to the last applied physical size without
   * relying on GTK's `resizable: false` natural-size behavior.
   */
  setSizeConstraints?: (size: OverlayPhysicalSize | null) => Promise<void>
  setSize(size: OverlayPhysicalSize): Promise<void>
  setPosition(position: OverlayPhysicalPosition): Promise<void>
  show(): Promise<void>
  hide(): Promise<void>
  subscribeToDisplayChanges(
    listener: () => void,
  ): Promise<OverlayWindowUnlisten>
}

type OverlayTargetOptions = {
  focusState?: "idle" | "running" | "paused"
  minimalMode?: boolean
  showTimeline?: boolean
  measuredVisualHeight?: number
  verticalGutter?: number
}

function isFinitePositive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0
}

function isFiniteNonNegative(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0
}

function safeScaleFactor(scaleFactor: number) {
  return isFinitePositive(scaleFactor) ? scaleFactor : 1
}

export function getCollapsedOverlayLogicalSize({
  focusState = "running",
  minimalMode = false,
  showTimeline = true,
}: Pick<
  OverlayTargetOptions,
  "focusState" | "minimalMode" | "showTimeline"
> = {}) {
  if (focusState === "idle") {
    return { ...OVERLAY_WINDOW_SIZES.idle }
  }

  const width = minimalMode
    ? OVERLAY_WINDOW_SIZES.minimal.width
    : OVERLAY_WINDOW_SIZES.collapsed.width
  const height = showTimeline
    ? OVERLAY_WINDOW_SIZES.collapsed.height
    : OVERLAY_WINDOW_SIZES.timelineOff.height

  return { width, height }
}

export function getExpandedDashboardLogicalSize(
  measuredVisualHeight?: number,
  verticalGutter = OVERLAY_VERTICAL_GUTTER,
): OverlayLogicalSize {
  const visualHeight = isFinitePositive(measuredVisualHeight)
    ? Math.max(measuredVisualHeight, EXPANDED_DASHBOARD_SIZE.minHeight)
    : EXPANDED_DASHBOARD_SIZE.minHeight
  const safeVerticalGutter = isFiniteNonNegative(verticalGutter)
    ? verticalGutter
    : OVERLAY_VERTICAL_GUTTER

  return {
    width: EXPANDED_DASHBOARD_SIZE.width,
    height: visualHeight + safeVerticalGutter * 2,
  }
}

export function getOverlayTargetLogicalSize(
  presentationMode: OverlayPresentationMode,
  options: OverlayTargetOptions = {},
): OverlayLogicalSize {
  if (presentationMode === "expanded") {
    return getExpandedDashboardLogicalSize(
      options.measuredVisualHeight,
      options.verticalGutter,
    )
  }

  return getCollapsedOverlayLogicalSize(options)
}

export function logicalSizeToPhysical(
  size: OverlayLogicalSize,
  scaleFactor: number,
): OverlayPhysicalSize {
  const safeSize = {
    width: isFinitePositive(size.width)
      ? size.width
      : OVERLAY_WINDOW_SIZES.collapsed.width,
    height: isFinitePositive(size.height)
      ? size.height
      : OVERLAY_WINDOW_SIZES.collapsed.height,
  }
  const scale = safeScaleFactor(scaleFactor)

  return {
    width: safeSize.width * scale,
    height: safeSize.height * scale,
  }
}

export function calculateAnchoredGeometry(
  current: Pick<OverlayWindowState, "size" | "position">,
  targetLogicalSize: OverlayLogicalSize,
  scaleFactor: number,
): AnchoredOverlayGeometry {
  const targetSize = logicalSizeToPhysical(targetLogicalSize, scaleFactor)
  const currentX = Number.isFinite(current.position.x) ? current.position.x : 0
  const currentY = Number.isFinite(current.position.y) ? current.position.y : 0
  const currentWidth = isFinitePositive(current.size.width)
    ? current.size.width
    : targetSize.width
  const centerX = currentX + currentWidth / 2

  return {
    size: targetSize,
    position: {
      x: centerX - targetSize.width / 2,
      y: currentY,
    },
    centerX,
  }
}

export async function readOverlayWindowState(
  adapter: OverlayWindowAdapter,
): Promise<OverlayWindowState> {
  const [size, position, scaleFactor] = await Promise.all([
    adapter.innerSize(),
    adapter.innerPosition(),
    adapter.scaleFactor(),
  ])

  return { size, position, scaleFactor }
}

export async function readOverlayDisplayMetrics(
  adapter: OverlayWindowAdapter,
): Promise<OverlayDisplayMetrics | null> {
  try {
    return await adapter.primaryMonitor()
  } catch {
    return null
  }
}

export type OverlayWindowUnlisten = () => void

export {
  createTauriOverlayWindowAdapter,
  OVERLAY_DISPLAY_POLL_INTERVAL_MS,
} from "./overlay-window-adapter"
export type { TauriOverlayWindowAdapterOptions } from "./overlay-window-adapter"

export type OverlayWindowGeometry = Pick<
  AnchoredOverlayGeometry,
  "size" | "position"
>

export type OverlayWindowOperationQueue = {
  enqueue(geometry: OverlayWindowGeometry): void
  cancelPending(): void
  whenIdle(): Promise<void>
}

export function createOverlayWindowOperationQueue(
  adapter: OverlayWindowAdapter,
): OverlayWindowOperationQueue {
  let active = false
  let pending: OverlayWindowGeometry | null = null
  let idleResolvers: Array<() => void> = []

  function resolveIdle() {
    if (active || pending) {
      return
    }

    const resolvers = idleResolvers
    idleResolvers = []
    resolvers.forEach((resolve) => resolve())
  }

  async function drain() {
    active = true

    while (pending) {
      const geometry = pending
      pending = null

      if (adapter.setSizeConstraints) {
        try {
          await adapter.setSizeConstraints(null)
        } catch {
          // A native capability failure should not break the React surface.
        }
      }

      try {
        await adapter.setSize(geometry.size)
      } catch {
        // A native resize failure should not break the React surface.
      }

      try {
        await adapter.setPosition(geometry.position)
      } catch {
        // A native position failure should not break the React surface.
      }

      if (adapter.setSizeConstraints) {
        try {
          await adapter.setSizeConstraints(geometry.size)
        } catch {
          // A native capability failure should not break the React surface.
        }
      }
    }

    active = false
    resolveIdle()
  }

  return {
    enqueue(geometry) {
      pending = {
        size: { ...geometry.size },
        position: { ...geometry.position },
      }

      if (!active) {
        void drain()
      }
    },
    cancelPending() {
      pending = null
      resolveIdle()
    },
    whenIdle() {
      if (!active && !pending) {
        return Promise.resolve()
      }

      return new Promise<void>((resolve) => {
        idleResolvers.push(resolve)
      })
    },
  }
}
