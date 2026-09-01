import { useEffect, useMemo, useRef, useState } from "react"

import type {
  AppSnapshot,
  TasksWindowIntent,
} from "../../lib/desktopApi"
import {
  createEmptyTaskDraft,
  type TaskDraft,
  type TaskDraftErrors,
  type TasksTab,
} from "./tasks-model"

export type TasksPanel = "list" | "create" | "detail"

export function useTaskSurfaceRouting(
  intent: TasksWindowIntent,
  tasks: AppSnapshot["tasks"],
) {
  const [panel, setPanel] = useState<TasksPanel>("list")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const lastIntent = useRef<TasksWindowIntent | null>(null)

  useEffect(() => {
    if (lastIntent.current === intent) {
      return
    }
    lastIntent.current = intent

    if (intent.kind === "list") {
      setPanel("list")
      setSelectedTaskId(null)
      return
    }

    if (intent.kind === "add") {
      setPanel("create")
      setSelectedTaskId(null)
      return
    }

    if (tasks.some((task) => task.id === intent.taskId)) {
      setPanel("detail")
      setSelectedTaskId(intent.taskId)
      return
    }

    setPanel("list")
    setSelectedTaskId(null)
  }, [intent, tasks])

  useEffect(() => {
    if (panel === "detail" && selectedTaskId) {
      const taskStillExists = tasks.some((task) => task.id === selectedTaskId)
      if (!taskStillExists) {
        setPanel("list")
        setSelectedTaskId(null)
      }
    }
  }, [panel, selectedTaskId, tasks])

  return {
    panel,
    selectedTaskId,
    setPanel,
    setSelectedTaskId,
  }
}

export function useTaskDraftController({
  activeTab,
  intent,
  panel,
  selectedDate,
  selectedTask,
}: {
  activeTab: TasksTab
  intent: TasksWindowIntent
  panel: TasksPanel
  selectedDate: string
  selectedTask?: AppSnapshot["tasks"][number]
}) {
  const [draft, setDraft] = useState<TaskDraft>(() => createEmptyTaskDraft())
  const [draftErrors, setDraftErrors] = useState<TaskDraftErrors>({})
  const titleRef = useRef<HTMLInputElement>(null)
  const lastIntent = useRef<TasksWindowIntent | null>(null)
  const selectedTaskId = selectedTask?.id
  const selectedTaskTitle = selectedTask?.title
  const selectedTaskNotes = selectedTask?.notes
  const selectedTaskDate = selectedTask?.scheduledDate
  const selectedTaskDuration = selectedTask?.estimateMinutes
  const selectedTaskIsDone = selectedTask?.isDone
  const selectedTaskDraft = useMemo(
    () =>
      selectedTaskId
        ? {
            id: selectedTaskId,
            title: selectedTaskTitle ?? "",
            notes: selectedTaskNotes ?? "",
            scheduledDate: selectedTaskDate ?? "",
            estimateMinutes: String(selectedTaskDuration ?? 25),
            isDone: selectedTaskIsDone ?? false,
          }
        : null,
    [
      selectedTaskDate,
      selectedTaskDuration,
      selectedTaskId,
      selectedTaskIsDone,
      selectedTaskNotes,
      selectedTaskTitle,
    ],
  )

  useEffect(() => {
    if (lastIntent.current === intent) {
      return
    }
    lastIntent.current = intent

    if (intent.kind === "add") {
      setDraft(createEmptyTaskDraft(activeTab === "day" ? selectedDate : null))
    }
    setDraftErrors({})
  }, [activeTab, intent, selectedDate])

  useEffect(() => {
    if (panel === "detail" && selectedTaskDraft) {
      setDraft(selectedTaskDraft)
    }
  }, [panel, selectedTaskDraft])

  useEffect(() => {
    if (panel !== "list") {
      titleRef.current?.focus()
    }
  }, [panel])

  function resetForAdd(scheduledDate: string | null) {
    setDraft(createEmptyTaskDraft(scheduledDate))
    setDraftErrors({})
  }

  return {
    draft,
    draftErrors,
    resetForAdd,
    setDraft,
    setDraftErrors,
    titleRef,
  }
}
