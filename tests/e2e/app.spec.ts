import { expect, test } from "@playwright/test"

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

test.describe("DailyNotch surface router", () => {
  test("loads the deterministic browser snapshot as idle", async ({ page }) => {
    await page.goto("/")

    await expect(page).toHaveTitle("DailyNotch Linux")
    await expect(page.locator('[data-surface="overlay"]')).toBeAttached()
    await expect(
      page.locator('[data-slot="collapsed-focus-widget"]'),
    ).toHaveAttribute("data-state", "idle")
  })

  for (const { name, state, mode } of widgetFixtures) {
    test(`renders the ${name} collapsed widget fixture`, async ({ page }) => {
      await page.goto(`/?surface=overlay&fixture=${name}`)

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
