import type { IsoDateString } from "../../lib/desktopApi"
import type { TasksCalendarModel } from "./tasks-calendar-model"

export type TasksCalendarProps = {
  busy: boolean
  onSelectDate: (date: IsoDateString) => void
  selectedDate: IsoDateString
  today?: Date | number
}

export type TasksCalendarDayProps = {
  busy: boolean
  dayOfMonth: number
  date: IsoDateString
  isSelected: boolean
  isToday: boolean
  onSelectDate: (date: IsoDateString) => void
}

export type TasksCalendarHeaderProps = {
  busy: boolean
  monthLabel: string
  onNextMonth: () => void
  onPreviousMonth: () => void
}

export type TasksCalendarGridProps = {
  busy: boolean
  model: TasksCalendarModel
  onSelectDate: (date: IsoDateString) => void
}
