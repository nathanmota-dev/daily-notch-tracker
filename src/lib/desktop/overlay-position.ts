export const OVERLAY_PANEL_MARGIN = 6
export const OVERLAY_PANEL_HEIGHT = 32

export type OverlayPhysicalPosition = {
  x: number
  y: number
}

export type OverlayPhysicalSize = {
  width: number
  height: number
}

export type OverlayWorkArea = {
  position: OverlayPhysicalPosition
  size: OverlayPhysicalSize
}

export type OverlayDisplayMetrics = {
  name?: string
  position: OverlayPhysicalPosition
  size: OverlayPhysicalSize
  scaleFactor: number
  workArea?: OverlayWorkArea
}

export type OverlayPositionOptions = {
  panelHeight?: number
  margin?: number
}

type OverlayPositionArguments = OverlayPositionOptions | number

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined
}

function readPosition(value: unknown): OverlayPhysicalPosition | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const x = readFiniteNumber(value.x)
  const y = readFiniteNumber(value.y)

  return x === undefined || y === undefined ? undefined : { x, y }
}

function readPositiveSize(value: unknown): OverlayPhysicalSize | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const width = readFiniteNumber(value.width)
  const height = readFiniteNumber(value.height)

  return width === undefined || height === undefined || width <= 0 || height <= 0
    ? undefined
    : { width, height }
}

function readWorkArea(value: unknown): OverlayWorkArea | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const position = readPosition(value.position)
  const size = readPositiveSize(value.size)

  return position && size ? { position, size } : undefined
}

function safeNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function safeNonNegativeOption(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : fallback
}

function safeScaleFactor(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1
}

function roundPixel(value: number) {
  const rounded = Math.round(value)
  return Object.is(rounded, -0) ? 0 : rounded
}

function clamp(value: number, minimum: number, maximum: number) {
  if (maximum < minimum) {
    return minimum
  }

  return Math.min(Math.max(value, minimum), maximum)
}

/**
 * Converts the Tauri monitor shape into finite physical display metrics.
 * An incomplete monitor is unavailable for placement; an incomplete work area
 * is intentionally ignored so the monitor bounds and panel fallback remain
 * usable.
 */
export function normalizeOverlayDisplayMetrics(
  monitor: unknown,
): OverlayDisplayMetrics | null {
  if (!isRecord(monitor)) {
    return null
  }

  const position = readPosition(monitor.position)
  const size = readPositiveSize(monitor.size)

  if (!position || !size) {
    return null
  }

  const rawScaleFactor = readFiniteNumber(monitor.scaleFactor)
  const scaleFactor =
    rawScaleFactor !== undefined && rawScaleFactor > 0 ? rawScaleFactor : 1
  const workArea = readWorkArea(monitor.workArea)
  const name = typeof monitor.name === "string" ? monitor.name : undefined
  const normalizedMetrics = {
    position,
    size,
    scaleFactor,
    ...(name === undefined ? {} : { name }),
  }

  return workArea
    ? { ...normalizedMetrics, workArea }
    : normalizedMetrics
}

/**
 * Returns a stable key for comparing normalized display metrics between polls.
 */
export function getOverlayDisplayMetricsKey(
  metrics: OverlayDisplayMetrics | null,
) {
  if (!metrics) {
    return "unavailable"
  }

  const workArea = metrics.workArea

  return [
    metrics.position.x,
    metrics.position.y,
    metrics.size.width,
    metrics.size.height,
    metrics.scaleFactor,
    metrics.name ?? "none",
    workArea?.position.x ?? "none",
    workArea?.position.y ?? "none",
    workArea?.size.width ?? "none",
    workArea?.size.height ?? "none",
  ].join(":")
}

/**
 * Centers the overlay on the primary monitor and places it below the desktop
 * panel using physical coordinates. The y-axis is constrained to the
 * monitor's work area when the compositor provides one.
 */
export function calculateOverlayPosition(
  monitor: OverlayDisplayMetrics,
  overlaySize: OverlayPhysicalSize,
  options: OverlayPositionArguments = {},
): OverlayPhysicalPosition {
  const normalizedMonitor = normalizeOverlayDisplayMetrics(monitor)

  if (!normalizedMonitor) {
    return { x: 0, y: 0 }
  }

  const scaleFactor =
    typeof options === "number" ? safeScaleFactor(options) : 1
  const overlayWidth = safeNonNegative(overlaySize.width * scaleFactor)
  const overlayHeight = safeNonNegative(overlaySize.height * scaleFactor)
  const margin = safeNonNegativeOption(
    typeof options === "number" ? undefined : options.margin,
    OVERLAY_PANEL_MARGIN,
  )
  const panelHeight = safeNonNegativeOption(
    typeof options === "number" ? undefined : options.panelHeight,
    OVERLAY_PANEL_HEIGHT,
  )
  const monitorLeft = normalizedMonitor.position.x
  const monitorRight = normalizedMonitor.position.x + normalizedMonitor.size.width
  const monitorTop = normalizedMonitor.position.y
  const monitorBottom = normalizedMonitor.position.y + normalizedMonitor.size.height
  const workArea = normalizedMonitor.workArea
  const workAreaTop = workArea?.position.y ?? monitorTop + panelHeight
  const workAreaBottom = workArea
    ? workArea.position.y + workArea.size.height
    : monitorBottom

  const centeredX =
    monitorLeft + (normalizedMonitor.size.width - overlayWidth) / 2
  const belowPanelY = workArea
    ? workAreaTop + margin
    : normalizedMonitor.position.y + panelHeight + margin
  const x = clamp(centeredX, monitorLeft, monitorRight - overlayWidth)
  const y = clamp(
    belowPanelY,
    workArea ? Math.max(monitorTop, workAreaTop) : monitorTop,
    Math.min(monitorBottom, workAreaBottom) - overlayHeight,
  )

  return { x: roundPixel(x), y: roundPixel(y) }
}
