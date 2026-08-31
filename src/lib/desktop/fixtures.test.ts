import {
  COLLAPSED_WIDGET_FIXTURE_NAMES,
  createCollapsedWidgetFixtureSnapshot,
  resolveCollapsedWidgetFixture,
} from "./fixtures"

describe("collapsed widget fixtures", () => {
  it("resolves a fixture from the browser query or development environment", () => {
    expect(resolveCollapsedWidgetFixture("?fixture=running")).toBe("running")
    expect(resolveCollapsedWidgetFixture("", "rgb")).toBe("rgb")
    expect(resolveCollapsedWidgetFixture("?fixture=paused", "rgb")).toBe(
      "paused",
    )
    expect(resolveCollapsedWidgetFixture("?fixture=unknown", "rgb")).toBeNull()
  })

  it.each(COLLAPSED_WIDGET_FIXTURE_NAMES)(
    "creates a valid %s snapshot",
    (fixture) => {
      const snapshot = createCollapsedWidgetFixtureSnapshot(
        fixture,
        Date.parse("2026-08-31T12:00:00.000Z"),
      )

      expect(snapshot.revision).toBe(1)
      expect(snapshot.focus.state).toBe(
        fixture === "paused" ? "paused" : "running",
      )
      expect(snapshot.focus.totalMs).toBeGreaterThan(0)
      expect(snapshot.focus.activeTaskId).toBe(
        fixture === "no-task" ? null : "fixture-task",
      )
    },
  )
})
