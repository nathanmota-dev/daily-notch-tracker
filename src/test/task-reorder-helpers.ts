import { act } from "@testing-library/react"

type EventValue = boolean | number | string

export function mockSortableRects(selector = "[data-task-id]") {
  const rows = Array.from(document.querySelectorAll(selector))
  rows.forEach((row, index) => {
    Object.defineProperty(row, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: (index + 1) * 40,
        height: 40,
        left: 0,
        right: 240,
        top: index * 40,
        width: 240,
        x: 0,
        y: index * 40,
      }),
    })
  })
}

export async function pressSortableKey(
  target: EventTarget,
  code: string,
  key = code,
) {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code,
        key,
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

export function startPointerTaskDrag(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(
      createPointerEvent("pointerdown", {
        button: 0,
        buttons: 1,
        clientX: 10,
        clientY: 10,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    )
  })
  act(() => {
    document.dispatchEvent(
      createPointerEvent("pointermove", {
        buttons: 1,
        clientX: 10,
        clientY: 20,
        pointerId: 1,
        pointerType: "mouse",
      }),
    )
  })
}

export function movePointerTaskDrag(clientY: number) {
  act(() => {
    document.dispatchEvent(
      createPointerEvent("pointermove", {
        buttons: 1,
        clientX: 10,
        clientY,
        pointerId: 1,
        pointerType: "mouse",
      }),
    )
  })
}

export async function finishPointerTaskDrag(clientY?: number) {
  if (clientY !== undefined) {
    movePointerTaskDrag(clientY)
  }
  await act(async () => {
    document.dispatchEvent(
      createPointerEvent("pointerup", {
        pointerId: 1,
        pointerType: "mouse",
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 60))
  })
}

function createPointerEvent(
  type: string,
  values: Record<string, EventValue>,
) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperties(event, {
    ...Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, { value }]),
    ),
  })
  return event
}
