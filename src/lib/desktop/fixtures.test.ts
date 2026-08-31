import {
  COLLAPSED_WIDGET_FIXTURE_NAMES,
  EXPANDED_DASHBOARD_FIXTURE_NAMES,
  WIDGET_FIXTURE_NAMES,
  createCollapsedWidgetFixtureSnapshot,
  createExpandedDashboardFixtureSnapshot,
  createWidgetFixtureSnapshot,
  resolveCollapsedWidgetFixture,
  resolveWidgetFixture,
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

describe("widget fixture resolution", () => {
  it("resolves both collapsed and expanded fixtures", () => {
    expect(resolveWidgetFixture("?fixture=running")).toBe("running")
    expect(resolveWidgetFixture("?fixture=expanded")).toBe("expanded")
    expect(resolveWidgetFixture("", "expanded-overflow")).toBe(
      "expanded-overflow",
    )
    expect(resolveWidgetFixture("?fixture=unknown", "expanded")).toBeNull()
  })

  it.each(WIDGET_FIXTURE_NAMES)("creates a %s browser snapshot", (fixture) => {
    const snapshot = createWidgetFixtureSnapshot(
      fixture,
      Date.parse("2026-08-31T12:00:00.000Z"),
    )

    expect(snapshot.revision).toBe(1)
    expect(snapshot.settings.showTimeline).toBe(fixture !== "timeline-off")
  })
})

describe("expanded dashboard fixtures", () => {
  it.each(EXPANDED_DASHBOARD_FIXTURE_NAMES)(
    "creates a deterministic %s snapshot",
    (fixture) => {
      const now = Date.parse("2026-08-31T12:00:00.000Z")
      const firstSnapshot = createExpandedDashboardFixtureSnapshot(
        fixture,
        now,
      )
      const secondSnapshot = createExpandedDashboardFixtureSnapshot(
        fixture,
        now,
      )

      expect(firstSnapshot).toEqual(secondSnapshot)
      expect(firstSnapshot.revision).toBe(1)
      expect(firstSnapshot.focus.state).toBe("idle")
    },
  )

  it("covers the empty, one-task, overflow, completed, and long-title states", () => {
    expect(
      createExpandedDashboardFixtureSnapshot("expanded-empty").tasks,
    ).toHaveLength(0)
    expect(
      createExpandedDashboardFixtureSnapshot("expanded-one").tasks,
    ).toHaveLength(1)
    expect(
      createExpandedDashboardFixtureSnapshot("expanded-overflow").tasks.length,
    ).toBeGreaterThan(2)

    const completedTasks = createExpandedDashboardFixtureSnapshot(
      "expanded-completed",
    ).tasks
    expect(completedTasks.some((task) => task.isDone)).toBe(true)

    expect(
      createExpandedDashboardFixtureSnapshot("expanded-long-title").tasks[0]
        .title.length,
    ).toBeGreaterThan(80)
  })
})
