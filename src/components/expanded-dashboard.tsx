import type { AppSnapshot, DesktopApiError } from "../lib/desktopApi"
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
  onAddTask: () => void
  onOpenTasks: () => void
  onOpenTask: (taskId: string) => void
  onReorder: (taskIds: string[]) => void
}

export type ExpandedDashboardProps = {
  snapshot: AppSnapshot
  className?: string
  busy?: boolean
  dashboardError?: DesktopApiError | null
  now?: Date | number
} & Partial<ExpandedDashboardCallbacks>

const noop = () => undefined
const noopTask = (taskId: string) => void taskId
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
  dashboardError = null,
  now,
  snapshot,
}: ExpandedDashboardProps) {
  const countdown = useFocusCountdown(snapshot.focus, { now })
  const orderedTasks = selectTasksForDashboard(snapshot.tasks, countdown.now)
  const activity = getActivitySummary(snapshot.sessions, countdown.now)

  return (
    <ProgressTray
      aria-label="Focus timeline"
      className={cn("expanded-dashboard", className)}
      data-focus-state={snapshot.focus.state}
      data-slot="expanded-dashboard-tray"
      progress={getExpandedDashboardProgress(snapshot.focus, countdown.now)}
      rainbowTimeline={snapshot.settings.rainbowTimeline}
      showTimeline
    >
      <Panel
        aria-label="Expanded dashboard"
        className="expanded-dashboard__panel"
        data-dashboard-state={snapshot.focus.state}
        data-slot="expanded-dashboard"
        role="region"
      >
        <div className="expanded-dashboard__grid">
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
    </ProgressTray>
  )
}
