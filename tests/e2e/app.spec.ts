import { expect, test, type Page } from "@playwright/test"

const normalSurfaces = [
  { label: "tasks", heading: "Tasks" },
  { label: "settings", heading: "Settings" },
] as const

const widgetFixtures = [
  { name: "running", state: "running", mode: "normal" },
  { name: "paused", state: "paused", mode: "normal" },
  { name: "no-task", state: "running", mode: "normal" },
  { name: "long-title", state: "running", mode: "normal" },
  { name: "minimal", state: "running", mode: "minimal" },
  { name: "timeline-off", state: "running", mode: "timeline-off" },
  { name: "rgb", state: "running", mode: "rgb" },
] as const

const expandedFixtures = [
  { name: "expanded", taskCount: 2 },
  { name: "expanded-empty", taskCount: 0 },
  { name: "expanded-one", taskCount: 1 },
  { name: "expanded-overflow", taskCount: 6 },
  { name: "expanded-completed", taskCount: 3 },
  { name: "expanded-long-title", taskCount: 2 },
] as const

const OVERLAY_COLLAPSE_DELAY_MS = 400

const expandedTasks = {
  first: {
    id: "expanded-task-1",
    title: "Plan the next focused block",
    notes: "Set the top priority for today.",
    duration: "25m",
  },
  second: {
    id: "expanded-task-2",
    title: "Review the desktop contract",
    notes: "Keep the boundary between UI and desktop code clear.",
    duration: "50m",
  },
  completed: {
    id: "expanded-task-3",
    title: "Ship the completed dashboard draft",
  },
} as const

async function leaveOverlay(page: Page) {
  await page.locator('[data-surface="overlay"]').evaluate((overlay) => {
    overlay.dispatchEvent(
      new PointerEvent("pointerout", {
        bubbles: true,
        relatedTarget: null,
      }),
    )
  })
  await page.waitForTimeout(OVERLAY_COLLAPSE_DELAY_MS + 50)
}

async function loadCollapsedFixture(
  page: Page,
  name: string,
) {
  await page.goto(`/?surface=overlay&fixture=${name}`)
  await leaveOverlay(page)
}

async function loadTasksFixture(
  page: Page,
  fixture?: string,
  intent?: "list" | "add" | "task",
  taskId?: string,
) {
  const params = new URLSearchParams({ surface: "tasks" })
  if (fixture) {
    params.set("fixture", fixture)
  }
  if (intent) {
    params.set("intent", intent)
  }
  if (taskId) {
    params.set("taskId", taskId)
  }

  await page.goto(`/?${params.toString()}`)
}

function taskRow(page: Page, taskId: string) {
  return page.locator(
    `[data-slot="tasks-task-row"][data-task-id="${taskId}"]`,
  )
}

async function taskRowIds(page: Page) {
  return page.locator('[data-slot="tasks-task-row"]').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-task-id")),
  )
}

test.describe("DailyNotch surface router", () => {
  test("loads the deterministic browser snapshot as idle", async ({ page }) => {
    await page.goto("/")
    await leaveOverlay(page)

    await expect(page).toHaveTitle("DailyNotch Linux")
    await expect(page.locator('[data-surface="overlay"]')).toBeAttached()
    await expect(
      page.locator('[data-slot="collapsed-focus-widget"]'),
    ).toHaveAttribute("data-state", "idle")
  })

  for (const { name, state, mode } of widgetFixtures) {
    test(`renders the ${name} collapsed widget fixture`, async ({ page }) => {
      await loadCollapsedFixture(page, name)

      const widget = page.locator('[data-slot="collapsed-focus-widget"]')
      await expect(widget).toBeVisible()
      await expect(widget).toHaveAttribute("data-state", state)
      await expect(widget).toHaveAttribute("data-mode", mode)

      if (name === "no-task") {
        await expect(widget).toContainText("Foco sem tarefa")
      }

      if (name === "long-title") {
        await expect(
          page.locator('[data-slot="focus-task-title"]'),
        ).toHaveAttribute(
          "title",
          "Review and refine the complete DailyNotch Linux focus workflow before the next implementation milestone",
        )
      }

      if (name === "minimal") {
        await expect(page.locator('[data-slot="focus-timer"]')).toHaveCount(0)
        await expect(
          page.locator('[data-slot="focus-task-title"]'),
        ).toHaveCount(0)
      }

      if (name === "timeline-off") {
        await expect(page.getByRole("progressbar")).toHaveCount(0)
      }

      if (name === "rgb") {
        await expect(
          page.locator('[data-slot="progress-tray"]'),
        ).toHaveAttribute("data-rainbow", "on")
      }
    })
  }

  for (const { name, taskCount } of expandedFixtures) {
    test(`renders the ${name} expanded dashboard fixture`, async ({ page }) => {
      await page.goto(`/?surface=overlay&fixture=${name}`)

      const main = page.locator('[data-surface="overlay"]')
      const dashboard = page.locator('[data-slot="expanded-dashboard"]')

      await expect(main).toHaveAttribute("data-presentation-mode", "expanded")
      await expect(dashboard).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Journey Streak" }),
      ).toBeVisible()
      await expect(
        page.getByText(name === "expanded-empty" ? "0d" : "3d"),
      ).toBeVisible()
      await expect(
        page.getByRole("img", { name: /Activity heatmap for/ }),
      ).toBeVisible()
      await expect(page.getByRole("progressbar")).toBeVisible()
      await expect(
        page.locator('[data-slot="compact-task-row"]'),
      ).toHaveCount(taskCount)

      if (name === "expanded-empty") {
        await expect(page.getByText("No tasks yet")).toBeVisible()
      }
    })
  }

  test("keeps the expanded dashboard near 620px wide and 190px tall", async ({
    page,
  }) => {
    await page.goto("/?surface=overlay&fixture=expanded")

    const tray = page.locator('[data-slot="progress-tray"]')
    await expect(tray).toBeVisible()
    const box = await tray.boundingBox()

    expect(box?.width).toBe(620)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(190)
  })

  test("shows two task rows and scrolls overflow without a visible bar", async ({
    page,
  }) => {
    await page.goto("/?surface=overlay&fixture=expanded-overflow")

    const scrollArea = page.locator('[data-slot="scroll-area"]')
    await expect(scrollArea).toHaveAttribute("data-visible-rows", "2")
    await expect(scrollArea).toHaveAttribute("data-overflow", "on")
    await expect(
      page.locator('[data-slot="scroll-area-viewport"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-slot="scroll-area-scrollbar"]'),
    ).toBeHidden()
  })

  test("keeps the activity column fixed when a task title is long", async ({
    page,
  }) => {
    await page.goto("/?surface=overlay&fixture=expanded-long-title")

    const activity = page.locator('[data-slot="activity-panel"]')
    const box = await activity.boundingBox()

    expect(box?.width).toBe(204)
    await expect(
      page.locator('[data-slot="task-title"]').first(),
    ).toHaveAttribute(
      "title",
      "Review and refine the complete DailyNotch Linux focus workflow before the next implementation milestone",
    )
  })

  test("renders a Monday-first seven-column heatmap through today", async ({
    page,
  }) => {
    await page.goto("/?surface=overlay&fixture=expanded")

    const heatmap = page.locator('[data-slot="activity-heatmap"]')
    const cellMetadata = await heatmap
      .locator(":scope > span")
      .evaluateAll((cells) =>
        cells.map((cell) => ({
          column: Number(cell.getAttribute("data-column")),
          day: cell.getAttribute("data-day"),
          intensity: cell.getAttribute("data-intensity"),
          state: cell.getAttribute("data-cell-state"),
        })),
      )

    expect(new Set(cellMetadata.map((cell) => cell.column))).toEqual(
      new Set([0, 1, 2, 3, 4, 5, 6]),
    )

    const rowCount = Number(await heatmap.getAttribute("data-row-count"))
    expect(rowCount).toBeGreaterThanOrEqual(1)
    expect(rowCount).toBeLessThanOrEqual(6)
    expect(cellMetadata).toHaveLength(rowCount * 7)

    const activityCells = cellMetadata.filter(
      (cell) => cell.state === "activity",
    )
    const emptyCells = cellMetadata.filter(
      (cell) => cell.state !== "activity",
    )

    expect(activityCells.length).toBeGreaterThan(0)
    expect(
      activityCells.every((cell) =>
        ["0", "1", "2", "3", "4"].includes(cell.intensity ?? ""),
      ),
    ).toBe(true)
    expect(emptyCells.every((cell) => cell.intensity === null)).toBe(true)

    const firstDay = cellMetadata.find((cell) => cell.day === "1")
    const month = await heatmap.getAttribute("data-month")
    const [year, monthNumber] = month!.split("-").map(Number)
    const expectedMondayFirstColumn =
      (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7

    expect(firstDay?.column).toBe(expectedMondayFirstColumn)
  })

  test("places completed tasks after pending tasks", async ({ page }) => {
    await page.goto("/?surface=overlay&fixture=expanded-completed")

    await expect(
      page.locator('[data-slot="compact-task-row"]').nth(0),
    ).toHaveAttribute("data-completed", "false")
    await expect(
      page.locator('[data-slot="compact-task-row"]').nth(1),
    ).toHaveAttribute("data-completed", "false")
    await expect(
      page.locator('[data-slot="compact-task-row"]').nth(2),
    ).toHaveAttribute("data-completed", "true")
  })

  test("renders the Tasks two-column shell without ICS events", async ({
    page,
  }) => {
    await page.goto("/?surface=tasks")

    const tasksSurface = page.locator('[data-surface="tasks"]')
    const sidebar = page.locator('[data-slot="tasks-sidebar"]')
    const content = page.locator('[data-slot="tasks-content"]')

    await expect(tasksSurface).toBeVisible()
    await expect(sidebar).toBeVisible()
    await expect(content).toBeVisible()
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Day" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Settings" })).toHaveCount(0)
    await expect(
      page.locator('[data-slot="tasks-events"]'),
    ).toHaveCount(0)

    const sidebarBox = await sidebar.boundingBox()
    expect(sidebarBox?.width).toBe(294)
  })

  test("keeps the Tasks window compact at reference sizes", async ({ page }) => {
    for (const size of [
      { width: 922, height: 600 },
      { width: 760, height: 480 },
    ]) {
      await page.setViewportSize(size)
      await loadTasksFixture(page, "expanded", "list")

      const surface = page.locator('[data-surface="tasks"]')
      const box = await surface.boundingBox()
      const documentSize = await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth,
      }))

      expect(box?.width ?? 0).toBeLessThanOrEqual(Math.min(size.width, 800))
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(size.width)
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(size.height)
      expect(documentSize.width).toBeLessThanOrEqual(size.width)
      expect(documentSize.height).toBeLessThanOrEqual(size.height)

      await page.goto(
        `/?surface=tasks&fixture=expanded&intent=add`,
      )
      const form = page.locator('[data-slot="inline-task-form"]')
      const formBox = await form.boundingBox()
      expect((formBox?.x ?? 0) + (formBox?.width ?? 0)).toBeLessThanOrEqual(size.width)
      expect((formBox?.y ?? 0) + (formBox?.height ?? 0)).toBeLessThanOrEqual(size.height)
      await expect(page.locator("#inline-task-title")).toBeFocused()
    }
  })

  test("renders and navigates the monthly Tasks calendar", async ({ page }) => {
    await page.goto("/?surface=tasks")

    const calendar = page.locator('[data-slot="tasks-calendar-widget"]')
    const grid = calendar.locator('[role="group"]')
    await expect(calendar).toBeVisible()
    await expect(
      calendar.locator('[data-slot="tasks-calendar-weekdays"] span'),
    ).toHaveCount(7)
    const dateButtonCount = await calendar.locator("button[data-date]").count()
    expect(dateButtonCount).toBeGreaterThanOrEqual(28)
    expect(dateButtonCount).toBeLessThanOrEqual(31)

    const month = await grid.getAttribute("data-month")
    const rowCount = Number(await grid.getAttribute("data-row-count"))
    expect(rowCount).toBeGreaterThanOrEqual(4)
    expect(rowCount).toBeLessThanOrEqual(6)
    expect(
      await calendar.locator('button[data-selected="true"]').count(),
    ).toBe(1)

    const [year, monthNumber] = month!.split("-").map(Number)
    const firstDayColumn = Number(
      await calendar.locator('[data-day="1"]').getAttribute("data-column"),
    )
    expect(firstDayColumn).toBe((new Date(year, monthNumber - 1, 1).getDay() + 6) % 7)

    await page.getByRole("button", { name: "Previous month" }).click()
    await expect(grid).not.toHaveAttribute("data-month", month!)

    await page.getByRole("button", { name: "Today" }).click()
    await expect(grid).toHaveAttribute("data-month", month!)
  })

  test("renders daily task metadata and row actions", async ({ page }) => {
    await loadTasksFixture(page, "expanded", "list")

    await expect(page.locator('[data-slot="tasks-task-row"]')).toHaveCount(2)
    await expect(page.locator('[data-slot="tasks-open-count"]')).toHaveText("2 open")
    await expect(
      page.locator('[data-slot="tasks-day-title"]'),
    ).toContainText("2 tasks")

    for (const task of [expandedTasks.first, expandedTasks.second]) {
      const row = taskRow(page, task.id)

      await expect(row).toBeVisible()
      await expect(row).toContainText(task.title)
      await expect(row).toContainText(task.notes)
      await expect(
        row.locator('[data-slot="task-duration-chip"]'),
      ).toHaveText(task.duration)
      await expect(
        row.locator('[data-slot="task-date-chip"]'),
      ).toHaveText("Today")
      await expect(
        row.getByRole("button", { name: `Open details for ${task.title}` }),
      ).toBeVisible()
      await expect(
        row.getByRole("button", { name: `Edit ${task.title}` }),
      ).toBeVisible()
      await expect(
        row.getByRole("button", { name: `Start focus for ${task.title}` }),
      ).toBeEnabled()
      await expect(
        row.getByRole("button", { name: `Delete ${task.title}` }),
      ).toBeVisible()
    }
  })

  test("creates an unscheduled task without leaking it into Day", async ({
    page,
  }) => {
    await loadTasksFixture(page, "expanded", "list")

    const unscheduledTab = page.getByRole("tab", { name: "Unscheduled" })
    await unscheduledTab.click()
    await expect(unscheduledTab).toHaveAttribute("aria-selected", "true")
    await expect(page.locator('[data-slot="tasks-task-row"]')).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Add your first task" }),
    ).toBeVisible()

    await page.getByRole("button", { name: "Add your first task" }).click()
    await expect(page.locator('[data-slot="inline-task-form"]')).toBeVisible()
    await expect(page.locator("#inline-task-title")).toBeFocused()
    await page.locator("#inline-task-title").fill("Unscheduled browser task")
    await page.locator("#inline-task-notes").fill("Keep this task undated.")
    await page.getByRole("button", { name: "Add task" }).click()

    const createdTask = taskRow(page, "mock-task-1")
    await expect(createdTask).toBeVisible()
    await expect(createdTask).toContainText("Unscheduled browser task")
    await expect(
      createdTask.locator('[data-slot="task-date-chip"]'),
    ).toHaveCount(0)

    const dayTab = page.getByRole("tab", { name: "Day" })
    await dayTab.click()
    await expect(dayTab).toHaveAttribute("aria-selected", "true")
    await expect(page.locator('[data-slot="tasks-task-row"]')).toHaveCount(2)
    await expect(taskRow(page, "mock-task-1")).toHaveCount(0)

    await unscheduledTab.click()
    await expect(taskRow(page, "mock-task-1")).toBeVisible()
  })

  test("creates a scheduled task from the inline add intent", async ({
    page,
  }) => {
    await loadTasksFixture(page, "expanded", "add")

    const form = page.locator('[data-slot="inline-task-form"]')
    await expect(form).toBeVisible()
    await expect(page.locator("#inline-task-title")).toBeFocused()

    await page.locator("#inline-task-title").fill("Scheduled browser task")
    await page.locator("#inline-task-notes").fill("Created from the add intent.")
    await form.getByRole("button", { name: "Add task" }).click()

    await expect(form).toHaveCount(0)
    const createdTask = taskRow(page, "mock-task-1")
    await expect(createdTask).toBeVisible()
    await expect(createdTask).toContainText("Scheduled browser task")
    await expect(createdTask).toContainText("Created from the add intent.")
    await expect(
      createdTask.locator('[data-slot="task-duration-chip"]'),
    ).toHaveText("25m")
    await expect(
      createdTask.locator('[data-slot="task-date-chip"]'),
    ).toHaveText("Today")
    await expect(page.locator('[data-slot="tasks-open-count"]')).toHaveText("3 open")
  })

  test("cancels the inline add form without creating a task", async ({
    page,
  }) => {
    await loadTasksFixture(page, "expanded", "add")

    const form = page.locator('[data-slot="inline-task-form"]')
    await page.locator("#inline-task-title").fill("Cancelled browser task")
    await form.getByRole("button", { name: "Cancel" }).click()

    await expect(form).toHaveCount(0)
    await expect(page.locator('[data-slot="tasks-task-row"]')).toHaveCount(2)
    await expect(page.getByText("Cancelled browser task")).toHaveCount(0)
    await expect(page.locator('[data-slot="tasks-open-count"]')).toHaveText("2 open")
  })

  test("opens the empty-state CTA into the inline task form", async ({
    page,
  }) => {
    await loadTasksFixture(page)

    await expect(
      page.locator('[data-slot="tasks-day-title"]'),
    ).toContainText("0 tasks")
    const emptyState = page.getByRole("button", { name: "Add your first task" })
    await expect(emptyState).toBeVisible()
    await emptyState.click()

    await expect(page.locator('[data-slot="inline-task-form"]')).toBeVisible()
    await expect(page.locator("#inline-task-title")).toBeFocused()
    await expect(page.getByRole("button", { name: "Add task" })).toBeVisible()
  })

  test("opens the exact task requested by the task intent", async ({ page }) => {
    await loadTasksFixture(page, "expanded", "task", expandedTasks.first.id)

    await expect(page.getByRole("heading", { name: "Edit task" })).toBeVisible()
    await expect(page.getByLabel("Title")).toHaveValue(expandedTasks.first.title)
    await expect(page.getByLabel("Notes")).toHaveValue(expandedTasks.first.notes)
    await expect(
      page.getByRole("spinbutton", { name: "Duration (minutes)" }),
    ).toHaveValue("25")
    await expect(page.getByLabel("Date")).toHaveAttribute(
      "data-value",
      /^\d{4}-\d{2}-\d{2}$/,
    )
    await expect(page.getByText("Completed")).toHaveCount(0)
    await expect(page.getByText("Task details")).toHaveCount(0)
    await expect(
      page.getByRole("button", {
        name: `Start focus for ${expandedTasks.first.title}`,
      }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Back to list" }),
    ).toHaveAttribute("title", "Back to list")
  })

  test("falls back to the list for a similar but invalid task id", async ({
    page,
  }) => {
    await loadTasksFixture(page, "expanded", "task", "expanded-task-10")

    await expect(page.getByRole("heading", { name: "Day" })).toBeVisible()
    await expect(page.locator('[data-slot="tasks-task-row"]')).toHaveCount(2)
    await expect(page.getByRole("heading", { name: "Edit task" })).toHaveCount(0)
  })

  test("edits task fields and verifies the saved task in its new bucket", async ({
    page,
  }) => {
    await loadTasksFixture(page, "expanded", "task", expandedTasks.first.id)

    await page.getByLabel("Title").fill("Edited browser task")
    await page.getByLabel("Notes").fill("Updated from the browser detail view.")
    await page
      .getByRole("spinbutton", { name: "Duration (minutes)" })
      .fill("50")
    await page.getByLabel("Date").click()
    await page.getByRole("button", { name: "Clear date" }).click()
    await page.getByRole("button", { name: "Save task" }).click()

    await expect(page.getByLabel("Title")).toHaveValue("Edited browser task")
    await expect(page.getByLabel("Notes")).toHaveValue(
      "Updated from the browser detail view.",
    )
    await expect(
      page.getByRole("spinbutton", { name: "Duration (minutes)" }),
    ).toHaveValue("50")
    await expect(page.getByLabel("Date")).toHaveAttribute(
      "data-empty",
      "true",
    )

    await page.getByRole("button", { name: "Back to list" }).click()
    await expect(taskRow(page, expandedTasks.first.id)).toHaveCount(0)
    await expect(taskRow(page, expandedTasks.second.id)).toBeVisible()

    await page.getByRole("tab", { name: "Unscheduled" }).click()
    const editedTask = taskRow(page, expandedTasks.first.id)
    await expect(editedTask).toBeVisible()
    await expect(editedTask).toContainText("Edited browser task")
    await expect(editedTask).toContainText(
      "Updated from the browser detail view.",
    )
    await expect(
      editedTask.locator('[data-slot="task-duration-chip"]'),
    ).toHaveText("50m")
    await expect(
      editedTask.locator('[data-slot="task-date-chip"]'),
    ).toHaveCount(0)
    await expect(
      editedTask.getByRole("checkbox", {
        name: "Mark Edited browser task as complete",
      }),
    ).not.toBeChecked()
    await expect(
      editedTask.getByRole("button", {
        name: "Start focus for Edited browser task",
      }),
    ).toBeEnabled()
  })

  test("deletes the only task and returns to the empty state", async ({
    page,
  }) => {
    await loadTasksFixture(page, "expanded-one", "task", expandedTasks.first.id)

    await page.getByRole("button", { name: "Delete task" }).click()

    await expect(page.getByRole("heading", { name: "Edit task" })).toHaveCount(0)
    await expect(page.locator('[data-slot="tasks-task-row"]')).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Add your first task" }),
    ).toBeVisible()
    await expect(
      page.locator('[data-slot="tasks-day-title"]'),
    ).toContainText("0 tasks")
  })

  test("toggles completion and keeps focus disabled for completed tasks", async ({
    page,
  }) => {
    await loadTasksFixture(page, "expanded-completed", "list")

    const rows = page.locator('[data-slot="tasks-task-row"]')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toHaveAttribute("data-completed", "false")
    await expect(rows.nth(1)).toHaveAttribute("data-completed", "false")
    await expect(rows.nth(2)).toHaveAttribute("data-completed", "true")
    await expect(
      taskRow(page, expandedTasks.completed.id).getByRole("button", {
        name: `Start focus for ${expandedTasks.completed.title}`,
      }),
    ).toBeDisabled()
    await expect(page.locator('[data-slot="tasks-open-count"]')).toHaveText("2 open")

    await taskRow(page, expandedTasks.first.id)
      .getByRole("checkbox", {
        name: `Mark ${expandedTasks.first.title} as complete`,
      })
      .click()

    await expect(taskRow(page, expandedTasks.first.id)).toHaveAttribute(
      "data-completed",
      "true",
    )
    await expect(taskRow(page, expandedTasks.second.id)).toHaveAttribute(
      "data-completed",
      "false",
    )
    await expect(rows.nth(0)).toHaveAttribute(
      "data-task-id",
      expandedTasks.second.id,
    )
    await expect(page.locator('[data-slot="tasks-open-count"]')).toHaveText("1 open")
  })

  test("reorders task rows through the drag handle", async ({ page }) => {
    await loadTasksFixture(page, "expanded", "list")

    await expect(await taskRowIds(page)).toEqual([
      expandedTasks.first.id,
      expandedTasks.second.id,
    ])

    const sourceRow = taskRow(page, expandedTasks.first.id)
    const sourceBox = await sourceRow.boundingBox()
    const targetBox = await taskRow(page, expandedTasks.second.id).boundingBox()
    if (!sourceBox || !targetBox) {
      throw new Error("Task reorder targets are missing")
    }

    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    )
    await page.mouse.down()
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 8,
      sourceBox.y + sourceBox.height / 2 + 8,
    )
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
    )
    await page.mouse.up()

    await expect.poll(() => taskRowIds(page)).toEqual([
      expandedTasks.second.id,
      expandedTasks.first.id,
    ])

    await page.getByRole("tab", { name: "Unscheduled" }).click()
    await page.getByRole("tab", { name: "Day" }).click()
    await expect.poll(() => taskRowIds(page)).toEqual([
      expandedTasks.second.id,
      expandedTasks.first.id,
    ])
  })

  test("starts, pauses, and resumes a custom focus session", async ({
    page,
  }) => {
    await loadTasksFixture(page, "expanded", "list")

    const focusButton = taskRow(page, expandedTasks.first.id).getByRole(
      "button",
      { name: `Start focus for ${expandedTasks.first.title}` },
    )
    await focusButton.click()

    const dialog = page.getByRole("dialog", {
      name: `Focus session for ${expandedTasks.first.title}`,
    })
    await expect(dialog).toBeVisible()
    await expect(page.getByLabel("Focus minutes")).toHaveValue("25")
    await expect(page.getByLabel("Focus seconds")).toHaveValue("00")

    await page.getByLabel("Focus minutes").fill("1")
    await page.getByLabel("Focus seconds").fill("30")
    await dialog.getByRole("button", { name: "Start focus" }).click()

    await expect(dialog).toHaveCount(0)
    const pauseButton = page.getByRole("button", {
      name: `Pause focus for ${expandedTasks.first.title}`,
    })
    await expect(pauseButton).toBeVisible()

    await pauseButton.click()
    const resumeButton = page.getByRole("button", {
      name: `Resume focus for ${expandedTasks.first.title}`,
    })
    await expect(resumeButton).toBeVisible()

    await resumeButton.click()
    await expect(
      page.getByRole("button", {
        name: `Pause focus for ${expandedTasks.first.title}`,
      }),
    ).toBeVisible()
  })

  test("rejects a zero-length focus session and closes it with Escape", async ({
    page,
  }) => {
    await loadTasksFixture(page, "expanded", "list")

    await taskRow(page, expandedTasks.first.id)
      .getByRole("button", {
        name: `Start focus for ${expandedTasks.first.title}`,
      })
      .click()
    const dialog = page.getByRole("dialog", {
      name: `Focus session for ${expandedTasks.first.title}`,
    })
    await page.getByLabel("Focus minutes").fill("0")
    await page.getByLabel("Focus seconds").fill("00")

    await expect(dialog.getByRole("alert")).toHaveText(
      "Choose a focus duration between 00:01 and 180:00.",
    )
    await expect(
      dialog.getByRole("button", { name: "Start focus" }),
    ).toBeDisabled()

    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
  })

  test("opens Tasks from the expanded overlay and returns to the overlay", async ({
    page,
  }) => {
    await page.goto("/?surface=overlay&fixture=expanded")

    await page.getByRole("button", { name: "Open Tasks" }).click()
    await expect(page.locator('[data-surface="tasks"]')).toBeVisible()
    await expect(page.getByRole("heading", { name: "Day" })).toBeVisible()

    await page.getByRole("button", { name: "Close Tasks" }).click()
    await expect(page.locator('[data-surface="overlay"]')).toBeVisible()
    await expect(
      page.locator('[data-slot="expanded-dashboard"]'),
    ).toBeVisible()
  })

  test("opens task details from the expanded overlay and returns to it", async ({
    page,
  }) => {
    await page.goto("/?surface=overlay&fixture=expanded")

    await page
      .getByRole("button", {
        name: `Open details for ${expandedTasks.first.title}`,
      })
      .click()
    await expect(page.locator('[data-surface="tasks"]')).toBeVisible()
    await expect(page.getByRole("heading", { name: "Edit task" })).toBeVisible()

    await page.getByRole("button", { name: "Close Tasks" }).click()
    await expect(page.locator('[data-surface="overlay"]')).toBeVisible()
    await expect(
      page.locator('[data-slot="expanded-dashboard"]'),
    ).toBeVisible()
  })

  test("completes the browser notch-to-task focus flow", async ({ page }) => {
    await page.goto("/")
    await leaveOverlay(page)

    await expect(
      page.getByRole("button", { name: "Open focus dashboard" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Open focus dashboard" }).click()
    await expect(page.locator('[data-surface="overlay"]')).toHaveAttribute(
      "data-presentation-mode",
      "expanded",
    )

    await page.getByRole("button", { name: "Add a task" }).click()
    await expect(page.locator('[data-surface="tasks"]')).toBeVisible()
    await expect(page.locator('[data-slot="inline-task-form"]')).toBeVisible()

    await page.getByLabel("Title").fill("Browser flow task")
    await page.getByRole("button", { name: "Add task" }).click()
    await expect(page.getByText("Browser flow task")).toBeVisible()

    await page
      .getByRole("button", { name: "Start focus for Browser flow task" })
      .click()
    await expect(
      page.getByRole("dialog", { name: "Focus session for Browser flow task" }),
    ).toBeVisible()
    await page.getByLabel("Focus minutes").fill("1")
    await page.getByLabel("Focus seconds").fill("30")
    await page
      .getByRole("dialog", { name: "Focus session for Browser flow task" })
      .getByRole("button", { name: "Start focus" })
      .click()
    await expect(
      page.getByRole("button", { name: "Pause focus for Browser flow task" }),
    ).toBeVisible()

    await page.getByRole("button", { name: "Close Tasks" }).click()
    await expect(page.locator('[data-surface="overlay"]')).toBeVisible()
    await leaveOverlay(page)
    await expect(
      page.locator('[data-slot="collapsed-focus-widget"]'),
    ).toHaveAttribute("data-state", "running")
  })

  for (const { label, heading } of normalSurfaces) {
    test(`renders the ${label} surface from the browser query`, async ({
      page,
    }) => {
      await page.goto(`/?surface=${label}`)

      await expect(page.locator(`[data-surface="${label}"]`)).toBeVisible()
      await expect(page.getByRole("heading", { name: heading })).toBeVisible()
      await expect(page.getByText("Nenhuma tarefa ainda.")).toBeVisible()
    })
  }
})
