import { expect, test } from "@playwright/test"

const surfaces = [
  { label: "overlay", heading: "Seu espaço de foco está pronto." },
  { label: "tasks", heading: "Tasks" },
  { label: "settings", heading: "Settings" },
] as const

test.describe("DailyNotch surface router", () => {
  test("loads the deterministic browser snapshot", async ({ page }) => {
    await page.goto("/")

    await expect(page).toHaveTitle("DailyNotch Linux")
    await expect(page.locator('[data-surface="overlay"]')).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Seu espaço de foco está pronto." }),
    ).toBeVisible()
    await expect(page.getByText("Contrato desktop conectado")).toBeVisible()
    await expect(page.getByText("0 tarefas")).toBeVisible()
    await expect(page.getByText("Nenhuma tarefa ainda.")).toBeVisible()
  })

  for (const { label, heading } of surfaces) {
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
