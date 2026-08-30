import { expect, test } from "@playwright/test"

test.describe("DailyNotch starter screen", () => {
  test("shows the foundation and handles browser mode gracefully", async ({ page }) => {
    await page.goto("/")

    await expect(page).toHaveTitle("DailyNotch Linux")
    await expect(
      page.getByRole("heading", { name: "Um foco de cada vez." }),
    ).toBeVisible()

    const foundationButton = page.getByRole("button", {
      name: "Verificar a fundação",
    })

    await expect(foundationButton).toBeVisible()
    await foundationButton.click()

    await expect(page.getByText(/Frontend funcionando\./)).toBeVisible()
  })
})
