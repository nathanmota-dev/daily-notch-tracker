import { useEffect, useState } from "react"

import { Button } from "../../components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons"
import type { IsoDateString } from "../../lib/desktopApi"
import { getLocalDateString } from "../../lib/local-date"
import { cn } from "../../lib/utils"
import {
  formatTasksCalendarDate,
  getTasksCalendarModel,
  getTasksCalendarMonthForDate,
  shiftTasksCalendarMonth,
  TASK_CALENDAR_WEEKDAYS,
} from "./tasks-calendar-model"
import type {
  TasksCalendarDayProps,
  TasksCalendarGridProps,
  TasksCalendarHeaderProps,
  TasksCalendarProps,
} from "./tasks-calendar-types"

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
}: TasksCalendarDayProps) {
  return (
    <button
      aria-current={isToday ? "date" : undefined}
      aria-label={formatTasksCalendarDate(date)}
      aria-pressed={isSelected}
      className={cn(
        "group relative grid size-full min-h-[30px] cursor-pointer place-items-center rounded-full border border-transparent bg-transparent p-0 text-[0.78rem] text-content outline-none transition-[background-color,border-color,color,box-shadow] duration-150 hover:bg-panel-hover focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50",
        isToday && "text-accent",
        isSelected && "bg-accent text-white",
      )}
      data-date={date}
      data-selected={isSelected ? "true" : "false"}
      data-today={isToday ? "true" : "false"}
      disabled={busy}
      onClick={() => onSelectDate(date)}
      type="button"
    >
      <span>{dayOfMonth}</span>
    </button>
  )
}

function CalendarHeader({
  busy,
  monthLabel,
  onNextMonth,
  onPreviousMonth,
}: TasksCalendarHeaderProps) {
  return (
    <header className="relative flex items-center justify-center gap-3">
      <h3
        aria-live="polite"
        className="m-0 text-[0.95rem] font-semibold leading-[1.2] tracking-[-0.01em] text-content"
      >
        {monthLabel}
      </h3>
      <div className="absolute inset-y-0 left-0 flex items-center">
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
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center">
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
}: TasksCalendarGridProps) {
  return (
    <div
      aria-label={`Calendar for ${model.monthLabel}`}
      className="grid grid-cols-7 content-start gap-1"
      data-month={`${model.year}-${String(model.month + 1).padStart(2, "0")}`}
      data-row-count={model.rowCount}
      role="group"
    >
      {model.cells.map((cell, index) => (
        <div
          className="aspect-square min-w-0"
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
            <span
              aria-hidden="true"
              className="grid size-full min-h-[30px] place-items-center rounded-control"
            />
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
      className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3.5"
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

      <div
        aria-hidden="true"
        className="grid grid-cols-7 gap-1 text-center text-[0.63rem] font-[650] uppercase tracking-[0.04em] text-muted"
        data-slot="tasks-calendar-weekdays"
      >
        {TASK_CALENDAR_WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <CalendarGrid busy={busy} model={model} onSelectDate={onSelectDate} />

      <Button
        className="w-full justify-center border-0 bg-panel-hover hover:bg-white/[0.12]"
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
