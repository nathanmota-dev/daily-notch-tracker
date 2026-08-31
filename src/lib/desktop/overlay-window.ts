import {
  getCurrentWindow,
  PhysicalPosition as TauriPhysicalPosition,
  PhysicalSize as TauriPhysicalSize,
  type Window as TauriWindow,
} from "@tauri-apps/api/window"

export const OVERLAY_WINDOW_SIZES = {
  collapsed: { width: 360, height: 72 },
  minimal: { width: 104, height: 72 },
  timelineOff: { width: 360, height: 52 },
} as const

export const EXPANDED_DASHBOARD_SIZE = {
  width: 620,
  minHeight: 190,
} as const

export const OVERLAY_VERTICAL_GUTTER = 8
export const OVERLAY_RESIZE_DURATION_MS = 240

export type OverlayPresentationMode = "collapsed" | "expanded"

export type OverlayLogicalSize = {
  width: number
  height: number
}

export type OverlayPhysicalSize = {
  width: number
  height: number
}

export type OverlayPhysicalPosition = {
  x: number
  y: number
}

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
  setSize(size: OverlayPhysicalSize): Promise<void>
  setPosition(position: OverlayPhysicalPosition): Promise<void>
}

type OverlayTargetOptions = {
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
  minimalMode = false,
  showTimeline = true,
}: Pick<OverlayTargetOptions, "minimalMode" | "showTimeline"> = {}) {
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

type TauriWindowAdapter = Pick<
  TauriWindow,
  "innerSize" | "innerPosition" | "scaleFactor" | "setSize" | "setPosition"
>

export function createTauriOverlayWindowAdapter(
  appWindow: TauriWindowAdapter = getCurrentWindow(),
): OverlayWindowAdapter {
  return {
    innerSize: async () => {
      const size = await appWindow.innerSize()
      return { width: size.width, height: size.height }
    },
    innerPosition: async () => {
      const position = await appWindow.innerPosition()
      return { x: position.x, y: position.y }
    },
    scaleFactor: () => appWindow.scaleFactor(),
    setSize: (size) =>
      appWindow.setSize(new TauriPhysicalSize(size.width, size.height)),
    setPosition: (position) =>
      appWindow.setPosition(
        new TauriPhysicalPosition(position.x, position.y),
      ),
  }
}

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
