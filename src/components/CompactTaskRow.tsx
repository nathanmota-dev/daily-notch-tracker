import { PauseIcon, PlayIcon } from "../icons"
import type { FocusSnapshot, Task } from "../lib/desktopApi"
import { Checkbox } from "./ui/checkbox"
import { DragHandle } from "./DragHandle"
import { IconButton } from "./IconButton"
import { formatTaskDuration } from "./expandedDashboard"

export type CompactTaskRowProps = {
  task: Task
  focus: FocusSnapshot
  onToggleTask: (taskId: string, isDone: boolean) => void
  onToggleFocus: (taskId: string) => void
  onReorderStart: (taskId: string) => void
}

export function CompactTaskRow({
  focus,
  onReorderStart,
  onToggleFocus,
  onToggleTask,
  task,
}: CompactTaskRowProps) {
  const isFocused =
    focus.activeTaskId === task.id && focus.state !== "idle"
  const focusActionLabel = isFocused
    ? focus.state === "paused"
      ? "Resume focus for " + task.title
      : "Pause focus for " + task.title
    : "Start focus for " + task.title
  const FocusActionIcon =
    isFocused && focus.state === "running" ? PauseIcon : PlayIcon

  return (
    <article
      className="expanded-task-row"
      data-completed={task.isDone ? "true" : "false"}
      data-slot="compact-task-row"
      data-task-id={task.id}
    >
      <DragHandle
        onReorderStart={onReorderStart}
        taskId={task.id}
        taskTitle={task.title}
      />

      <Checkbox
        aria-label={"Mark " + task.title + " as complete"}
        checked={task.isDone}
        onCheckedChange={(checked) => {
          if (typeof checked === "boolean") {
            onToggleTask(task.id, checked)
          }
        }}
      />

      <div className="expanded-task-row__body">
        <span
          className="expanded-task-row__title"
          data-slot="task-title"
          title={task.title}
        >
          {task.title}
        </span>
        <span className="expanded-task-row__meta">
          <span data-slot="task-notes">{task.notes || "No note"}</span>
          <span aria-hidden="true" className="expanded-task-row__meta-dot">
            ·
          </span>
          <span data-slot="task-duration">
            {formatTaskDuration(task.estimateMinutes)}
          </span>
        </span>
      </div>

      <IconButton
        aria-label={focusActionLabel}
        className="expanded-task-row__focus-button"
        data-slot="task-focus-toggle"
        onClick={() => onToggleFocus(task.id)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <FocusActionIcon aria-hidden="true" />
      </IconButton>
    </article>
  )
}
