import type { IsoDateString } from "../../lib/desktopApi"

export type TasksSidebarProps = {
  busy: boolean
  selectedDate: IsoDateString
  onDateChange: (date: IsoDateString) => void
  onOpenSettings: () => void
  today?: Date | number
}
