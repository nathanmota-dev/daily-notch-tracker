import type { FocusSessionPickerProps } from "../../components/focus-session-types"
import type { useDesktopMutations } from "../../app/use-desktop-mutations"
import type {
  AppSnapshot,
  DesktopApiError,
} from "../../lib/desktopApi"
import type {
  TaskDraft,
  TaskDraftErrors,
  TaskDraftField,
  TasksTab,
} from "./tasks-model"
import type { createTaskSurfaceActions } from "./tasks-actions"
import type {
  useTaskDraftController,
  useTaskSurfaceRouting,
} from "./tasks-state"

export type TasksViewIntent = "list" | "create" | "detail"

export type TasksWindowHeaderProps = {
  busy: boolean
  openTaskCount: number
  onClose: () => void
}

export type TasksFocusPickerProps = FocusSessionPickerProps

export type InlineTaskFormProps = {
  busy: boolean
  draft: TaskDraft
  errors: TaskDraftErrors
  onCancel: () => void
  onChange: (field: TaskDraftField, value: string) => void
  onSubmit: () => void
  titleRef: React.RefObject<HTMLInputElement | null>
}

export type TasksSurfaceContentProps = {
  activeTab: TasksTab
  actions: ReturnType<typeof createTaskSurfaceActions>
  draftController: ReturnType<typeof useTaskDraftController>
  focusPicker: TasksFocusPickerProps
  mutations: ReturnType<typeof useDesktopMutations>
  routing: ReturnType<typeof useTaskSurfaceRouting>
  selectedDate: string
  setActiveTab: (tab: TasksTab) => void
  setSelectedDate: (date: string) => void
  snapshot: AppSnapshot
}

export type TasksMutationErrorProps = {
  error: DesktopApiError | null
}

export type TasksSelectedListHeaderProps = {
  activeTab: TasksTab
  busy: boolean
  date: string
  onTabChange: (tab: TasksTab) => void
  unscheduledCount: number
  taskCount: number
}

export type TasksListViewProps = {
  busy: boolean
  error: DesktopApiError | null
  focus: AppSnapshot["focus"]
  onAdd: () => void
  onDeleteTask: (taskId: string) => void
  onOpenTask: (taskId: string) => void
  onReorder: (taskIds: string[]) => void
  onToggleFocus: (taskId: string) => void
  onToggleTask: (taskId: string) => void
  tasks: AppSnapshot["tasks"]
}

export type TaskDetailViewProps = Pick<
  TasksSurfaceContentProps,
  "actions" | "draftController" | "mutations"
>

export type TaskListAndCreateViewProps = Pick<
  TasksSurfaceContentProps,
  "actions" | "draftController" | "mutations" | "snapshot"
> & {
  isCreate: boolean
  selectedTasks: AppSnapshot["tasks"]
}
