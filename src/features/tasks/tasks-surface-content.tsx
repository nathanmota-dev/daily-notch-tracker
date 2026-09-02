import { FocusSessionPicker } from "../../components/focus-session-picker"
import { selectTasksForTasksSurface } from "./tasks-model"
import { TasksSidebar } from "./tasks-sidebar"
import { TasksWindowHeader } from "./tasks-window-header"
import type { TasksSurfaceContentProps } from "./tasks-view-types"
import {
  SelectedListHeader,
  TaskDetailView,
  TaskListAndCreateView,
} from "./tasks-surface-views"

export function TasksSurfaceContent({
  activeTab,
  actions,
  draftController,
  focusPicker,
  mutations,
  routing,
  selectedDate,
  setActiveTab,
  setSelectedDate,
  snapshot,
}: TasksSurfaceContentProps) {
  const selectedTasks = selectTasksForTasksSurface(
    snapshot.tasks,
    activeTab,
    selectedDate,
  )
  const isDetail = routing.panel === "detail"
  const isCreate = routing.panel === "create"

  return (
    <main
      className="grid h-screen min-h-[480px] min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden bg-canvas p-5 text-content max-[640px]:h-auto max-[640px]:min-h-screen max-[640px]:overflow-visible"
      data-surface="tasks"
    >
      <TasksWindowHeader
        activeTab={activeTab}
        busy={mutations.busy}
        onClose={actions.closeWindow}
        onOpenSettings={actions.openSettings}
        onTabChange={setActiveTab}
        openTaskCount={snapshot.tasks.filter((task) => !task.isDone).length}
      />
      <div className="grid min-h-0 min-w-0 grid-cols-[220px_minmax(0,1fr)] gap-5 max-[640px]:grid-cols-1">
        <TasksSidebar
          busy={mutations.busy}
          onDateChange={setSelectedDate}
          onOpenSettings={actions.openSettings}
          selectedDate={selectedDate}
          showHeader={false}
        />
        <section
          className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border pl-5 max-[640px]:border-l-0 max-[640px]:pl-0"
          data-slot="tasks-content"
        >
          <SelectedListHeader
            busy={mutations.busy}
            date={activeTab === "day" ? selectedDate : ""}
            onAdd={actions.openAdd}
            showAdd={!isDetail && !isCreate}
            taskCount={selectedTasks.length}
          />
          {isDetail ? (
            <TaskDetailView
              actions={actions}
              draftController={draftController}
              mutations={mutations}
              routing={routing}
              snapshot={snapshot}
            />
          ) : (
            <TaskListAndCreateView
              actions={actions}
              draftController={draftController}
              isCreate={isCreate}
              mutations={mutations}
              selectedTasks={selectedTasks}
              snapshot={snapshot}
            />
          )}
          <FocusSessionPicker
            {...focusPicker}
            className="absolute right-4 top-12"
          />
        </section>
      </div>
    </main>
  )
}
