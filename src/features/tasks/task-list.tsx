import {
  CalendarIcon,
  ClockIcon,
  EditIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from "../../icons"
import type { FocusSnapshot, Task } from "../../lib/desktopApi"
import { getLocalDateString } from "../../lib/local-date"
import { formatTaskDuration } from "./tasks-model"
import { TaskReorder } from "../../components/task-reorder"
import { useSortableTask } from "../../components/use-sortable-task"
import { Checkbox } from "../../components/ui/checkbox"
import { DragHandle } from "../../components/drag-handle"
import { IconButton } from "../../components/icon-button"
import { cn } from "../../lib/utils"
import { stopTaskReorder } from "../../components/task-reorder-events"

export type TaskListProps = {
  tasks: readonly Task[]
  focus: FocusSnapshot
  busy: boolean
  onToggleTask: (taskId: string) => void
  onToggleFocus: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  onOpenTask: (taskId: string) => void
  onReorder: (taskIds: string[]) => void
  onAddTask: () => void
}

type TaskRowProps = Omit<TaskListProps, "onAddTask" | "tasks" | "onReorder"> & {
  task: Task
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

function TaskSummary({
  busy,
  onOpenTask,
  task,
}: Pick<TaskRowProps, "busy" | "onOpenTask" | "task">) {
  return (
    <button
      aria-label={`Open details for ${task.title}`}
      className="min-w-0 cursor-pointer border-0 bg-transparent py-0 text-left text-inherit outline-none focus-visible:rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      disabled={busy}
      onClick={() => onOpenTask(task.id)}
      onKeyDown={(event) => event.stopPropagation()}
      type="button"
    >
      <span
        className={cn(
          "block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.85rem] font-semibold leading-[1.2]",
          task.isDone && "text-muted line-through",
        )}
      >
        {task.title}
      </span>
      <span
        className={cn(
          "mt-0.5 block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.68rem] leading-[1.2] text-muted",
          task.isDone && "opacity-70",
        )}
      >
        {task.notes || "No note"}
      </span>
    </button>
  )
}

function TaskMetadata({ task }: { task: Task }) {
  const today = getLocalDateString()

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1.5 text-[0.62rem] text-muted [&_svg]:size-2.5">
      {task.scheduledDate && (
        <span
          className="inline-flex items-center gap-1 rounded-pill bg-white/[0.08] px-3 py-1 whitespace-nowrap"
          data-slot="task-date-chip"
        >
          <CalendarIcon aria-hidden="true" />
          {task.scheduledDate === today ? "Today" : task.scheduledDate}
        </span>
      )}
      <span
        className="inline-flex items-center gap-1 rounded-pill bg-white/[0.08] px-2 py-1 whitespace-nowrap"
        data-slot="task-duration-chip"
      >
        <ClockIcon aria-hidden="true" />
        {formatTaskDuration(task.estimateMinutes).replace(" min", "m")}
      </span>
    </div>
  )
}

function TaskActions({
  busy,
  canFocus,
  label,
  onDeleteTask,
  onOpenTask,
  onToggleFocus,
  task,
  Icon,
}: Pick<
  TaskRowProps,
  "busy" | "onDeleteTask" | "onOpenTask" | "onToggleFocus" | "task"
> & { canFocus: boolean; label: string; Icon: typeof PlayIcon }) {
  return (
    <>
      <IconButton
        aria-label={label}
        className="size-8 rounded-full bg-accent p-0 text-canvas hover:bg-accent/85"
        disabled={busy || !canFocus}
        onClick={() => onToggleFocus(task.id)}
        onKeyDown={stopTaskReorder}
        onPointerDown={stopTaskReorder}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Icon aria-hidden="true" />
      </IconButton>
      <IconButton
        aria-label={`Edit ${task.title}`}
        className="size-8 rounded-full bg-panel-hover p-0 text-muted hover:bg-white/[0.12] hover:text-content"
        disabled={busy}
        onClick={() => onOpenTask(task.id)}
        onKeyDown={stopTaskReorder}
        onPointerDown={stopTaskReorder}
        size="sm"
        type="button"
        variant="ghost"
      >
        <EditIcon aria-hidden="true" />
      </IconButton>
      <IconButton
        aria-label={`Delete ${task.title}`}
        className="size-8 rounded-full bg-panel-hover p-0 text-muted hover:bg-danger/15 hover:text-danger"
        disabled={busy}
        onClick={() => onDeleteTask(task.id)}
        onKeyDown={stopTaskReorder}
        onPointerDown={stopTaskReorder}
        size="sm"
        type="button"
        variant="ghost"
      >
        <TrashIcon aria-hidden="true" />
      </IconButton>
    </>
  )
}

function TaskRow({
  busy,
  focus,
  onDeleteTask,
  onOpenTask,
  onToggleFocus,
  onToggleTask,
  task,
}: TaskRowProps) {
  const sortable = useSortableTask(task.id, busy)
  const { Icon, label } = focusAction(task, focus)
  const canFocus = !task.isDone

  return (
    <article
      {...sortable.attributes}
      className={cn(
        "group relative grid min-h-[55px] min-w-0 cursor-grab grid-cols-[20px_minmax(0,1fr)_auto_repeat(3,32px)] items-center gap-4 rounded-[11px] border border-transparent bg-panel pr-3 py-2 pl-10 transition-[background-color,border-color,box-shadow,opacity] duration-150 hover:border-border-strong hover:bg-panel-hover active:cursor-grabbing",
        sortable.isDragging &&
          "z-10 border-accent/60 bg-accent/10 opacity-90 shadow-accent-glow",
        sortable.isOver &&
          !sortable.isDragging &&
          "border-accent/60 bg-accent/10",
      )}
      data-completed={task.isDone ? "true" : "false"}
      data-dragging={sortable.isDragging ? "true" : "false"}
      data-over={sortable.isOver ? "true" : "false"}
      data-slot="tasks-task-row"
      data-task-id={task.id}
      ref={sortable.setNodeAndActivatorRef}
      style={sortable.style}
      aria-label={`Reorder ${task.title}`}
      {...sortable.listeners}
    >
      <DragHandle
        className="absolute left-2 top-1/2 z-10 size-5 -translate-y-1/2 opacity-[0.001] transition-opacity group-hover:opacity-100"
        interactive={false}
        taskTitle={task.title}
      />
      <Checkbox
        aria-label={
          task.isDone
            ? `Mark ${task.title} as incomplete`
            : `Mark ${task.title} as complete`
        }
        className="size-5 rounded-full"
        checked={task.isDone}
        disabled={busy}
        onKeyDown={stopTaskReorder}
        onPointerDown={stopTaskReorder}
        onCheckedChange={(checked) => {
          if (typeof checked === "boolean") {
            onToggleTask(task.id)
          }
        }}
      />
      <TaskSummary busy={busy} onOpenTask={onOpenTask} task={task} />
      <TaskMetadata task={task} />
      <TaskActions
        Icon={Icon}
        busy={busy}
        canFocus={canFocus}
        label={label}
        onDeleteTask={onDeleteTask}
        onOpenTask={onOpenTask}
        onToggleFocus={onToggleFocus}
        task={task}
      />
    </article>
  )
}

export function TaskList({
  busy,
  focus,
  onAddTask,
  onDeleteTask,
  onOpenTask,
  onReorder,
  onToggleFocus,
  onToggleTask,
  tasks,
}: TaskListProps) {
  const taskIds = tasks.map((task) => task.id)

  if (tasks.length === 0) {
    return (
      <button
        aria-label="Add your first task"
        className="flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border border-dashed border-border-strong bg-white/[0.02] p-6 text-muted outline-none focus-visible:rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
    <TaskReorder disabled={busy} onReorder={onReorder} taskIds={taskIds}>
      <div className="grid gap-2" data-slot="tasks-task-list">
        {tasks.map((task) => (
          <TaskRow
            busy={busy}
            focus={focus}
            key={task.id}
            onDeleteTask={onDeleteTask}
            onOpenTask={onOpenTask}
            onToggleFocus={onToggleFocus}
            onToggleTask={onToggleTask}
            task={task}
          />
        ))}
      </div>
    </TaskReorder>
  )
}
