import { useDesktopMutations } from "../../app/use-desktop-mutations"
import { useFocusSessionFlow } from "../../components/use-focus-session-flow"
import type {
  AppSnapshot,
  DesktopApi,
  TasksWindowIntent,
} from "../../lib/desktopApi"
import { getLocalDateString } from "../../lib/local-date"
import { createTaskSurfaceActions } from "./tasks-actions"
import { TasksSurfaceContent } from "./tasks-surface-content"
import { useTaskDraftController, useTaskSurfaceRouting } from "./tasks-state"
import { useTasksViewPreferences } from "./tasks-view-preferences"
import { useTasksWindowIntent } from "./tasks-window-intent"

export type TasksSurfaceProps = {
  api: DesktopApi
  snapshot: AppSnapshot
  applySnapshot: (snapshot: AppSnapshot) => void
  refreshSnapshot: () => Promise<AppSnapshot>
  initialIntent?: TasksWindowIntent
  search?: string
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
  const {
    activeTab,
    selectedDate,
    setActiveTab,
    setSelectedDate,
  } = useTasksViewPreferences(today)
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
  const mutations = useDesktopMutations({ applySnapshot, refreshSnapshot })
  const focusSession = useFocusSessionFlow({
    api,
    mutationBusy: mutations.busy,
    mutationError: mutations.error,
    runMutation: mutations.runMutation,
    snapshot,
  })
  const actions = createTaskSurfaceActions({
    activeTab,
    api,
    draft: draftController.draft,
    focusTask: focusSession.requestFocus,
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
      focusPicker={focusSession.picker}
      mutations={mutations}
      routing={routing}
      selectedDate={selectedDate}
      setActiveTab={setActiveTab}
      setSelectedDate={setSelectedDate}
      snapshot={snapshot}
    />
  )
}
