import type { Dispatch, SetStateAction } from "react"

import type {
  AppSnapshot,
  DesktopApi,
  DesktopApiError,
} from "../../lib/desktopApi"
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
  focusTask?: (taskId: string) => void
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

function taskFieldForValidationError(error: DesktopApiError) {
  if (error.code !== "validation") {
    return null
  }

  switch (error.field) {
    case "title":
    case "notes":
    case "scheduledDate":
    case "estimateMinutes":
      return error.field
    default:
      return null
  }
}

function safeTaskFieldError(field: TaskDraftField) {
  switch (field) {
    case "title":
      return "Enter a valid title."
    case "notes":
      return "Notes are too long."
    case "scheduledDate":
      return "Enter a valid date."
    case "estimateMinutes":
      return "Enter a whole number of minutes between 1 and 180."
  }
}

function applyTaskMutationError(
  error: DesktopApiError,
  setDraftErrors: Dispatch<SetStateAction<TaskDraftErrors>>,
) {
  const field = taskFieldForValidationError(error)
  if (!field) {
    return
  }

  setDraftErrors((currentErrors) => ({
    ...currentErrors,
    [field]: safeTaskFieldError(field),
  }))
}

async function saveTaskDraft(
  panel: TasksPanel,
  draft: TaskDraft,
  api: DesktopApi,
  mutations: Pick<UseDesktopMutationsResult, "runMutation">,
  setDraftErrors: Dispatch<SetStateAction<TaskDraftErrors>>,
) {
  const onError = (error: DesktopApiError) =>
    applyTaskMutationError(error, setDraftErrors)

  if (panel === "create") {
    return mutations.runMutation(
      "addTask",
      () => api.addTask(toCreateTaskInput(draft)),
      onError,
    )
  }

  return mutations.runMutation(
    "updateTask",
    () => api.updateTask(toUpdateTaskInput(draft)),
    onError,
  )
}

async function saveDraftChanges(
  panel: TasksPanel,
  draft: TaskDraft,
  api: DesktopApi,
  mutations: Pick<UseDesktopMutationsResult, "runMutation">,
  setDraftErrors: Dispatch<SetStateAction<TaskDraftErrors>>,
  setPanel: Dispatch<SetStateAction<TasksPanel>>,
) {
  const validationErrors = validateTaskDraft(draft)
  if (Object.keys(validationErrors).length > 0) {
    setDraftErrors(validationErrors)
    return null
  }

  const result = await saveTaskDraft(
    panel,
    draft,
    api,
    mutations,
    setDraftErrors,
  )

  if (result) {
    setPanel(panel === "create" ? "list" : "detail")
    setDraftErrors({})
  }

  return result
}

function toggleFocusFallback(
  api: DesktopApi,
  mutations: Pick<UseDesktopMutationsResult, "runMutation">,
  snapshot: AppSnapshot,
  taskId: string,
) {
  const isActiveTask = snapshot.focus.activeTaskId === taskId
  if (isActiveTask && snapshot.focus.state === "running") {
    void mutations.runMutation("pauseFocus", () => api.pauseFocus())
    return
  }
  if (isActiveTask && snapshot.focus.state === "paused") {
    void mutations.runMutation("resumeFocus", () => api.resumeFocus())
    return
  }
  void mutations.runMutation("startFocus", () =>
    api.startFocus({ taskId, durationSeconds: null }),
  )
}

export function createTaskSurfaceActions({
  activeTab,
  api,
  draft,
  focusTask,
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
    return saveDraftChanges(
      panel,
      draft,
      api,
      mutations,
      setDraftErrors,
      setPanel,
    )
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

  function deleteTask(taskId: string) {
    void mutations.runMutation("deleteTask", () => api.deleteTask(taskId))
  }

  function toggleTask(taskId: string) {
    void mutations.runMutation("toggleTask", () => api.toggleTask(taskId))
  }

  function toggleFocus(taskId: string) {
    if (focusTask) {
      focusTask(taskId)
      return
    }

    toggleFocusFallback(api, mutations, snapshot, taskId)
  }

  function reorder(taskIds: string[]) {
    const bucket = taskBucketForTab(activeTab, selectedDate)
    void mutations.runMutation("moveTasks", () =>
      api.moveTasks({ taskIds, source: bucket, destination: bucket }),
    )
  }

  return {
    backToList,
    closeWindow: () => {
      void mutations.runMutation("closeTasksWindow", () =>
        api.closeTasksWindow(),
      )
    },
    deleteTask,
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
