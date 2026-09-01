import {
  isTasksWindowIntent,
  parseTasksWindowIntent,
} from "./tasks-window-intent"

describe("Tasks window intents", () => {
  it("parses list, add, and task URL modes", () => {
    expect(parseTasksWindowIntent("?intent=list")).toEqual({ kind: "list" })
    expect(parseTasksWindowIntent("?intent=add")).toEqual({ kind: "add" })
    expect(
      parseTasksWindowIntent(
        "?surface=tasks&intent=task&taskId=11111111-1111-4111-8111-111111111111",
      ),
    ).toEqual({
      kind: "task",
      taskId: "11111111-1111-4111-8111-111111111111",
    })
  })

  it("falls back to list for incomplete task URLs", () => {
    expect(parseTasksWindowIntent("?intent=task")).toEqual({ kind: "list" })
    expect(parseTasksWindowIntent("?intent=unknown")).toEqual({ kind: "list" })
  })

  it("accepts only safe event payloads", () => {
    expect(isTasksWindowIntent({ kind: "list" })).toBe(true)
    expect(isTasksWindowIntent({ kind: "add" })).toBe(true)
    expect(
      isTasksWindowIntent({ kind: "task", taskId: "task-1" }),
    ).toBe(true)
    expect(isTasksWindowIntent({ kind: "task", taskId: "" })).toBe(false)
    expect(isTasksWindowIntent({ kind: "task", taskId: 1 })).toBe(false)
    expect(isTasksWindowIntent(null)).toBe(false)
  })
})
