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
      className="mx-auto grid h-screen min-h-[var(--tasks-window-min-height)] max-h-[var(--tasks-window-max-height)] min-w-0 w-full max-w-[var(--tasks-window-max-width)] grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden rounded-[22px] border border-white/[0.18] bg-black py-[18px] pl-5 pr-3 text-content max-[640px]:h-auto max-[640px]:min-h-screen max-[640px]:max-h-none max-[640px]:overflow-visible max-[640px]:rounded-none max-[640px]:border-0 max-[640px]:px-4"
      data-surface="tasks"
    >
      <TasksWindowHeader
        busy={mutations.busy}
        onClose={actions.closeWindow}
        openTaskCount={snapshot.tasks.filter((task) => !task.isDone).length}
        onOpenSettings={actions.openSettings}
      />
      <div className="grid min-h-0 min-w-0 grid-cols-[minmax(250px,294px)_minmax(0,1fr)] gap-0 max-[640px]:grid-cols-1">
        <TasksSidebar
          busy={mutations.busy}
          onDateChange={setSelectedDate}
          onOpenSettings={actions.openSettings}
          selectedDate={selectedDate}
          showHeader={false}
        />
        <section
          className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border pl-[18px] max-[640px]:border-l-0 max-[640px]:pl-0"
          data-slot="tasks-content"
        >
          <SelectedListHeader
            activeTab={activeTab}
            busy={mutations.busy}
            date={activeTab === "day" ? selectedDate : ""}
            onTabChange={setActiveTab}
            unscheduledCount={
              snapshot.tasks.filter((task) => task.scheduledDate === null).length
            }
            taskCount={selectedTasks.length}
          />
          {isDetail ? (
            <TaskDetailView
              actions={actions}
              draftController={draftController}
              mutations={mutations}
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
            className="absolute bottom-3 right-4"
          />
        </section>
      </div>
    </main>
  )
}
