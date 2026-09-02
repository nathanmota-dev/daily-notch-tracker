import { useEffect, useState } from "react"

import { ChevronLeftIcon, ChevronRightIcon } from "../../icons"
import { Button } from "../../components/ui/button"
import type { IsoDateString } from "../../lib/desktopApi"
import { getLocalDateString } from "../../lib/local-date"
import {
  formatTasksCalendarDate,
  getTasksCalendarModel,
  getTasksCalendarMonthForDate,
  shiftTasksCalendarMonth,
  TASK_CALENDAR_WEEKDAYS,
  type TasksCalendarModel,
} from "./tasks-calendar-model"

export type TasksCalendarProps = {
  busy: boolean
  onSelectDate: (date: IsoDateString) => void
  selectedDate: IsoDateString
  today?: Date | number
}

function sameMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  )
}

function initialVisibleMonth(selectedDate: IsoDateString, today: Date | number) {
  return (
    getTasksCalendarMonthForDate(selectedDate) ??
    getTasksCalendarMonthForDate(getLocalDateString(today)) ??
    shiftTasksCalendarMonth(today, 0)
  )
}

function CalendarDay({
  busy,
  dayOfMonth,
  date,
  isSelected,
  isToday,
  onSelectDate,
}: {
  busy: boolean
  dayOfMonth: number
  date: IsoDateString
  isSelected: boolean
  isToday: boolean
  onSelectDate: (date: IsoDateString) => void
}) {
  return (
    <button
      aria-current={isToday ? "date" : undefined}
      aria-label={formatTasksCalendarDate(date)}
      aria-pressed={isSelected}
      className="tasks-calendar__day"
      data-date={date}
      data-selected={isSelected ? "true" : "false"}
      data-today={isToday ? "true" : "false"}
      disabled={busy}
      onClick={() => onSelectDate(date)}
      type="button"
    >
      <span>{dayOfMonth}</span>
      {isToday && (
        <span aria-hidden="true" className="tasks-calendar__today-marker" />
      )}
    </button>
  )
}

function CalendarHeader({
  busy,
  monthLabel,
  onNextMonth,
  onPreviousMonth,
}: {
  busy: boolean
  monthLabel: string
  onNextMonth: () => void
  onPreviousMonth: () => void
}) {
  return (
    <header className="tasks-calendar__header">
      <div>
        <p className="tasks-sidebar__eyebrow">Planning</p>
        <h3 aria-live="polite" className="tasks-calendar__month-title">
          {monthLabel}
        </h3>
      </div>
      <div className="tasks-calendar__navigation">
        <Button
          aria-label="Previous month"
          disabled={busy}
          onClick={onPreviousMonth}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          aria-label="Next month"
          disabled={busy}
          onClick={onNextMonth}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}

function CalendarGrid({
  busy,
  model,
  onSelectDate,
}: {
  busy: boolean
  model: TasksCalendarModel
  onSelectDate: (date: IsoDateString) => void
}) {
  return (
    <div
      aria-label={`Calendar for ${model.monthLabel}`}
      className="tasks-calendar__grid"
      data-month={`${model.year}-${String(model.month + 1).padStart(2, "0")}`}
      data-row-count={model.rowCount}
      role="group"
    >
      {model.cells.map((cell, index) => (
        <div
          className="tasks-calendar__cell"
          data-cell-state={cell.state}
          data-column={cell.column}
          data-date={cell.date ?? undefined}
          data-day={cell.dayOfMonth ?? undefined}
          data-row={cell.row}
          key={cell.date ?? `empty-cell-${index}`}
        >
          {cell.date && cell.dayOfMonth ? (
            <CalendarDay
              busy={busy}
              date={cell.date}
              dayOfMonth={cell.dayOfMonth}
              isSelected={cell.isSelected}
              isToday={cell.isToday}
              onSelectDate={onSelectDate}
            />
          ) : (
            <span aria-hidden="true" className="tasks-calendar__outside" />
          )}
        </div>
      ))}
    </div>
  )
}

export function TasksCalendar({
  busy,
  onSelectDate,
  selectedDate,
  today = Date.now(),
}: TasksCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    initialVisibleMonth(selectedDate, today),
  )
  const model = getTasksCalendarModel(visibleMonth, selectedDate, today)

  useEffect(() => {
    const selectedMonth = getTasksCalendarMonthForDate(selectedDate)
    if (!selectedMonth) {
      return
    }

    setVisibleMonth((currentMonth) =>
      sameMonth(currentMonth, selectedMonth) ? currentMonth : selectedMonth,
    )
  }, [selectedDate])

  function selectToday() {
    const todayDate = getLocalDateString(today)
    const todayMonth = getTasksCalendarMonthForDate(todayDate)
    if (todayMonth) {
      setVisibleMonth(todayMonth)
    }
    onSelectDate(todayDate)
  }

  return (
    <section
      aria-label="Monthly task calendar"
      className="tasks-calendar"
      data-slot="tasks-calendar-widget"
    >
      <CalendarHeader
        busy={busy}
        monthLabel={model.monthLabel}
        onNextMonth={() =>
          setVisibleMonth((current) => shiftTasksCalendarMonth(current, 1))
        }
        onPreviousMonth={() =>
          setVisibleMonth((current) => shiftTasksCalendarMonth(current, -1))
        }
      />

      <div aria-hidden="true" className="tasks-calendar__weekdays">
        {TASK_CALENDAR_WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <CalendarGrid busy={busy} model={model} onSelectDate={onSelectDate} />

      <Button
        className="tasks-calendar__today-button"
        disabled={busy}
        onClick={selectToday}
        size="sm"
        type="button"
        variant="outline"
      >
        Today
      </Button>
    </section>
  )
}
