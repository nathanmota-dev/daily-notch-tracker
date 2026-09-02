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
        "group relative grid size-full min-h-[30px] cursor-pointer place-items-center rounded-control border border-transparent bg-transparent p-0 text-[0.78rem] text-content outline-none transition-[background-color,border-color,color,box-shadow] duration-150 hover:bg-panel-hover focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50",
        isToday && "border-accent text-accent",
        isSelected && "bg-accent text-canvas",
        isSelected && isToday &&
          "shadow-[inset_0_0_0_2px_var(--canvas)]",
      )}
      data-date={date}
      data-selected={isSelected ? "true" : "false"}
      data-today={isToday ? "true" : "false"}
      disabled={busy}
      onClick={() => onSelectDate(date)}
      type="button"
    >
      <span>{dayOfMonth}</span>
      {isToday && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-1 size-1 rounded-full",
            isSelected ? "bg-canvas" : "bg-accent",
          )}
        />
      )}
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
    <header className="flex items-center justify-between gap-3">
      <div>
        <p className="m-0 mb-1.5 text-[0.7rem] font-[650] uppercase tracking-[0.16em] text-muted">
          Planning
        </p>
        <h3
          aria-live="polite"
          className="m-0 text-base font-[650] leading-[1.2] tracking-[-0.01em] text-content"
        >
          {monthLabel}
        </h3>
      </div>
      <div className="flex gap-0.5">
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
}: TasksCalendarGridProps) {
  return (
    <div
      aria-label={`Calendar for ${model.monthLabel}`}
      className="grid grid-cols-7 gap-1"
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
      className="grid gap-3.5"
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
        className="justify-self-start"
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
