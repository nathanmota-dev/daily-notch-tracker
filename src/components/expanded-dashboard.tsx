import type {
  AppSnapshot,
  DesktopApiError,
  TasksWindowOrigin,
} from "../lib/desktopApi"
import type { FocusSessionPickerProps } from "./focus-session-picker"
import { FocusSessionPicker } from "./focus-session-picker"
import { useOverlayHold } from "../app/use-overlay-interaction"
import { cn } from "../lib/utils"
import { ProgressTray } from "./progress-tray"
import { Panel } from "./panel"
import { ActivityPanel } from "./activity-panel"
import { getActivitySummary } from "./activity-model"
import { TodoPanel } from "./todo-panel"
import {
  getExpandedDashboardProgress,
  selectTasksForDashboard,
} from "./expanded-dashboard-model"
import { useFocusCountdown } from "./use-focus-countdown"

export type ExpandedDashboardCallbacks = {
  onToggleTask: (taskId: string, isDone: boolean) => void
  onToggleFocus: (taskId: string) => void
  onAddTask: (origin?: TasksWindowOrigin) => void
  onOpenTasks: (origin?: TasksWindowOrigin) => void
  onOpenTask: (taskId: string, origin?: TasksWindowOrigin) => void
  onReorder: (taskIds: string[]) => void
  focusSessionPicker: FocusSessionPickerProps
}

export type ExpandedDashboardProps = {
  snapshot: AppSnapshot
  className?: string
  busy?: boolean
  dashboardError?: DesktopApiError | null
  now?: Date | number
} & Partial<ExpandedDashboardCallbacks>

const noop = () => undefined
const noopTask = (taskId: string, origin?: TasksWindowOrigin) => {
  void taskId
  void origin
}
const noopReorder = (taskIds: string[]) => void taskIds

export function ExpandedDashboard({
  busy = false,
  className,
  onAddTask = noop,
  onOpenTasks = noop,
  onOpenTask = noopTask,
  onReorder = noopReorder,
  onToggleFocus = noop,
  onToggleTask = noop,
  focusSessionPicker,
  dashboardError = null,
  now,
  snapshot,
}: ExpandedDashboardProps) {
  useOverlayHold(focusSessionPicker?.open ?? false)
  const countdown = useFocusCountdown(snapshot.focus, { now })
  const orderedTasks = selectTasksForDashboard(snapshot.tasks, countdown.now)
  const activity = getActivitySummary(snapshot.sessions, countdown.now)

  return (
    <ProgressTray
      aria-label="Focus timeline"
      className={cn(
        "min-h-[var(--expanded-dashboard-min-height)] w-[var(--expanded-dashboard-width)] overflow-visible rounded-panel bg-transparent",
        className,
      )}
      data-focus-state={snapshot.focus.state}
      data-overlay-visual="expanded-dashboard"
      progress={getExpandedDashboardProgress(snapshot.focus, countdown.now)}
      rainbowTimeline={
        snapshot.settings.showTimeline && snapshot.settings.rainbowTimeline
      }
      showTimeline={snapshot.settings.showTimeline}
    >
      <Panel
        aria-label="Expanded dashboard"
        className="relative z-[1] min-h-[var(--expanded-dashboard-min-height)] w-full gap-0 rounded-panel bg-panel p-0 shadow-none"
        data-dashboard-state={snapshot.focus.state}
        data-slot="expanded-dashboard"
        role="region"
      >
        <div
          className="grid min-h-[var(--expanded-dashboard-min-height)] w-full grid-cols-[minmax(0,1fr)_var(--expanded-dashboard-activity-width)] gap-0 px-5 pb-4 pt-[18px]"
          data-slot="expanded-dashboard-grid"
        >
          <TodoPanel
            busy={busy}
            dashboardError={dashboardError}
            focus={snapshot.focus}
            onAddTask={onAddTask}
            onOpenTask={onOpenTask}
            onOpenTasks={onOpenTasks}
            onReorder={onReorder}
            onToggleFocus={onToggleFocus}
            onToggleTask={onToggleTask}
            tasks={orderedTasks}
          />
          <ActivityPanel {...activity} today={countdown.now} />
        </div>
        </Panel>
      {focusSessionPicker?.open && (
        <div className="flex justify-end px-4 pt-2">
          <FocusSessionPicker {...focusSessionPicker} />
        </div>
      )}
    </ProgressTray>
  )
}
