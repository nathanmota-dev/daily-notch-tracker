import { useId, type ComponentPropsWithoutRef } from "react"

import { cn } from "../lib/utils"
import { clampProgress } from "./progress"

const PROGRESS_PATH =
  "M 2 26 V 74 A 24 24 0 0 0 26 98 H 74 A 24 24 0 0 0 98 74 V 26"

export type ProgressTrayProps = ComponentPropsWithoutRef<"div"> & {
  progress: number
  showTimeline?: boolean
  rainbowTimeline?: boolean
}

function ProgressPath({
  className,
  ...props
}: React.SVGProps<SVGPathElement>) {
  return (
    <path
      className={className}
      d={PROGRESS_PATH}
      fill="none"
      pathLength={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
      {...props}
    />
  )
}

export function ProgressTray({
  children,
  className,
  progress,
  rainbowTimeline = false,
  showTimeline = true,
  "aria-label": ariaLabel,
  ...props
}: ProgressTrayProps) {
  const clampedProgress = clampProgress(progress)
  const progressPercentage = Number((clampedProgress * 100).toFixed(2))
  const gradientId = `progress-tray-gradient-${useId().replace(/:/g, "")}`
  const rainbowEnabled = showTimeline && rainbowTimeline

  return (
    <div
      {...props}
      className={cn("progress-tray", className)}
      data-rainbow={rainbowEnabled ? "on" : "off"}
      data-progress={clampedProgress}
      data-slot="progress-tray"
      data-timeline={showTimeline ? "on" : "off"}
    >
      {children}

      {showTimeline && (
        <svg
          aria-label={ariaLabel ?? "Progresso do foco"}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progressPercentage}
          aria-valuetext={`${progressPercentage}%`}
          className="progress-tray__timeline"
          data-slot="progress-tray-timeline"
          focusable="false"
          preserveAspectRatio="none"
          role="progressbar"
          viewBox="0 0 100 100"
        >
          {rainbowEnabled && (
            <defs>
              <linearGradient
                id={gradientId}
                x1="0%"
                x2="100%"
                y1="0%"
                y2="0%"
              >
                <stop offset="0%" stopColor="var(--progress-rgb-start)" />
                <stop offset="50%" stopColor="var(--progress-rgb-middle)" />
                <stop offset="100%" stopColor="var(--progress-rgb-end)" />
              </linearGradient>
            </defs>
          )}

          <ProgressPath
            className="progress-tray__track"
            data-slot="progress-tray-track"
            stroke="var(--progress-track)"
          />
          <ProgressPath
            className={cn(
              "progress-tray__fill",
              rainbowEnabled && "progress-tray__fill--rainbow",
            )}
            data-rainbow={rainbowEnabled ? "on" : "off"}
            data-slot="progress-tray-fill"
            stroke={
              rainbowEnabled
                ? `url(#${gradientId})`
                : "var(--progress-fill)"
            }
            strokeDasharray="1"
            strokeDashoffset={1 - clampedProgress}
          />
        </svg>
      )}
    </div>
  )
}
