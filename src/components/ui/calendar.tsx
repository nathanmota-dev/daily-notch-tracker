"use client"

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "lucide-react"
import { DayPicker } from "react-day-picker"
import type { ChevronProps } from "react-day-picker"

import { cn } from "../../lib/utils"
import type { CalendarProps } from "./calendar-types"

function CalendarChevron({
  className,
  disabled,
  orientation,
  size = 16,
  style,
}: ChevronProps) {
  const Icon =
    orientation === "left"
      ? ChevronLeftIcon
      : orientation === "right"
        ? ChevronRightIcon
        : orientation === "up"
          ? ChevronUpIcon
          : ChevronDownIcon

  return (
    <Icon
      aria-hidden="true"
      className={className}
      data-disabled={disabled || undefined}
      size={size}
      style={style}
    />
  )
}

function Calendar({
  className,
  classNames,
  components,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <div data-slot="calendar">
      <DayPicker
        className={cn("w-fit p-3", className)}
        classNames={{
          root: "w-fit",
          months: "flex flex-col gap-4",
          month: "relative flex flex-col gap-4",
          month_caption: "flex h-7 items-center justify-center px-8",
          caption_label: "text-sm font-medium",
          nav: "flex items-center gap-1",
          button_previous:
            "absolute left-1 inline-flex size-7 items-center justify-center rounded-control border border-transparent bg-transparent p-0 text-muted outline-none transition-colors hover:bg-panel-hover hover:text-content focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          button_next:
            "absolute right-1 inline-flex size-7 items-center justify-center rounded-control border border-transparent bg-transparent p-0 text-muted outline-none transition-colors hover:bg-panel-hover hover:text-content focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          month_grid: "w-full border-collapse",
          weekdays: "flex",
          weekday: "w-9 rounded-control text-center text-[0.7rem] font-medium text-muted",
          week: "mt-2 flex w-full",
          day: "relative size-9 p-0 text-center text-sm",
          day_button:
            "inline-flex size-9 items-center justify-center rounded-control border border-transparent p-0 font-normal text-content outline-none transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-ring",
          selected:
            "[&_.rdp-day_button]:border-accent [&_.rdp-day_button]:bg-accent [&_.rdp-day_button]:text-canvas [&_.rdp-day_button]:hover:bg-accent/85",
          today: "[&_.rdp-day_button]:border-accent",
          outside: "text-muted opacity-50",
          disabled: "text-muted opacity-50",
          hidden: "invisible",
          ...classNames,
        }}
        components={{
          Chevron: CalendarChevron,
          ...components,
        }}
        showOutsideDays={showOutsideDays}
        {...props}
      />
    </div>
  )
}

export { Calendar }
