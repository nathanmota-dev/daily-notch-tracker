import { expect, test } from "@playwright/test"

test.describe("DailyNotch shell", () => {
  test("loads the deterministic browser snapshot", async ({ page }) => {
    await page.goto("/")

    await expect(page).toHaveTitle("DailyNotch Linux")
    await expect(
      page.getByRole("heading", { name: "Seu espaço de foco está pronto." }),
    ).toBeVisible()
    await expect(page.getByText("Contrato desktop conectado")).toBeVisible()
    await expect(page.getByText("0 tarefas")).toBeVisible()
    await expect(page.getByText("Nenhuma tarefa ainda.")).toBeVisible()
  })
})
