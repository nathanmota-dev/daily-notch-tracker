import { describe, expect, it } from "vitest"

import {
  overlaySurfaceSearch,
  serializeTasksWindowIntent,
  settingsSurfaceSearch,
  tasksSurfaceSearch,
} from "./window-intent"

describe("browser window intents", () => {
  it("serializes every Tasks intent and escapes task ids", () => {
    expect(serializeTasksWindowIntent({ kind: "list" })).toBe("intent=list")
    expect(serializeTasksWindowIntent({ kind: "add" })).toBe("intent=add")
    expect(
      serializeTasksWindowIntent({ kind: "task", taskId: "task/with space" }),
    ).toBe("intent=task&taskId=task%2Fwith%20space")
    expect(tasksSurfaceSearch({ kind: "add" })).toBe(
      "?surface=tasks&intent=add",
    )
    expect(overlaySurfaceSearch()).toBe("?surface=overlay")
    expect(settingsSurfaceSearch()).toBe("?surface=settings")
  })
})
