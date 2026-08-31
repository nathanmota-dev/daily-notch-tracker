import {
  OVERLAY_RESIZE_DURATION_MS,
  OVERLAY_VERTICAL_GUTTER,
  type OverlayLogicalSize,
  type OverlayWindowGeometry,
  type OverlayWindowState,
} from "../lib/desktop/overlay-window"

export type ScheduledOverlayFrame = {
  cancel: () => void
}

export function overlayResizeNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now()
}

export function scheduleOverlayResizeFrame(
  callback: FrameRequestCallback,
): ScheduledOverlayFrame | null {
  if (typeof window === "undefined") {
    return null
  }

  if (typeof window.requestAnimationFrame === "function") {
    const frameId = window.requestAnimationFrame(callback)

    return {
      cancel: () => window.cancelAnimationFrame(frameId),
    }
  }

  const timeoutId = window.setTimeout(() => callback(overlayResizeNow()), 16)

  return {
    cancel: () => window.clearTimeout(timeoutId),
  }
}

export function interpolateOverlayGeometry(
  start: OverlayWindowGeometry,
  end: OverlayWindowGeometry,
  progress: number,
): OverlayWindowGeometry {
  const ease = 1 - (1 - progress) ** 3

  return {
    size: {
      width: start.size.width + (end.size.width - start.size.width) * ease,
      height: start.size.height + (end.size.height - start.size.height) * ease,
    },
    position: {
      x: start.position.x + (end.position.x - start.position.x) * ease,
      y: start.position.y + (end.position.y - start.position.y) * ease,
    },
  }
}

export function normalizeOverlayStartState(
  state: OverlayWindowState,
  destination: OverlayWindowGeometry,
): OverlayWindowState {
  return {
    scaleFactor: state.scaleFactor,
    size: {
      width:
        Number.isFinite(state.size.width) && state.size.width > 0
          ? state.size.width
          : destination.size.width,
      height:
        Number.isFinite(state.size.height) && state.size.height > 0
          ? state.size.height
          : destination.size.height,
    },
    position: {
      x: Number.isFinite(state.position.x)
        ? state.position.x
        : destination.position.x,
      y: Number.isFinite(state.position.y)
        ? state.position.y
        : destination.position.y,
    },
  }
}

function readPositiveMeasurement(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined
}

export function measureOverlayVisualHeight(
  element: HTMLElement,
  entry?: ResizeObserverEntry,
) {
  const observedHeight = readPositiveMeasurement(entry?.contentRect.height)
  if (observedHeight !== undefined) {
    return observedHeight
  }

  const rectHeight = readPositiveMeasurement(element.getBoundingClientRect().height)
  if (rectHeight !== undefined) {
    return rectHeight
  }

  return readPositiveMeasurement(element.offsetHeight)
}

export function readOverlayVerticalGutter(surface: HTMLElement) {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
    return OVERLAY_VERTICAL_GUTTER
  }

  const styles = window.getComputedStyle(surface)
  const top = Number.parseFloat(styles.paddingTop)
  const bottom = Number.parseFloat(styles.paddingBottom)

  if (!Number.isFinite(top) || !Number.isFinite(bottom) || top + bottom <= 0) {
    return OVERLAY_VERTICAL_GUTTER
  }

  return (top + bottom) / 2
}

export function getOverlayTargetKey(size: OverlayLogicalSize) {
  return `${size.width}:${size.height}`
}

export function getOverlayResizeProgress(startedAt: number, timestamp: number) {
  return Math.min(
    1,
    Math.max(0, (timestamp - startedAt) / OVERLAY_RESIZE_DURATION_MS),
  )
}
