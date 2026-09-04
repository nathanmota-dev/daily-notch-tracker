import type {
  OverlayPhysicalPosition,
  OverlayPhysicalSize,
} from "./overlay-position"
import { TASKS_WINDOW_DIMENSIONS } from "./window-dimensions"
import type {
  WindowMonitorSnapshot,
  WindowPlacementSnapshot,
} from "./window-placement-contracts"

export const DEFAULT_EXTENDED_WINDOW_SIZE = TASKS_WINDOW_DIMENSIONS.preferred

export type WindowPlacementGeometry = {
  position: OverlayPhysicalPosition
  size: OverlayPhysicalSize
}

export type ResolvedWindowPlacement = WindowPlacementGeometry & {
  monitor: WindowMonitorSnapshot
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function positiveNumber(value: unknown): number | undefined {
  const number = finiteNumber(value)
  return number !== undefined && number > 0 ? number : undefined
}

function nonNegativeInteger(value: unknown): number | undefined {
  const number = finiteNumber(value)
  return number !== undefined && Number.isSafeInteger(number) && number >= 0
    ? number
    : undefined
}

function normalizeMonitor(value: unknown): WindowMonitorSnapshot | null {
  if (!isRecord(value)) {
    return null
  }

  const x = finiteNumber(value.x)
  const y = finiteNumber(value.y)
  const width = positiveNumber(value.width)
  const height = positiveNumber(value.height)
  const scaleFactor = positiveNumber(value.scaleFactor)

  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    scaleFactor === undefined
  ) {
    return null
  }

  return {
    name: typeof value.name === "string" ? value.name : null,
    x,
    y,
    width,
    height,
    scaleFactor,
  }
}

/**
 * Normalizes a monitor returned by Tauri or a test double into the placement
 * contract used by the restore algorithm.
 */
export function normalizeWindowMonitorSnapshot(
  value: unknown,
): WindowMonitorSnapshot | null {
  if (!isRecord(value)) {
    return null
  }

  const direct = normalizeMonitor(value)
  if (direct) {
    return direct
  }

  const position = isRecord(value.position) ? value.position : null
  const size = isRecord(value.size) ? value.size : null

  if (!position || !size) {
    return null
  }

  return normalizeMonitor({
    name: value.name,
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    scaleFactor: value.scaleFactor,
  })
}

/**
 * Rejects placement payloads that could move the native window to an
 * unbounded or non-existent location.
 */
export function normalizeWindowPlacementSnapshot(
  value: unknown,
): WindowPlacementSnapshot | null {
  if (!isRecord(value) || value.windowLabel !== "overlay") {
    return null
  }

  const revision = nonNegativeInteger(value.revision)
  const x = finiteNumber(value.x)
  const y = finiteNumber(value.y)
  const width = positiveNumber(value.width)
  const height = positiveNumber(value.height)
  const scaleFactor = positiveNumber(value.scaleFactor)
  const monitor = normalizeWindowMonitorSnapshot(value.monitor)

  if (
    revision === undefined ||
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    scaleFactor === undefined ||
    !monitor
  ) {
    return null
  }

  return {
    revision,
    windowLabel: "overlay",
    x,
    y,
    width,
    height,
    scaleFactor,
    monitor,
  }
}

function sameGeometry(
  first: WindowMonitorSnapshot,
  second: WindowMonitorSnapshot,
) {
  return (
    first.x === second.x &&
    first.y === second.y &&
    first.width === second.width &&
    first.height === second.height
  )
}

/**
 * Finds the saved display by stable name first and geometry second. Geometry
 * is the useful fallback when a compositor does not expose monitor names or
 * changes the name while keeping the display connected.
 */
export function findWindowMonitor(
  savedMonitor: WindowMonitorSnapshot,
  availableMonitors: readonly WindowMonitorSnapshot[],
): WindowMonitorSnapshot | null {
  if (savedMonitor.name !== null) {
    const namedMonitor = availableMonitors.find(
      (monitor) => monitor.name === savedMonitor.name,
    )
    if (namedMonitor) {
      return namedMonitor
    }
  }

  return (
    availableMonitors.find((monitor) => sameGeometry(monitor, savedMonitor)) ??
    null
  )
}

function clamp(value: number, minimum: number, maximum: number) {
  if (maximum < minimum) {
    return minimum
  }

  return Math.min(Math.max(value, minimum), maximum)
}

function roundPhysical(value: number) {
  const rounded = Math.round(value)
  return Object.is(rounded, -0) ? 0 : rounded
}

/** Keeps a window fully inside a monitor's physical bounds. */
export function clampWindowPosition(
  position: OverlayPhysicalPosition,
  size: OverlayPhysicalSize,
  monitor: WindowMonitorSnapshot,
): OverlayPhysicalPosition {
  return {
    x: clamp(
      position.x,
      monitor.x,
      monitor.x + monitor.width - size.width,
    ),
    y: clamp(
      position.y,
      monitor.y,
      monitor.y + monitor.height - size.height,
    ),
  }
}

function normalizeFallbackSize(
  size: OverlayPhysicalSize | undefined,
  scaleFactor = 1,
) {
  const scale = positiveNumber(scaleFactor) ?? 1
  const width =
    positiveNumber(size?.width) ?? DEFAULT_EXTENDED_WINDOW_SIZE.width * scale
  const height =
    positiveNumber(size?.height) ?? DEFAULT_EXTENDED_WINDOW_SIZE.height * scale

  return { width, height }
}

function scaledWindowSize(
  placement: WindowPlacementSnapshot,
  monitor: WindowMonitorSnapshot,
) {
  const logicalWidth = placement.width / placement.scaleFactor
  const logicalHeight = placement.height / placement.scaleFactor

  return normalizeFallbackSize(
    {
      width: logicalWidth * monitor.scaleFactor,
      height: logicalHeight * monitor.scaleFactor,
    },
    monitor.scaleFactor,
  )
}

function clampWindowSize(
  size: OverlayPhysicalSize,
  monitor: WindowMonitorSnapshot,
): OverlayPhysicalSize {
  return {
    width: Math.min(size.width, monitor.width),
    height: Math.min(size.height, monitor.height),
  }
}

function relativePosition(
  placement: WindowPlacementSnapshot,
  monitor: WindowMonitorSnapshot,
): OverlayPhysicalPosition {
  const relativeX = (placement.x - placement.monitor.x) / placement.monitor.width
  const relativeY = (placement.y - placement.monitor.y) / placement.monitor.height

  return {
    x: monitor.x + relativeX * monitor.width,
    y: monitor.y + relativeY * monitor.height,
  }
}

function firstValidMonitor(
  monitors: readonly WindowMonitorSnapshot[],
): WindowMonitorSnapshot | null {
  return monitors[0] ?? null
}

/**
 * Resolves a saved placement onto the currently available displays. The
 * saved offset and logical window size are carried across monitor geometry or
 * scale changes, then constrained to the selected monitor.
 */
export function resolveWindowPlacement(
  savedPlacement: unknown,
  availableMonitors: readonly unknown[],
  primaryMonitor: unknown,
  fallbackSize?: OverlayPhysicalSize,
): ResolvedWindowPlacement | null {
  const monitors = availableMonitors
    .map(normalizeWindowMonitorSnapshot)
    .filter((monitor): monitor is WindowMonitorSnapshot => monitor !== null)
  const primary =
    normalizeWindowMonitorSnapshot(primaryMonitor) ?? firstValidMonitor(monitors)

  if (!primary) {
    return null
  }

  const placement = normalizeWindowPlacementSnapshot(savedPlacement)
  const targetMonitor = placement
    ? findWindowMonitor(placement.monitor, monitors) ?? primary
    : primary
  const scaledSize = clampWindowSize(
    placement
      ? scaledWindowSize(placement, targetMonitor)
      : normalizeFallbackSize(fallbackSize, targetMonitor.scaleFactor),
    targetMonitor,
  )
  const size = clampWindowSize(
    {
      width: Math.max(1, roundPhysical(scaledSize.width)),
      height: Math.max(1, roundPhysical(scaledSize.height)),
    },
    targetMonitor,
  )
  const position = placement
    ? relativePosition(placement, targetMonitor)
    : { x: targetMonitor.x, y: targetMonitor.y }
  const boundedPosition = clampWindowPosition(position, size, targetMonitor)

  return {
    monitor: targetMonitor,
    size,
    position: {
      x: roundPhysical(boundedPosition.x),
      y: roundPhysical(boundedPosition.y),
    },
  }
}
