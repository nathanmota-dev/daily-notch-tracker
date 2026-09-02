import type { AppSnapshot } from "../../lib/desktopApi"
import { InlineTaskForm } from "./inline-task-form"
import { TaskForm } from "./task-form"
import { TaskList } from "./task-list"
import type {
  TaskDetailViewProps,
  TaskListAndCreateViewProps,
  TasksListViewProps,
  TasksMutationErrorProps,
  TasksSelectedListHeaderProps,
} from "./tasks-view-types"

function formatSelectedDay(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  if (!match) {
    return "Choose a day"
  }

  const date = new Date(0)
  date.setHours(12, 0, 0, 0)
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))

  return Number.isNaN(date.getTime())
    ? "Choose a day"
    : new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "long",
        weekday: "long",
        year: "numeric",
      }).format(date)
}

function focusLabel(snapshot: AppSnapshot, taskId: string) {
  const task = snapshot.tasks.find((item) => item.id === taskId)
  const isActive = snapshot.focus.activeTaskId === taskId
  const title = task?.title ?? "task"

  if (isActive && snapshot.focus.state === "paused") {
    return `Resume focus for ${title}`
  }

  if (isActive && snapshot.focus.state === "running") {
    return `Pause focus for ${title}`
  }

  return `Start focus for ${title}`
}

export function MutationError({ error }: TasksMutationErrorProps) {
  if (!error) {
    return null
  }

  return (
    <p
      className="m-0 mb-2 text-[0.74rem] leading-[1.4] text-danger"
      data-slot="tasks-error"
      role="alert"
    >
      Could not update tasks. Code: {error.code}.
    </p>
  )
}

export function SelectedListHeader({
  busy,
  date,
  onAdd,
  showAdd,
  taskCount,
}: TasksSelectedListHeaderProps) {
  return (
    <header
      className="flex shrink-0 items-start justify-between gap-4 pb-4"
      data-date={date}
      data-slot="tasks-day-header"
    >
      <div className="min-w-0">
        <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
          {date ? "Selected day" : "Task list"}
        </p>
        <h2 className="m-0 mt-1 truncate text-[1.45rem] font-bold leading-tight tracking-[-0.035em] text-content">
          {date ? "Day" : "Unscheduled"}
        </h2>
        <p className="m-0 mt-1 text-[0.78rem] text-muted" data-slot="tasks-day-title">
          {date ? formatSelectedDay(date) : "Tasks without a date"} · {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </p>
      </div>
      {showAdd && (
        <button
          aria-label="Add task"
          className="shrink-0 cursor-pointer rounded-control border border-border bg-transparent px-3 py-2 text-[0.76rem] font-semibold text-content outline-none transition-colors hover:border-border-strong hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          disabled={busy}
          onClick={onAdd}
          type="button"
        >
          Add task
        </button>
      )}
    </header>
  )
}

export function TasksListView({
  busy,
  error,
  focus,
  onAdd,
  onDeleteTask,
  onOpenTask,
  onReorder,
  onToggleFocus,
  onToggleTask,
  tasks,
}: TasksListViewProps) {
  return (
    <section
      aria-label="Tasks in selected list"
      className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1"
    >
      <MutationError error={error} />
      <TaskList
        busy={busy}
        focus={focus}
        onAddTask={onAdd}
        onDeleteTask={onDeleteTask}
        onOpenTask={onOpenTask}
        onReorder={onReorder}
        onToggleFocus={onToggleFocus}
        onToggleTask={onToggleTask}
        tasks={tasks}
      />
    </section>
  )
}

export function TaskDetailView({
  actions,
  draftController,
  mutations,
  routing,
  snapshot,
}: TaskDetailViewProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <MutationError error={mutations.error} />
      <TaskForm
        busy={mutations.busy}
        draft={draftController.draft}
        errors={draftController.draftErrors}
        focusActionLabel={
          routing.selectedTaskId
            ? focusLabel(snapshot, routing.selectedTaskId)
            : undefined
        }
        mode="edit"
        onCancel={actions.backToList}
        onChange={actions.updateDraft}
        onDelete={actions.deleteSelectedTask}
        onDoneChange={(isDone) =>
          draftController.setDraft((current) => ({ ...current, isDone }))
        }
        onFocus={
          routing.selectedTaskId
            ? () => actions.toggleFocus(routing.selectedTaskId!)
            : undefined
        }
        onSubmit={actions.saveDraft}
        titleRef={draftController.titleRef}
      />
    </div>
  )
}

export function TaskListAndCreateView({
  actions,
  draftController,
  isCreate,
  mutations,
  selectedTasks,
  snapshot,
}: TaskListAndCreateViewProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3">
      <TasksListView
        busy={mutations.busy}
        error={mutations.error}
        focus={snapshot.focus}
        onAdd={actions.openAdd}
        onDeleteTask={actions.deleteTask}
        onOpenTask={actions.openTask}
        onReorder={actions.reorder}
        onToggleFocus={actions.toggleFocus}
        onToggleTask={actions.toggleTask}
        tasks={selectedTasks}
      />
      {isCreate && (
        <InlineTaskForm
          busy={mutations.busy}
          draft={draftController.draft}
          errors={draftController.draftErrors}
          onCancel={actions.backToList}
          onChange={actions.updateDraft}
          onSubmit={actions.saveDraft}
          titleRef={draftController.titleRef}
        />
      )}
    </div>
  )
}
