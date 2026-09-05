import { ClockIcon, FlameIcon, PauseIcon } from "../icons"
import { cn } from "../lib/utils"
import { getActivitySummary } from "./activity-model"
import { CollapsedNotch } from "./collapsed-notch"
import { ProgressTray } from "./progress-tray"
import {
  deriveCollapsedFocusPresentation,
  formatFocusTime,
  getIdleFocusRemainingMs,
  READY_FOCUS_TITLE,
} from "./collapsed-focus"
import { selectTasksForDashboard } from "./expanded-dashboard-model"
import { useFocusCountdown } from "./use-focus-countdown"
import type {
  CollapsedFocusContentProps,
  CollapsedFocusWidgetProps,
} from "./collapsed-focus-widget-types"

export type { CollapsedFocusWidgetProps } from "./collapsed-focus-widget-types"

function CollapsedFocusContent({
  isPaused,
  remainingMs,
  streak,
  title,
}: CollapsedFocusContentProps) {
  return (
    <div
      className="relative z-[1] flex h-full w-full items-center gap-3 px-5"
      data-slot="collapsed-focus-widget-content"
    >
      <div className="inline-flex min-w-[6.75rem] flex-[0_0_6.75rem] items-center gap-2 text-[var(--progress-fill)]">
        <ClockIcon aria-hidden="true" className="size-4 shrink-0" />
        <time
          aria-label={`${formatFocusTime(remainingMs)} restantes`}
          className="inline-block min-w-[5ch] whitespace-nowrap font-mono text-[1.15rem] font-bold tabular-nums leading-none tracking-[0.03em]"
          data-slot="focus-timer"
          role="timer"
        >
          {formatFocusTime(remainingMs)}
        </time>
        {isPaused && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-flex items-center justify-center"
            data-slot="focus-paused-indicator"
          >
            <PauseIcon className="size-3.5" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-[1_1_auto] overflow-hidden">
        <span
          aria-label={title}
          className="block overflow-hidden text-ellipsis whitespace-nowrap text-[0.78rem] font-semibold text-content"
          data-slot="focus-task-title"
          title={title}
        >
          {title}
        </span>
      </div>

      <div
        aria-label={`Journey Streak: ${streak} ${streak === 1 ? "day" : "days"}`}
        className="inline-flex min-w-[3.25rem] shrink-0 items-center justify-end gap-1.5 border-l border-white/[0.12] pl-3 text-accent"
        data-slot="peek-streak"
      >
        <FlameIcon aria-hidden="true" className="size-4" />
        <strong
          className="text-[0.78rem] font-bold tabular-nums leading-none"
          data-slot="peek-streak-count"
        >
          {streak}d
        </strong>
      </div>
    </div>
  )
}

export function CollapsedFocusWidget({
  className,
  focus,
  now: controlledNow,
  sessions = [],
  settings,
  tasks = [],
  visible = true,
}: CollapsedFocusWidgetProps) {
  const { now } = useFocusCountdown(focus, { now: controlledNow })
  const presentation = deriveCollapsedFocusPresentation(focus, settings, now)
  const nextTask = selectTasksForDashboard(tasks, now).find(
    (task) => !task.isDone,
  )
  const remainingMs = presentation.isVisible
    ? presentation.remainingMs
    : getIdleFocusRemainingMs(
        settings.focusMinutes,
        nextTask?.estimateMinutes,
      )
  const title = presentation.isVisible
    ? presentation.title
    : nextTask?.title ?? READY_FOCUS_TITLE
  const { streak } = getActivitySummary(sessions, now)

  if (!visible) {
    return (
      <div
        className={cn(
          "flex h-[var(--collapsed-notch-height)] w-full items-start justify-center",
          className,
        )}
        data-mode="idle"
        data-slot="collapsed-focus-widget"
        data-state="idle"
        data-timeline="off"
      >
        <CollapsedNotch />
      </div>
    )
  }

  const isPaused = presentation.state === "paused"
  const isIdle = presentation.state === "idle"

  return (
    <div
      aria-label={
        isIdle ? "Focus ready" : isPaused ? "Foco pausado" : "Foco em andamento"
      }
      className={cn(
        "min-w-0 overflow-hidden rounded-pill bg-[var(--collapsed-widget-background)] text-content",
        "h-[var(--collapsed-widget-height)] w-[min(var(--collapsed-widget-width),calc(100vw-8px))]",
        !presentation.showTimeline && "h-[var(--collapsed-widget-height-off)]",
        presentation.mode === "minimal" &&
          "w-[min(var(--collapsed-widget-minimal-width),calc(100vw-8px))]",
        isPaused && "[--progress-fill:var(--danger)]",
        presentation.mode === "rgb" && "shadow-rgb-glow",
        className,
      )}
      data-mode={presentation.mode}
      data-slot="collapsed-focus-widget"
      data-state={presentation.state}
      data-timeline={presentation.showTimeline ? "on" : "off"}
      role="group"
    >
      <ProgressTray
        aria-label="Progresso do foco"
        className="h-full min-h-0"
        progress={presentation.progress}
        rainbowTimeline={presentation.rainbowTimeline}
        showTimeline={presentation.showTimeline}
      >
        {presentation.mode !== "minimal" && (
          <CollapsedFocusContent
            isPaused={isPaused}
            remainingMs={remainingMs}
            streak={streak}
            title={title}
          />
        )}
      </ProgressTray>
    </div>
  )
}
