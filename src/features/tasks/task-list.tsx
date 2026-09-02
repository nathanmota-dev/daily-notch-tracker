import type { DragEvent } from "react"

import { PauseIcon, PlayIcon } from "../../icons"
import type { FocusSnapshot, Task } from "../../lib/desktopApi"
import { formatTaskDuration } from "./tasks-model"
import { useTaskReorder } from "../../components/use-task-reorder"
import { Checkbox } from "../../components/ui/checkbox"
import { DragHandle } from "../../components/drag-handle"
import { IconButton } from "../../components/icon-button"
import { cn } from "../../lib/utils"

export type TaskListProps = {
  tasks: readonly Task[]
  focus: FocusSnapshot
  busy: boolean
  onToggleTask: (taskId: string) => void
  onToggleFocus: (taskId: string) => void
  onOpenTask: (taskId: string) => void
  onReorder: (taskIds: string[]) => void
  onAddTask: () => void
}

type TaskRowProps = Omit<TaskListProps, "onAddTask" | "tasks" | "onReorder"> & {
  task: Task
  onReorderStart: (taskId: string) => void
  onReorderEnd: () => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDrop: (event: DragEvent<HTMLElement>) => void
}

function focusAction(task: Task, focus: FocusSnapshot) {
  const isFocused = focus.activeTaskId === task.id && focus.state !== "idle"
  if (!isFocused) {
    return { label: `Start focus for ${task.title}`, Icon: PlayIcon }
  }

  return focus.state === "paused"
    ? { label: `Resume focus for ${task.title}`, Icon: PlayIcon }
    : { label: `Pause focus for ${task.title}`, Icon: PauseIcon }
}

function TaskRow({
  busy,
  focus,
  onDragOver,
  onDrop,
  onOpenTask,
  onReorderEnd,
  onReorderStart,
  onToggleFocus,
  onToggleTask,
  task,
}: TaskRowProps) {
  const { Icon, label } = focusAction(task, focus)
  const canFocus = !task.isDone

  return (
    <article
      className="grid min-h-16 grid-cols-[36px_20px_minmax(0,1fr)_36px] items-center gap-2 rounded-card border border-border bg-panel p-[8px_12px_8px_0] transition-[background-color,border-color] duration-150 hover:border-border-strong hover:bg-panel-hover"
      data-completed={task.isDone ? "true" : "false"}
      data-slot="tasks-task-row"
      data-task-id={task.id}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <DragHandle
        disabled={busy}
        onReorderEnd={onReorderEnd}
        onReorderStart={onReorderStart}
        taskId={task.id}
        taskTitle={task.title}
      />
      <Checkbox
        aria-label={
          task.isDone
            ? `Mark ${task.title} as incomplete`
            : `Mark ${task.title} as complete`
        }
        checked={task.isDone}
        disabled={busy}
        onCheckedChange={(checked) => {
          if (typeof checked === "boolean") {
            onToggleTask(task.id)
          }
        }}
      />
      <button
        aria-label={`Open details for ${task.title}`}
        className="min-w-0 cursor-pointer border-0 bg-transparent py-1 text-left text-inherit outline-none focus-visible:rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        disabled={busy}
        onClick={() => onOpenTask(task.id)}
        type="button"
      >
        <span
          className={cn(
            "block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.95rem] font-[650]",
            task.isDone && "text-muted line-through",
          )}
        >
          {task.title}
        </span>
        <span
          className={cn(
            "mt-1 block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.75rem] text-muted",
            task.isDone && "opacity-70",
          )}
        >
          <span>{task.notes || "No note"}</span>
          <span aria-hidden="true" className="inline-block px-1.5">
            ·
          </span>
          <span>{formatTaskDuration(task.estimateMinutes)}</span>
        </span>
      </button>
      <IconButton
        aria-label={label}
        className="text-accent"
        disabled={busy || !canFocus}
        onClick={() => onToggleFocus(task.id)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Icon aria-hidden="true" />
      </IconButton>
    </article>
  )
}

export function TaskList({
  busy,
  focus,
  onAddTask,
  onOpenTask,
  onReorder,
  onToggleFocus,
  onToggleTask,
  tasks,
}: TaskListProps) {
  const taskIds = tasks.map((task) => task.id)
  const {
    handleDragOver,
    handleDrop,
    onReorderEnd,
    onReorderStart,
  } = useTaskReorder({ disabled: busy, onReorder, taskIds })

  if (tasks.length === 0) {
    return (
      <button
        aria-label="Add your first task"
        className="flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-border-strong bg-white/[0.02] p-6 text-muted outline-none focus-visible:rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        disabled={busy}
        onClick={onAddTask}
        type="button"
      >
        <span className="sr-only">Nenhuma tarefa ainda.</span>
        <span className="font-[650] text-content">No tasks in this list</span>
        <span className="text-[0.8rem]">Add a task to get started.</span>
      </button>
    )
  }

  return (
    <div className="grid gap-2" data-slot="tasks-task-list">
      {tasks.map((task) => (
        <TaskRow
          busy={busy}
          focus={focus}
          key={task.id}
          onDragOver={handleDragOver}
          onDrop={(event) => handleDrop(event, task.id)}
          onOpenTask={onOpenTask}
          onReorderEnd={onReorderEnd}
          onReorderStart={onReorderStart}
          onToggleFocus={onToggleFocus}
          onToggleTask={onToggleTask}
          task={task}
        />
      ))}
    </div>
  )
}
