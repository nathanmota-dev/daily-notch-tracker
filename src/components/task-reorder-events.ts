import type { SyntheticEvent } from "react"

export function stopTaskReorder(event: SyntheticEvent) {
  event.stopPropagation()
}
