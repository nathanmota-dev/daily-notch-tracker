import { PauseIcon, PlayIcon } from "../icons"
import type { DragEvent, KeyboardEvent } from "react"
import type { FocusSnapshot, Task } from "../lib/desktopApi"
import { Checkbox } from "./ui/checkbox"
import { DragHandle } from "./drag-handle"
import { IconButton } from "./icon-button"
import { formatTaskDuration } from "./expanded-dashboard-model"

export type CompactTaskRowProps = {
  task: Task
  focus: FocusSnapshot
  onToggleTask: (taskId: string, isDone: boolean) => void
  onToggleFocus: (taskId: string) => void
  onReorderStart: (taskId: string) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDrop: (event: DragEvent<HTMLElement>) => void
  onOpenTask: (taskId: string) => void
  busy?: boolean
}

function TaskBody({
  busy,
  onOpenTask,
  task,
}: Pick<CompactTaskRowProps, "busy" | "onOpenTask" | "task">) {
  const isBusy = busy ?? false

  return (
    <div
      aria-label={"Open details for " + task.title}
      aria-disabled={isBusy || undefined}
      className="expanded-task-row__body"
      data-slot="task-body"
      onClick={() => {
        if (!isBusy) {
          onOpenTask(task.id)
        }
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (isBusy) {
          return
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpenTask(task.id)
        }
      }}
      role="button"
      tabIndex={isBusy ? -1 : 0}
    >
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
  )
}

export function CompactTaskRow({
  busy,
  focus,
  onDragEnd,
  onDragOver,
  onDrop,
  onOpenTask,
  onReorderStart,
  onToggleFocus,
  onToggleTask,
  task,
}: CompactTaskRowProps) {
  const isBusy = busy ?? false
  const canFocus = !task.isDone
  const isFocused =
    canFocus && focus.activeTaskId === task.id && focus.state !== "idle"
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
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <DragHandle
        disabled={isBusy}
        onReorderEnd={onDragEnd}
        onReorderStart={onReorderStart}
        taskId={task.id}
        taskTitle={task.title}
      />

      <Checkbox
        aria-label={
          task.isDone
            ? "Mark " + task.title + " as incomplete"
            : "Mark " + task.title + " as complete"
        }
        checked={task.isDone}
        disabled={isBusy}
        onCheckedChange={(checked) => {
          if (typeof checked === "boolean") {
            onToggleTask(task.id, checked)
          }
        }}
      />

      <TaskBody busy={isBusy} onOpenTask={onOpenTask} task={task} />

      <IconButton
        aria-label={focusActionLabel}
        className="expanded-task-row__focus-button"
        data-slot="task-focus-toggle"
        disabled={isBusy || !canFocus}
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
