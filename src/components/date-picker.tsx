"use client"

import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { useState } from "react"

import { getLocalDateString, parseLocalDateString } from "../lib/local-date"
import { cn } from "../lib/utils"
import { Button } from "./ui/button"
import { Calendar } from "./ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover"
import type { DatePickerProps } from "./date-picker-types"

export type { DatePickerProps } from "./date-picker-types"

export function DatePicker({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
  disabled = false,
  id,
  onValueChange,
  value,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const date = parseLocalDateString(value)

  function handleSelect(selectedDate: Date | undefined) {
    onValueChange(selectedDate ? getLocalDateString(selectedDate) : "")
    setOpen(false)
  }

  function clearDate() {
    onValueChange("")
    setOpen(false)
  }

  return (
    <div className="w-full min-w-0" data-slot="date-picker">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              aria-describedby={ariaDescribedBy}
              aria-invalid={ariaInvalid}
              className={cn(
                "h-10 w-full min-w-0 justify-start gap-2 overflow-hidden text-left font-normal data-[empty=true]:text-muted",
                className,
              )}
              data-empty={!date}
              data-value={value || undefined}
              disabled={disabled}
              id={id}
              variant="outline"
            />
          }
        >
          <CalendarIcon aria-hidden="true" />
          <span className="min-w-0 truncate">
            {date ? format(date, "PPP") : "Pick a date"}
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            aria-label="Choose a date"
            defaultMonth={date}
            mode="single"
            onSelect={handleSelect}
            selected={date}
          />
          {date && (
            <div className="flex justify-end border-t border-border p-2">
              <Button
                onClick={clearDate}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear date
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
