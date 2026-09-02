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

async function leaveOverlay(page: Page) {
  await page.locator('[data-surface="overlay"]').evaluate((overlay) => {
    overlay.dispatchEvent(
      new PointerEvent("pointerout", {
        bubbles: true,
        relatedTarget: document.body,
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
      .locator(".activity-heatmap__cell")
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
