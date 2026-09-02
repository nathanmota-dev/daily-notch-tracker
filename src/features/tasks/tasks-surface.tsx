import { useState } from "react"

import { useDesktopMutations } from "../../app/use-desktop-mutations"
import { Button } from "../../components/ui/button"
import {
  type AppSnapshot,
  type DesktopApi,
  type DesktopApiError,
  type TasksWindowIntent,
} from "../../lib/desktopApi"
import { getLocalDateString } from "../../lib/local-date"
import { createTaskSurfaceActions } from "./tasks-actions"
import { TaskForm } from "./task-form"
import { TaskList } from "./task-list"
import {
  selectTasksForTasksSurface,
  type TasksTab,
} from "./tasks-model"
import { useTaskDraftController, useTaskSurfaceRouting } from "./tasks-state"
import { TasksSidebar } from "./tasks-sidebar"
import { useTasksWindowIntent } from "./tasks-window-intent"

export type TasksSurfaceProps = {
  api: DesktopApi
  snapshot: AppSnapshot
  applySnapshot: (snapshot: AppSnapshot) => void
  refreshSnapshot: () => Promise<AppSnapshot>
  initialIntent?: TasksWindowIntent
  search?: string
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

function formatSelectedDay(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  if (!match) {
    return "Choose a day"
  }

  const date = new Date(0)
  date.setHours(0, 0, 0, 0)
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))

  if (Number.isNaN(date.getTime())) {
    return "Choose a day"
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  }).format(date)
}

function TasksContentHeader({
  activeTab,
  busy,
  date,
  totalCount,
  onAdd,
  onTabChange,
  showAdd,
}: {
  activeTab: TasksTab
  busy: boolean
  date: string
  totalCount: number
  onAdd: () => void
  onTabChange: (tab: TasksTab) => void
  showAdd: boolean
}) {
  return (
    <header
      className="tasks-surface__content-header"
      data-date={date}
      data-slot="tasks-day-header"
    >
      <div>
        <p className="tasks-surface__eyebrow">Selected day</p>
        <h2>Day</h2>
        <p className="tasks-surface__day-title" data-slot="tasks-day-title">
          {formatSelectedDay(date)}
        </p>
        <p className="tasks-surface__summary">
          {totalCount} {totalCount === 1 ? "tarefa" : "tarefas"}
        </p>
      </div>
      {showAdd && (
        <Button
          aria-label="Add task"
          disabled={busy}
          onClick={onAdd}
          type="button"
        >
          Add a task
        </Button>
      )}
      <div
        aria-label="Task lists"
        className="tasks-surface__tabs"
        role="tablist"
      >
        <button
          aria-selected={activeTab === "day"}
          className="tasks-surface__tab"
          onClick={() => onTabChange("day")}
          role="tab"
          type="button"
        >
          Day
        </button>
        <button
          aria-selected={activeTab === "unscheduled"}
          className="tasks-surface__tab"
          onClick={() => onTabChange("unscheduled")}
          role="tab"
          type="button"
        >
          Unscheduled
        </button>
      </div>
    </header>
  )
}

function MutationError({ error }: { error: DesktopApiError | null }) {
  if (!error) {
    return null
  }

  return (
    <p className="tasks-surface__error" data-slot="tasks-error" role="alert">
      Could not update tasks. Code: {error.code}.
    </p>
  )
}

function TasksListView({
  busy,
  error,
  focus,
  onAdd,
  onOpenTask,
  onReorder,
  onToggleFocus,
  onToggleTask,
  tasks,
}: {
  busy: boolean
  error: DesktopApiError | null
  focus: AppSnapshot["focus"]
  onAdd: () => void
  onOpenTask: (taskId: string) => void
  onReorder: (taskIds: string[]) => void
  onToggleFocus: (taskId: string) => void
  onToggleTask: (taskId: string) => void
  tasks: AppSnapshot["tasks"]
}) {
  return (
    <section aria-label="Tasks in selected list" className="tasks-surface__list-panel">
      <MutationError error={error} />
      <TaskList
        busy={busy}
        focus={focus}
        onAddTask={onAdd}
        onOpenTask={onOpenTask}
        onReorder={onReorder}
        onToggleFocus={onToggleFocus}
        onToggleTask={onToggleTask}
        tasks={tasks}
      />
    </section>
  )
}

type TasksSurfaceContentProps = {
  activeTab: TasksTab
  actions: ReturnType<typeof createTaskSurfaceActions>
  draftController: ReturnType<typeof useTaskDraftController>
  mutations: ReturnType<typeof useDesktopMutations>
  routing: ReturnType<typeof useTaskSurfaceRouting>
  selectedDate: string
  setActiveTab: (tab: TasksTab) => void
  setSelectedDate: (date: string) => void
  snapshot: AppSnapshot
}

function TasksSurfaceContent({
  activeTab,
  actions,
  draftController,
  mutations,
  routing,
  selectedDate,
  setActiveTab,
  setSelectedDate,
  snapshot,
}: TasksSurfaceContentProps) {
  return (
    <main className="tasks-surface bg-canvas" data-surface="tasks">
      <TasksSidebar
        busy={mutations.busy}
        onDateChange={setSelectedDate}
        onOpenSettings={actions.openSettings}
        selectedDate={selectedDate}
      />
      <section className="tasks-surface__content" data-slot="tasks-content">
        <TasksContentHeader
          activeTab={activeTab}
          busy={mutations.busy}
          date={selectedDate}
          onAdd={actions.openAdd}
          onTabChange={setActiveTab}
          showAdd={routing.panel === "list"}
          totalCount={snapshot.tasks.length}
        />
        {(routing.panel === "create" || routing.panel === "detail") && (
          <MutationError error={mutations.error} />
        )}
        {routing.panel === "create" || routing.panel === "detail" ? (
          <TaskForm
            busy={mutations.busy}
            draft={draftController.draft}
            errors={draftController.draftErrors}
            focusActionLabel={
              routing.panel === "detail" && routing.selectedTaskId
                ? focusLabel(snapshot, routing.selectedTaskId)
                : undefined
            }
            mode={routing.panel === "create" ? "create" : "edit"}
            onCancel={actions.backToList}
            onChange={actions.updateDraft}
            onDelete={
              routing.panel === "detail"
                ? actions.deleteSelectedTask
                : undefined
            }
            onDoneChange={(isDone) =>
              draftController.setDraft((current) => ({ ...current, isDone }))
            }
            onFocus={
              routing.panel === "detail" && routing.selectedTaskId
                ? () => actions.toggleFocus(routing.selectedTaskId!)
                : undefined
            }
            onSubmit={actions.saveDraft}
            titleRef={draftController.titleRef}
          />
        ) : (
          <TasksListView
            busy={mutations.busy}
            error={mutations.error}
            focus={snapshot.focus}
            onAdd={actions.openAdd}
            onOpenTask={actions.openTask}
            onReorder={actions.reorder}
            onToggleFocus={actions.toggleFocus}
            onToggleTask={actions.toggleTask}
            tasks={selectTasksForTasksSurface(
              snapshot.tasks,
              activeTab,
              selectedDate,
            )}
          />
        )}
      </section>
    </main>
  )
}

export function TasksSurface({
  api,
  applySnapshot,
  initialIntent,
  refreshSnapshot,
  search,
  snapshot,
}: TasksSurfaceProps) {
  const routedIntent = useTasksWindowIntent(api, search)
  const intent = initialIntent ?? routedIntent
  const today = getLocalDateString()
  const [activeTab, setActiveTab] = useState<TasksTab>("day")
  const [selectedDate, setSelectedDate] = useState(today)
  const routing = useTaskSurfaceRouting(intent, snapshot.tasks)
  const selectedTask = snapshot.tasks.find(
    (task) => task.id === routing.selectedTaskId,
  )
  const draftController = useTaskDraftController({
    activeTab,
    intent,
    panel: routing.panel,
    selectedDate,
    selectedTask,
  })
  const mutations = useDesktopMutations({
    applySnapshot,
    refreshSnapshot,
  })
  const actions = createTaskSurfaceActions({
    activeTab,
    api,
    draft: draftController.draft,
    mutations,
    panel: routing.panel,
    resetForAdd: draftController.resetForAdd,
    selectedDate,
    selectedTaskId: routing.selectedTaskId,
    setDraft: draftController.setDraft,
    setDraftErrors: draftController.setDraftErrors,
    setPanel: routing.setPanel,
    setSelectedTaskId: routing.setSelectedTaskId,
    snapshot,
  })
  return (
    <TasksSurfaceContent
      activeTab={activeTab}
      actions={actions}
      draftController={draftController}
      mutations={mutations}
      routing={routing}
      selectedDate={selectedDate}
      setActiveTab={setActiveTab}
      setSelectedDate={setSelectedDate}
      snapshot={snapshot}
    />
  )
}
