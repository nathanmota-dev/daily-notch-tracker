import type {
  AppSnapshot,
  CreateTaskInput,
  MoveTasksInput,
  Task,
  UpdateTaskInput,
} from "./contracts"
import {
  assertValidTaskInput,
  cloneSnapshot,
  commitSnapshot,
  nextRevision,
  stateError,
  taskIndex,
  taskSortOrder,
} from "./mock-state-helpers"
import { finishMockFocus } from "./mock-state-focus"
import type { MockState } from "./mock-state-types"

export function addMockTask(state: MockState, input: CreateTaskInput) {
  assertValidTaskInput(
    input.title,
    input.notes,
    input.scheduledDate,
    input.estimateMinutes,
    "addTask",
  )
  const scheduledDate = input.scheduledDate
  const task: Task = {
    id: `mock-task-${state.nextTaskId++}`,
    title: input.title.trim(),
    notes: input.notes,
    scheduledDate,
    estimateMinutes: input.estimateMinutes,
    isDone: false,
    createdAt: new Date().toISOString(),
    focusedSeconds: 0,
    sortOrder: taskSortOrder(state.snapshot.tasks, scheduledDate),
  }
  const snapshot = cloneSnapshot(state.snapshot)
  snapshot.revision = nextRevision(state)
  snapshot.tasks.push(task)
  return commitSnapshot(state, snapshot)
}

export function updateMockTask(state: MockState, input: UpdateTaskInput) {
  const index = taskIndex(state, input.id, "updateTask")
  assertValidTaskInput(
    input.title,
    input.notes,
    input.scheduledDate,
    input.estimateMinutes,
    "updateTask",
  )
  const snapshot = cloneSnapshot(state.snapshot)
  const previousDate = snapshot.tasks[index].scheduledDate
  snapshot.tasks[index] = {
    ...snapshot.tasks[index],
    title: input.title.trim(),
    notes: input.notes,
    scheduledDate: input.scheduledDate,
    estimateMinutes: input.estimateMinutes,
    isDone: input.isDone,
    sortOrder:
      previousDate === input.scheduledDate
        ? snapshot.tasks[index].sortOrder
        : taskSortOrder(snapshot.tasks, input.scheduledDate),
  }
  if (input.isDone && snapshot.focus.activeTaskId === input.id) {
    finishMockFocus(state, snapshot, true, Date.now())
  }
  if (snapshot.focus.activeTaskId === input.id) {
    snapshot.focus.activeTaskTitle = input.title.trim()
  }
  snapshot.revision = nextRevision(state)
  return commitSnapshot(state, snapshot)
}

export function deleteMockTask(state: MockState, id: string) {
  const index = taskIndex(state, id, "deleteTask")
  const snapshot = cloneSnapshot(state.snapshot)
  if (snapshot.focus.activeTaskId === id) {
    finishMockFocus(state, snapshot, false, Date.now())
  }
  snapshot.tasks.splice(index, 1)
  snapshot.revision = nextRevision(state)
  return commitSnapshot(state, snapshot)
}

export function toggleMockTask(state: MockState, id: string) {
  const index = taskIndex(state, id, "toggleTask")
  const snapshot = cloneSnapshot(state.snapshot)
  const task = snapshot.tasks[index]
  if (!task.isDone && snapshot.focus.activeTaskId === id) {
    finishMockFocus(state, snapshot, true, Date.now())
  }
  snapshot.tasks[index].isDone = !task.isDone
  snapshot.revision = nextRevision(state)
  return commitSnapshot(state, snapshot)
}

function reorderBucket(
  snapshot: AppSnapshot,
  taskIds: readonly string[],
  scheduledDate: string | null,
  operation: string,
) {
  const bucket = snapshot.tasks.filter((task) => task.scheduledDate === scheduledDate)
  if (
    taskIds.length !== bucket.length ||
    new Set(taskIds).size !== taskIds.length ||
    taskIds.some((id) => !bucket.some((task) => task.id === id))
  ) {
    stateError(
      operation,
      "conflict",
      "A reorder must include every task in the bucket exactly once.",
      "taskIds",
    )
  }
  taskIds.forEach((id, sortOrder) => {
    const task = snapshot.tasks.find((item) => item.id === id)
    if (task) {
      task.sortOrder = sortOrder
    }
  })
}

export function moveMockTasks(state: MockState, input: MoveTasksInput) {
  if (input.taskIds.length === 0) {
    stateError(
      "moveTasks",
      "validation",
      "At least one task must be moved.",
      "taskIds",
    )
  }
  const snapshot = cloneSnapshot(state.snapshot)
  if (input.source.scheduledDate === input.destination.scheduledDate) {
    reorderBucket(snapshot, input.taskIds, input.source.scheduledDate, "moveTasks")
  } else {
    input.taskIds.forEach((id) => {
      const index = taskIndex(state, id, "moveTasks")
      const task = snapshot.tasks[index]
      if (task.scheduledDate !== input.source.scheduledDate) {
        stateError(
          "moveTasks",
          "conflict",
          "All moved tasks must belong to the source bucket.",
          "taskIds",
        )
      }
      task.scheduledDate = input.destination.scheduledDate
      task.sortOrder = taskSortOrder(snapshot.tasks, input.destination.scheduledDate)
    })
  }
  snapshot.revision = nextRevision(state)
  return commitSnapshot(state, snapshot)
}
