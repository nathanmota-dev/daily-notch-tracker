import { PauseIcon, PlayIcon } from "../icons"
import type { KeyboardEvent } from "react"
import type { FocusSnapshot, Task } from "../lib/desktopApi"
import { Checkbox } from "./ui/checkbox"
import { DragHandle } from "./drag-handle"
import { IconButton } from "./icon-button"
import { formatTaskDuration } from "./expanded-dashboard-model"
import { cn } from "../lib/utils"
import { stopTaskReorder } from "./task-reorder-events"
import { useSortableTask } from "./use-sortable-task"

export type CompactTaskRowProps = {
  task: Task
  focus: FocusSnapshot
  onToggleTask: (taskId: string, isDone: boolean) => void
  onToggleFocus: (taskId: string) => void
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
      className="min-w-0 cursor-pointer overflow-hidden rounded-control text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
      data-slot="task-body"
      onClick={() => {
        if (!isBusy) {
          onOpenTask(task.id)
        }
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        stopTaskReorder(event)

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
        className={cn(
          "block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.79rem] font-semibold leading-[1.25] text-content",
          task.isDone &&
            "text-muted line-through decoration-[rgb(161_161_170_/_0.7)]",
        )}
        data-slot="task-title"
        title={task.title}
      >
        {task.title}
      </span>
      <span
        className={cn(
          "mt-0.5 block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.67rem] leading-[1.15] text-muted",
          task.isDone && "text-[rgb(161_161_170_/_0.65)]",
        )}
      >
        <span data-slot="task-notes">{task.notes || "No note"}</span>
        <span aria-hidden="true" className="inline-block px-1">
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
  onOpenTask,
  onToggleFocus,
  onToggleTask,
  task,
}: CompactTaskRowProps) {
  const isBusy = busy ?? false
  const sortable = useSortableTask(task.id, isBusy)
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
      {...sortable.attributes}
      className={cn(
        "grid min-h-[var(--expanded-task-row-height)] min-w-0 cursor-grab grid-cols-[32px_20px_minmax(0,1fr)_32px] items-center gap-2.5 rounded-control bg-white/[0.035] p-[0_4px_0_0] transition-[background-color,border-color,box-shadow,opacity] duration-150 hover:bg-white/[0.075] active:cursor-grabbing",
        sortable.isDragging &&
          "z-10 border border-accent/60 bg-accent/15 opacity-90 shadow-accent-glow",
        sortable.isOver &&
          !sortable.isDragging &&
          "border border-accent/60 bg-accent/10",
      )}
      data-completed={task.isDone ? "true" : "false"}
      data-dragging={sortable.isDragging ? "true" : "false"}
      data-over={sortable.isOver ? "true" : "false"}
      data-slot="compact-task-row"
      data-task-id={task.id}
      ref={sortable.setNodeAndActivatorRef}
      style={sortable.style}
      aria-label={`Reorder ${task.title}`}
      {...sortable.listeners}
    >
      <DragHandle
        interactive={false}
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
        onKeyDown={stopTaskReorder}
        onPointerDown={stopTaskReorder}
        onCheckedChange={(checked) => {
          if (typeof checked === "boolean") {
            onToggleTask(task.id, checked)
          }
        }}
      />

      <TaskBody busy={isBusy} onOpenTask={onOpenTask} task={task} />

      <IconButton
        aria-label={focusActionLabel}
        className="text-accent"
        data-slot="task-focus-toggle"
        disabled={isBusy || !canFocus}
        onClick={() => onToggleFocus(task.id)}
        onKeyDown={stopTaskReorder}
        onPointerDown={stopTaskReorder}
        size="sm"
        type="button"
        variant="ghost"
      >
        <FocusActionIcon aria-hidden="true" />
      </IconButton>
    </article>
  )
}
