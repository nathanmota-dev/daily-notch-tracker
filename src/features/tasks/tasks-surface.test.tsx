import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import {
  createEmptyAppSnapshot,
  createMockDesktopApi,
  DesktopApiError,
  type AppSnapshot,
  type CreateTaskInput,
  type Task,
  type UpdateTaskInput,
} from "../../lib/desktopApi"
import { getLocalDateString } from "../../lib/local-date"
import { App } from "../../app/App"
import { TasksSurface } from "./tasks-surface"

const today = getLocalDateString()

function nearbyDate() {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() === 1 ? 2 : date.getDate() - 1)
  return getLocalDateString(date)
}

function createTask(
  id: string,
  title: string,
  overrides: Partial<Task> = {},
): Task {
  return {
    id,
    title,
    notes: "",
    scheduledDate: today,
    estimateMinutes: 25,
    isDone: false,
    createdAt: `${today}T10:00:00.000Z`,
    focusedSeconds: 0,
    sortOrder: 0,
    ...overrides,
  }
}

function createSnapshot(tasks: Task[], overrides: Partial<AppSnapshot> = {}) {
  return {
    ...createEmptyAppSnapshot(),
    revision: 1,
    tasks,
    ...overrides,
  }
}

function renderStandaloneTasks(
  snapshot: AppSnapshot,
  options: { search?: string } = {},
) {
  const controller = createMockDesktopApi({ snapshot })
  const applySnapshot = vi.fn()
  const refreshSnapshot = vi.fn(async () => snapshot)

  render(
    <TasksSurface
      api={controller.api}
      applySnapshot={applySnapshot}
      refreshSnapshot={refreshSnapshot}
      search={options.search}
      snapshot={snapshot}
    />,
  )

  return { applySnapshot, controller, refreshSnapshot }
}

describe("Tasks surface", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/")
  })

  afterEach(() => {
    window.history.replaceState({}, "", "/")
  })

  it("renders the two-column shell without an ICS events section", async () => {
    const snapshot = createSnapshot([])
    render(<AppForTasks api={createMockDesktopApi({ snapshot }).api} />)

    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Day" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Day" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByRole("tab", { name: "Unscheduled" })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="tasks-sidebar"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="tasks-content"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="tasks-events"]')).not.toBeInTheDocument()
  })

  it("keeps the Tasks header compact", async () => {
    const controller = createMockDesktopApi({ snapshot: createSnapshot([]) })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })

    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument()
    expect(document.querySelector('[data-slot="tasks-window-header"]')).toBeInTheDocument()
  })

  it("keeps Day and Unscheduled buckets independent", async () => {
    const otherDay = nearbyDate()
    const snapshot = createSnapshot([
      createTask("day-task", "Day task"),
      createTask("other-day-task", "Other day task", {
        scheduledDate: otherDay,
      }),
      createTask("unscheduled-task", "Unscheduled task", {
        scheduledDate: null,
      }),
    ])
    const controller = createMockDesktopApi({ snapshot })

    render(<AppForTasks api={controller.api} />)

    expect(await screen.findByText("Day task")).toBeInTheDocument()
    expect(screen.queryByText("Unscheduled task")).not.toBeInTheDocument()

    await userEvent.setup().click(
      screen.getByRole("tab", { name: "Unscheduled" }),
    )
    expect(await screen.findByText("Unscheduled task")).toBeInTheDocument()
    expect(screen.queryByText("Day task")).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole("tab", { name: "Day" }))
    const otherDayButton = document.querySelector(
      `[data-slot="tasks-calendar-widget"] button[data-date="${otherDay}"]`,
    )
    expect(otherDayButton).toBeInTheDocument()
    fireEvent.click(otherDayButton!)
    expect(await screen.findByText("Other day task")).toBeInTheDocument()
    expect(screen.queryByText("Day task")).not.toBeInTheDocument()
  })

  it("preserves the selected day and bucket order after a newer snapshot", async () => {
    const firstTask = createTask("first-task", "First task", { sortOrder: 1 })
    const secondTask = createTask("second-task", "Second task", { sortOrder: 0 })
    const snapshot = createSnapshot([
      firstTask,
      secondTask,
      createTask("unscheduled-task", "Unscheduled task", {
        scheduledDate: null,
      }),
    ])
    const controller = createMockDesktopApi({ snapshot })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })

    const updatedSnapshot = createSnapshot(
      [
        { ...firstTask, title: "Updated first task" },
        { ...secondTask, title: "Updated second task" },
        createTask("new-unscheduled-task", "New unscheduled task", {
          scheduledDate: null,
        }),
      ],
      { revision: 2 },
    )

    act(() => controller.emit("store-changed", updatedSnapshot))

    await waitFor(() =>
      expect(
        Array.from(document.querySelectorAll('[data-slot="tasks-task-row"]')).map(
          (row) => row.getAttribute("data-task-id"),
        ),
      ).toEqual([secondTask.id, firstTask.id]),
    )
    expect(document.querySelector('[data-slot="tasks-day-header"]')).toHaveAttribute(
      "data-date",
      today,
    )
    expect(screen.queryByText("New unscheduled task")).not.toBeInTheDocument()
  })

  it("creates a task from the focused form", async () => {
    const snapshot = createSnapshot([])
    const createdTask = createTask("created-task", "Created task", {
      notes: "A note",
      estimateMinutes: 25,
    })
    const addTask = vi.fn(async (input: CreateTaskInput) => {
      expect(input).toEqual({
        title: "Created task",
        notes: "A note",
        scheduledDate: today,
        estimateMinutes: 25,
      })
      return createSnapshot([createdTask], { revision: 2 })
    })
    const controller = createMockDesktopApi({
      handlers: { addTask },
      snapshot,
    })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Add task" }))
    const title = screen.getByLabelText("Title")
    expect(title).toHaveFocus()
    await user.type(title, "Created task")
    await user.type(screen.getByLabelText("Notes"), "A note")
    await user.click(screen.getByRole("button", { name: "Add task" }))

    await waitFor(() => expect(addTask).toHaveBeenCalledOnce())
    expect(await screen.findByText("Created task")).toBeInTheDocument()
  })

  it("creates an unscheduled task from the Unscheduled bucket", async () => {
    const snapshot = createSnapshot([])
    const createdTask = createTask("unscheduled-created", "Unscheduled task", {
      scheduledDate: null,
    })
    const addTask = vi.fn(async (input: CreateTaskInput) => {
      expect(input).toEqual({
        title: "Unscheduled task",
        notes: "",
        scheduledDate: null,
        estimateMinutes: 25,
      })
      return createSnapshot([createdTask], { revision: 2 })
    })
    const controller = createMockDesktopApi({
      handlers: { addTask },
      snapshot,
    })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })
    const user = userEvent.setup()

    await user.click(screen.getByRole("tab", { name: "Unscheduled" }))
    await user.click(screen.getByRole("button", { name: "Add task" }))
    await user.type(screen.getByLabelText("Title"), "Unscheduled task")
    await user.click(screen.getByRole("button", { name: "Add task" }))

    await waitFor(() => expect(addTask).toHaveBeenCalledOnce())
    expect(await screen.findByText("Unscheduled task")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Unscheduled" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })

  it("edits, completes, and deletes a task", async () => {
    const initialTask = createTask("editable-task", "Original task")
    const snapshot = createSnapshot([initialTask])
    const updatedTask = {
      ...initialTask,
      title: "Updated task",
      isDone: true,
    }
    const updateTask = vi.fn(async (input: UpdateTaskInput) => {
      expect(input).toMatchObject({
        id: initialTask.id,
        title: "Updated task",
        isDone: true,
      })
      return createSnapshot([updatedTask], { revision: 2 })
    })
    const deleteTask = vi.fn(async () => createSnapshot([], { revision: 3 }))
    const controller = createMockDesktopApi({
      handlers: { deleteTask, updateTask },
      snapshot,
    })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: "Open details for Original task" }),
    )
    expect(await screen.findByRole("heading", { name: "Edit task" })).toBeInTheDocument()
    await user.clear(screen.getByLabelText("Title"))
    await user.type(screen.getByLabelText("Title"), "Updated task")
    await user.click(
      screen.getByRole("checkbox", { name: /Mark task as complete/ }),
    )
    await user.click(screen.getByRole("button", { name: "Save task" }))

    await waitFor(() => expect(updateTask).toHaveBeenCalledOnce())
    expect(screen.getByLabelText("Title")).toHaveValue("Updated task")
    await user.click(screen.getByRole("button", { name: "Back to list" }))
    expect(await screen.findByText("Updated task")).toBeInTheDocument()
    expect(
      screen.getByRole("checkbox", { name: "Mark Updated task as incomplete" }),
    ).toBeChecked()

    await user.click(
      screen.getByRole("button", { name: "Open details for Updated task" }),
    )
    await user.click(screen.getByRole("button", { name: "Delete task" }))
    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith(initialTask.id))
    expect(await screen.findByRole("button", { name: "Add your first task" })).toBeInTheDocument()
  })

  it("edits every task field and keeps the detail open after saving", async () => {
    const initialTask = createTask("all-fields-task", "Original task", {
      notes: "Original note",
    })
    const editedDate = nearbyDate()
    const snapshot = createSnapshot([initialTask])
    const updatedTask = {
      ...initialTask,
      title: "Updated task",
      notes: "Updated note",
      scheduledDate: editedDate,
      estimateMinutes: 50,
      isDone: true,
    }
    const updateTask = vi.fn(async (input: UpdateTaskInput) => {
      expect(input).toEqual({
        id: initialTask.id,
        title: "Updated task",
        notes: "Updated note",
        scheduledDate: editedDate,
        estimateMinutes: 50,
        isDone: true,
      })
      return createSnapshot([updatedTask], { revision: 2 })
    })
    const controller = createMockDesktopApi({
      handlers: { updateTask },
      snapshot,
    })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: "Open details for Original task" }),
    )

    await user.clear(screen.getByLabelText("Title"))
    await user.type(screen.getByLabelText("Title"), "Updated task")
    await user.clear(screen.getByLabelText("Notes"))
    await user.type(screen.getByLabelText("Notes"), "Updated note")
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: editedDate },
    })
    await user.click(screen.getByRole("button", { name: "50 min" }))
    await user.click(
      screen.getByRole("checkbox", { name: /Mark task as complete/ }),
    )
    await user.click(screen.getByRole("button", { name: "Save task" }))

    await waitFor(() => expect(updateTask).toHaveBeenCalledOnce())
    expect(screen.getByRole("heading", { name: "Edit task" })).toBeInTheDocument()
    expect(screen.getByLabelText("Title")).toHaveValue("Updated task")
    expect(screen.getByLabelText("Notes")).toHaveValue("Updated note")
    expect(screen.getByLabelText("Date")).toHaveValue(editedDate)
    expect(screen.getByRole("spinbutton", { name: "Duration (minutes)" })).toHaveValue(50)
    expect(
      screen.getByRole("checkbox", { name: /Mark task as complete/ }),
    ).toBeChecked()
  })

  it("discards edits on Cancel without persisting them", async () => {
    const task = createTask("cancel-task", "Original task")
    const updateTask = vi.fn(async () => createSnapshot([task], { revision: 2 }))
    const controller = createMockDesktopApi({
      handlers: { updateTask },
      snapshot: createSnapshot([task]),
    })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: "Open details for Original task" }),
    )
    await user.clear(screen.getByLabelText("Title"))
    await user.type(screen.getByLabelText("Title"), "Discarded task")
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(updateTask).not.toHaveBeenCalled()
    expect(await screen.findByText("Original task")).toBeInTheDocument()
    expect(screen.queryByText("Discarded task")).not.toBeInTheDocument()
  })

  it("keeps scheduling controls out of the compact add form", async () => {
    const snapshot = createSnapshot([])
    const addTask = vi.fn(async () => createSnapshot([]))
    const applySnapshot = vi.fn()
    const refreshSnapshot = vi.fn(async () => snapshot)
    const controller = createMockDesktopApi({
      handlers: { addTask },
      snapshot,
    })

    render(
      <TasksSurface
        api={controller.api}
        applySnapshot={applySnapshot}
        refreshSnapshot={refreshSnapshot}
        snapshot={snapshot}
      />,
    )
    await screen.findByRole("heading", { name: "Tasks" })
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Add task" }))

    expect(screen.getByRole("form", { name: "Create task" })).toBeInTheDocument()
    expect(screen.queryByRole("spinbutton", { name: "Duration (minutes)" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Date")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled()
    expect(addTask).not.toHaveBeenCalled()
    expect(refreshSnapshot).not.toHaveBeenCalled()
  })

  it("keeps the draft after a validation rollback and hides the backend message", async () => {
    const task = createTask("rollback-task", "Rollback task")
    const snapshot = createSnapshot([task])
    const updateTask = vi.fn(async () => {
      throw new DesktopApiError({
        operation: "updateTask",
        code: "validation",
        field: "estimateMinutes",
        message: "Private backend validation details.",
      })
    })
    const applySnapshot = vi.fn()
    const refreshSnapshot = vi.fn(async () => snapshot)
    const controller = createMockDesktopApi({
      handlers: { updateTask },
      snapshot,
    })

    render(
      <TasksSurface
        api={controller.api}
        applySnapshot={applySnapshot}
        refreshSnapshot={refreshSnapshot}
        snapshot={snapshot}
      />,
    )
    await screen.findByRole("heading", { name: "Tasks" })
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: "Open details for Rollback task" }),
    )
    const duration = screen.getByRole("spinbutton", {
      name: "Duration (minutes)",
    })
    await user.clear(duration)
    await user.type(duration, "30")
    await user.click(screen.getByRole("button", { name: "Save task" }))

    await waitFor(() => expect(updateTask).toHaveBeenCalledOnce())
    await waitFor(() => expect(refreshSnapshot).toHaveBeenCalledOnce())
    expect(screen.getByRole("heading", { name: "Edit task" })).toBeInTheDocument()
    expect(duration).toHaveValue(30)
    expect(screen.getByText("Enter a whole number of minutes between 1 and 180.")).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent("Private backend validation details")
  })

  it("uses start, pause, and resume focus actions", async () => {
    const task = createTask("focus-task", "Focus task")
    const snapshot = createSnapshot([task])
    const runningSnapshot = createSnapshot([task], {
      revision: 2,
      focus: {
        ...snapshot.focus,
        state: "running",
        activeTaskId: task.id,
        activeTaskTitle: task.title,
      },
    })
    const pausedSnapshot = createSnapshot([task], {
      revision: 3,
      focus: {
        ...runningSnapshot.focus,
        state: "paused",
      },
    })
    const startFocus = vi.fn(async () => runningSnapshot)
    const pauseFocus = vi.fn(async () => pausedSnapshot)
    const resumeFocus = vi.fn(async () => runningSnapshot)
    const controller = createMockDesktopApi({
      handlers: { pauseFocus, resumeFocus, startFocus },
      snapshot,
    })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Start focus for Focus task" }))
    expect(screen.getByRole("dialog", { name: "Focus session for Focus task" })).toBeInTheDocument()
    expect(screen.getByLabelText("Focus minutes")).toHaveValue("25")
    expect(screen.getByLabelText("Focus seconds")).toHaveValue("00")
    await user.click(screen.getByRole("button", { name: "Start focus" }))
    await waitFor(() =>
      expect(startFocus).toHaveBeenCalledWith({
        taskId: task.id,
        durationSeconds: 1_500,
      }),
    )
    await user.click(screen.getByRole("button", { name: "Pause focus for Focus task" }))
    await waitFor(() => expect(pauseFocus).toHaveBeenCalledOnce())
    await user.click(screen.getByRole("button", { name: "Resume focus for Focus task" }))
    await waitFor(() => expect(resumeFocus).toHaveBeenCalledOnce())
  })

  it("sends the complete current bucket when reordering by its handle", async () => {
    const firstTask = createTask("first-task", "First task", { sortOrder: 0 })
    const secondTask = createTask("second-task", "Second task", { sortOrder: 1 })
    const snapshot = createSnapshot([firstTask, secondTask])
    const moveTasks = vi.fn(async () =>
      createSnapshot(
        [
          { ...secondTask, sortOrder: 0 },
          { ...firstTask, sortOrder: 1 },
        ],
        { revision: 2 },
      ),
    )
    const controller = createMockDesktopApi({
      handlers: { moveTasks },
      snapshot,
    })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })
    const rows = document.querySelectorAll('[data-slot="tasks-task-row"]')
    const dataTransfer = {
      effectAllowed: "none",
      dropEffect: "none",
      getData: vi.fn(() => firstTask.id),
      setData: vi.fn(),
    }

    fireEvent.dragStart(
      screen.getByRole("button", { name: "Reorder First task" }),
      { dataTransfer },
    )
    fireEvent.dragOver(rows[1], { dataTransfer })
    fireEvent.drop(rows[1], { dataTransfer })

    await waitFor(() => expect(moveTasks).toHaveBeenCalledOnce())
    expect(moveTasks).toHaveBeenCalledWith({
      taskIds: [secondTask.id, firstTask.id],
      source: { scheduledDate: today },
      destination: { scheduledDate: today },
    })
    await waitFor(() =>
      expect(
        Array.from(document.querySelectorAll('[data-slot="tasks-task-row"]')).map(
          (row) => row.getAttribute("data-task-id"),
        ),
      ).toEqual([secondTask.id, firstTask.id]),
    )
  })

  it("reconciles failed mutations and prevents concurrent saves", async () => {
    const snapshot = createSnapshot([])
    const reconciledSnapshot = createSnapshot([], { revision: 2 })
    const getSnapshot = vi
      .fn<() => Promise<AppSnapshot>>()
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce(reconciledSnapshot)
    const addTask = vi.fn(async () => {
      throw new DesktopApiError({
        operation: "addTask",
        code: "conflict",
        message: "A private title must never be shown.",
      })
    })
    const controller = createMockDesktopApi({
      handlers: { addTask, getSnapshot },
      snapshot,
    })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Add task" }))
    await user.type(screen.getByLabelText("Title"), "Failed task")
    const addButton = screen.getByRole("button", { name: "Add task" })
    fireEvent.click(addButton)
    fireEvent.click(addButton)

    const alert = await screen.findByRole("alert")
    await waitFor(() => expect(addTask).toHaveBeenCalledOnce())
    await waitFor(() => expect(getSnapshot).toHaveBeenCalledTimes(2))
    expect(alert).toHaveTextContent("conflict")
    expect(alert).not.toHaveTextContent("private")
    expect(screen.getByRole("form", { name: "Create task" })).toBeInTheDocument()
  })

  it("routes initial and transient list, add, and task intents", async () => {
    const task = createTask("intent-task", "Intent task")
    const snapshot = createSnapshot([task])
    const { controller } = renderStandaloneTasks(snapshot, {
      search: "?surface=tasks&intent=add",
    })

    expect(await screen.findByRole("form", { name: "Create task" })).toBeInTheDocument()
    expect(screen.getByLabelText("Title")).toHaveFocus()

    await act(async () => {
      controller.emit("tasks-window-intent", {
        kind: "task",
        taskId: task.id,
      })
    })
    expect(await screen.findByRole("heading", { name: "Edit task" })).toBeInTheDocument()

    await act(async () => {
      controller.emit("tasks-window-intent", { kind: "list" })
    })
    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeInTheDocument()
  })

  it("opens the exact task requested by a task intent", async () => {
    const requestedTask = createTask("task-1", "Requested task")
    const similarlyNamedIdTask = createTask("task-10", "Different task")
    renderStandaloneTasks(
      createSnapshot([requestedTask, similarlyNamedIdTask]),
      { search: `?intent=task&taskId=${requestedTask.id}` },
    )

    expect(await screen.findByRole("heading", { name: "Edit task" })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByLabelText("Title")).toHaveValue("Requested task"),
    )
    expect(screen.queryByDisplayValue("Different task")).not.toBeInTheDocument()
  })

  it("starts focus for the persisted task from its detail view", async () => {
    const task = createTask("detail-focus-task", "Detail focus task")
    const runningSnapshot = createSnapshot([task], {
      revision: 2,
      focus: {
        ...createSnapshot([task]).focus,
        state: "running",
        activeTaskId: task.id,
        activeTaskTitle: task.title,
      },
    })
    const startFocus = vi.fn(async () => runningSnapshot)
    const controller = createMockDesktopApi({
      handlers: { startFocus },
      snapshot: createSnapshot([task]),
    })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: "Open details for Detail focus task" }),
    )
    await user.click(
      screen.getByRole("button", { name: "Start focus for Detail focus task" }),
    )

    await user.click(screen.getByRole("button", { name: "Start focus" }))
    await waitFor(() =>
      expect(startFocus).toHaveBeenCalledWith({
        taskId: task.id,
        durationSeconds: 1_500,
      }),
    )
  })

  it("completes the active task through the list action", async () => {
    const task = createTask("active-complete-task", "Active complete task")
    const initialSnapshot = createSnapshot([task], {
      focus: {
        ...createSnapshot([task]).focus,
        state: "running",
        activeTaskId: task.id,
        activeTaskTitle: task.title,
      },
    })
    const completedSnapshot = createSnapshot(
      [{ ...task, isDone: true }],
      { revision: 2 },
    )
    const toggleTask = vi.fn(async (taskId: string) => {
      expect(taskId).toBe(task.id)
      return completedSnapshot
    })
    const controller = createMockDesktopApi({
      handlers: { toggleTask },
      snapshot: initialSnapshot,
    })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })
    await userEvent.setup().click(
      screen.getByRole("checkbox", { name: "Mark Active complete task as complete" }),
    )

    await waitFor(() => expect(toggleTask).toHaveBeenCalledOnce())
    expect(
      await screen.findByRole("checkbox", {
        name: "Mark Active complete task as incomplete",
      }),
    ).toBeChecked()
  })

  it("deletes the active task from its detail view", async () => {
    const task = createTask("active-delete-task", "Active delete task")
    const initialSnapshot = createSnapshot([task], {
      focus: {
        ...createSnapshot([task]).focus,
        state: "running",
        activeTaskId: task.id,
        activeTaskTitle: task.title,
      },
    })
    const deleteTask = vi.fn(async (taskId: string) => {
      expect(taskId).toBe(task.id)
      return createSnapshot([], { revision: 2 })
    })
    const controller = createMockDesktopApi({
      handlers: { deleteTask },
      snapshot: initialSnapshot,
    })

    render(<AppForTasks api={controller.api} />)
    await screen.findByRole("heading", { name: "Tasks" })
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: "Open details for Active delete task" }),
    )
    await user.click(screen.getByRole("button", { name: "Delete task" }))

    await waitFor(() => expect(deleteTask).toHaveBeenCalledOnce())
    expect(await screen.findByRole("button", { name: "Add your first task" })).toBeInTheDocument()
  })
})

function AppForTasks({ api }: { api: ReturnType<typeof createMockDesktopApi>["api"] }) {
  return <App api={api} surface="tasks" />
}
