import { InlineTaskForm } from "./inline-task-form"
import { TaskForm } from "./task-form"
import { TaskList } from "./task-list"
import { parseLocalDateString } from "../../lib/local-date"
import type {
  TaskDetailViewProps,
  TaskListAndCreateViewProps,
  TasksListViewProps,
  TasksMutationErrorProps,
  TasksSelectedListHeaderProps,
} from "./tasks-view-types"

function formatSelectedDay(dateValue: string) {
  const date = parseLocalDateString(dateValue)

  if (!date) {
    return "Choose a day"
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  }).format(date)
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
  activeTab,
  busy,
  date,
  onTabChange,
  taskCount,
  unscheduledCount,
}: TasksSelectedListHeaderProps) {
  return (
    <header
      className="flex shrink-0 items-center justify-between gap-3 pb-4"
      data-date={date}
      data-slot="tasks-day-header"
    >
      <div className="min-w-0">
        <h2
          aria-label={date ? "Day" : "Unscheduled"}
          className="m-0 truncate text-[0.95rem] font-semibold leading-tight tracking-[-0.02em] text-content"
        >
          {date ? "Today" : "Unscheduled"}
        </h2>
        <p className="sr-only" data-slot="tasks-day-title">
          {date ? formatSelectedDay(date) : "Tasks without a date"} · {taskCount}{" "}
          {taskCount === 1 ? "task" : "tasks"}
        </p>
      </div>
      <div
        aria-label="Task lists"
        className="inline-flex shrink-0 rounded-full bg-panel-hover p-0.5"
        data-slot="tasks-segmented-control"
        role="tablist"
      >
        <button
          aria-label="Day"
          aria-selected={activeTab === "day"}
          className="min-h-7 cursor-pointer rounded-full border-0 bg-transparent px-3 text-[0.7rem] font-semibold text-muted outline-none transition-colors hover:text-content aria-selected:bg-accent aria-selected:text-canvas focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          disabled={busy}
          onClick={() => onTabChange("day")}
          role="tab"
          type="button"
        >
          Day
        </button>
        <button
          aria-label="Unscheduled"
          aria-selected={activeTab === "unscheduled"}
          className="min-h-7 cursor-pointer rounded-full border-0 bg-transparent px-3 text-[0.7rem] font-semibold text-muted outline-none transition-colors hover:text-content aria-selected:bg-accent aria-selected:text-canvas focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          disabled={busy}
          onClick={() => onTabChange("unscheduled")}
          role="tab"
          type="button"
        >
          Unscheduled {unscheduledCount}
        </button>
      </div>
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
      className="min-h-0 min-w-0 flex-1 overflow-y-auto"
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
}: TaskDetailViewProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <MutationError error={mutations.error} />
      <TaskForm
        busy={mutations.busy}
        draft={draftController.draft}
        errors={draftController.draftErrors}
        mode="edit"
        onCancel={actions.backToList}
        onChange={actions.updateDraft}
        onDelete={actions.deleteSelectedTask}
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
      {!isCreate && (
        <button
          aria-label="Add task"
          className="flex h-11 w-full shrink-0 cursor-pointer items-center justify-start rounded-control border border-border bg-panel px-3 text-left text-[0.76rem] font-semibold text-muted outline-none transition-colors hover:border-border-strong hover:bg-panel-hover hover:text-content focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          disabled={mutations.busy}
          onClick={actions.openAdd}
          type="button"
        >
          Add a task
        </button>
      )}
    </div>
  )
}
