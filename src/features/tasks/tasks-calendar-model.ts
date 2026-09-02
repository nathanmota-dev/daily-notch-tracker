import type { IsoDateString } from "../../lib/desktopApi"
import { getLocalDateString } from "../../lib/local-date"

export const TASK_CALENDAR_COLUMN_COUNT = 7

export const TASK_CALENDAR_WEEKDAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const

export type TasksCalendarCellState = "day" | "outside-month"

export type TasksCalendarCell = {
  column: number
  date: IsoDateString | null
  dayOfMonth: number | null
  isSelected: boolean
  isToday: boolean
  row: number
  state: TasksCalendarCellState
}

export type TasksCalendarModel = {
  cells: readonly TasksCalendarCell[]
  month: number
  monthLabel: string
  rowCount: number
  year: number
}

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
})

const dateLabelFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

function safeDate(value: Date | number) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function localDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 12)
}

function monthStart(value: Date | number) {
  const date = safeDate(value)
  return localDate(date.getFullYear(), date.getMonth(), 1)
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) {
    return null
  }

  const date = localDate(year, month - 1, day)
  return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ? date
    : null
}

export function getTasksCalendarMonthForDate(value: string) {
  const date = parseDateKey(value)
  return date ? monthStart(date) : null
}

export function shiftTasksCalendarMonth(value: Date | number, offset: number) {
  const date = monthStart(value)
  return localDate(date.getFullYear(), date.getMonth() + offset, 1)
}

export function formatTasksCalendarDate(value: IsoDateString) {
  const date = parseDateKey(value)
  return date ? dateLabelFormatter.format(date) : value
}

export function getTasksCalendarModel(
  visibleMonth: Date | number,
  selectedDate: IsoDateString,
  today: Date | number = Date.now(),
): TasksCalendarModel {
  const currentMonth = monthStart(visibleMonth)
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingEmptyCells = (currentMonth.getDay() + 6) % 7
  const rowCount = Math.ceil(
    (leadingEmptyCells + daysInMonth) / TASK_CALENDAR_COLUMN_COUNT,
  )
  const todayKey = getLocalDateString(safeDate(today))

  const cells = Array.from(
    { length: rowCount * TASK_CALENDAR_COLUMN_COUNT },
    (_, index): TasksCalendarCell => {
      const row = Math.floor(index / TASK_CALENDAR_COLUMN_COUNT)
      const column = index % TASK_CALENDAR_COLUMN_COUNT
      const dayOfMonth = index - leadingEmptyCells + 1

      if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
        return {
          column,
          date: null,
          dayOfMonth: null,
          isSelected: false,
          isToday: false,
          row,
          state: "outside-month",
        }
      }

      const date = localDate(year, month, dayOfMonth)
      const dateKey = getLocalDateString(date)

      return {
        column,
        date: dateKey,
        dayOfMonth,
        isSelected: dateKey === selectedDate,
        isToday: dateKey === todayKey,
        row,
        state: "day",
      }
    },
  )

  return {
    cells,
    month,
    monthLabel: monthLabelFormatter.format(currentMonth),
    rowCount,
    year,
  }
}
