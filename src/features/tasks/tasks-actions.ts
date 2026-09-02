import type { Dispatch, SetStateAction } from "react"

import type { AppSnapshot, DesktopApi } from "../../lib/desktopApi"
import type {
  UseDesktopMutationsResult,
} from "../../app/use-desktop-mutations"
import {
  taskBucketForTab,
  toCreateTaskInput,
  toUpdateTaskInput,
  type TaskDraft,
  type TaskDraftErrors,
  type TaskDraftField,
  type TasksTab,
  validateTaskDraft,
} from "./tasks-model"
import type { TasksPanel } from "./tasks-state"

type TaskSurfaceActionOptions = {
  api: DesktopApi
  activeTab: TasksTab
  selectedDate: string
  panel: TasksPanel
  selectedTaskId: string | null
  snapshot: AppSnapshot
  draft: TaskDraft
  setDraft: Dispatch<SetStateAction<TaskDraft>>
  setDraftErrors: Dispatch<SetStateAction<TaskDraftErrors>>
  setPanel: Dispatch<SetStateAction<TasksPanel>>
  setSelectedTaskId: Dispatch<SetStateAction<string | null>>
  resetForAdd: (scheduledDate: string | null) => void
  mutations: Pick<UseDesktopMutationsResult, "runMutation">
}

function requestSettingsWindow(
  api: DesktopApi,
  mutations: Pick<UseDesktopMutationsResult, "runMutation">,
) {
  void mutations.runMutation("openSettingsWindow", () =>
    api.openSettingsWindow(),
  )
}

export function createTaskSurfaceActions({
  activeTab,
  api,
  draft,
  mutations,
  panel,
  resetForAdd,
  selectedDate,
  selectedTaskId,
  setDraft,
  setDraftErrors,
  setPanel,
  setSelectedTaskId,
  snapshot,
}: TaskSurfaceActionOptions) {
  function openAdd() {
    setPanel("create")
    setSelectedTaskId(null)
    resetForAdd(activeTab === "day" ? selectedDate : null)
  }

  function openTask(taskId: string) {
    setPanel("detail")
    setSelectedTaskId(taskId)
    setDraftErrors({})
  }

  function backToList() {
    setPanel("list")
    setSelectedTaskId(null)
    setDraftErrors({})
  }

  function updateDraft(field: TaskDraftField, value: string) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
    setDraftErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
  }

  async function saveDraft() {
    const validationErrors = validateTaskDraft(draft)
    if (Object.keys(validationErrors).length > 0) {
      setDraftErrors(validationErrors)
      return null
    }

    const result =
      panel === "create"
        ? await mutations.runMutation("addTask", () =>
            api.addTask(toCreateTaskInput(draft)),
          )
        : await mutations.runMutation("updateTask", () =>
            api.updateTask(toUpdateTaskInput(draft)),
          )

    if (result) {
      setPanel(panel === "create" ? "list" : "detail")
      setDraftErrors({})
    }

    return result
  }

  async function deleteSelectedTask() {
    if (!selectedTaskId) {
      return null
    }

    const result = await mutations.runMutation("deleteTask", () =>
      api.deleteTask(selectedTaskId),
    )
    if (result) {
      backToList()
    }
    return result
  }

  function toggleTask(taskId: string) {
    void mutations.runMutation("toggleTask", () => api.toggleTask(taskId))
  }

  function toggleFocus(taskId: string) {
    const isActiveTask = snapshot.focus.activeTaskId === taskId
    if (isActiveTask && snapshot.focus.state === "running") {
      void mutations.runMutation("pauseFocus", () => api.pauseFocus())
      return
    }
    if (isActiveTask && snapshot.focus.state === "paused") {
      void mutations.runMutation("resumeFocus", () => api.resumeFocus())
      return
    }
    void mutations.runMutation("startFocus", () => api.startFocus(taskId))
  }

  function reorder(taskIds: string[]) {
    const bucket = taskBucketForTab(activeTab, selectedDate)
    void mutations.runMutation("moveTasks", () =>
      api.moveTasks({ taskIds, source: bucket, destination: bucket }),
    )
  }

  return {
    backToList,
    deleteSelectedTask,
    openAdd,
    openSettings: () => requestSettingsWindow(api, mutations),
    openTask,
    reorder,
    saveDraft,
    toggleFocus,
    toggleTask,
    updateDraft,
  }
}
