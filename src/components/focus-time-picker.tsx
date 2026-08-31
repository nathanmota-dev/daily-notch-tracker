import { useEffect, useId, useState, type ChangeEvent } from "react"

import { IconButton } from "./IconButton"
import { Button } from "./ui/button"
import { MinusIcon, PlusIcon } from "../icons"
import { cn } from "../lib/utils"

export const DEFAULT_FOCUS_TIME_MIN = 1
export const DEFAULT_FOCUS_TIME_MAX = 180
export const DEFAULT_FOCUS_TIME_STEP = 1

export type FocusTimePickerProps = {
  value: number
  onValueChange: (value: number) => void
  presets: readonly number[]
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  id?: string
  label?: string
  className?: string
}

function clampValue(value: number, min: number, max: number, step: number) {
  const safeValue = Number.isFinite(value) ? value : min
  const boundedValue = Math.min(max, Math.max(min, safeValue))
  const steppedValue =
    min + Math.round((boundedValue - min) / step) * step

  return Math.min(max, Math.max(min, steppedValue))
}

function isValidValue(value: number, min: number, max: number, step: number) {
  if (!Number.isFinite(value) || value < min || value > max) {
    return false
  }

  const remainder = Math.abs((value - min) % step)
  return remainder < Number.EPSILON || Math.abs(remainder - step) < Number.EPSILON
}

function FocusTimePicker({
  value,
  onValueChange,
  presets,
  min = DEFAULT_FOCUS_TIME_MIN,
  max = DEFAULT_FOCUS_TIME_MAX,
  step = DEFAULT_FOCUS_TIME_STEP,
  disabled = false,
  id,
  label = "Tempo de foco",
  className,
}: FocusTimePickerProps) {
  const generatedId = useId().replaceAll(":", "")
  const inputId = id ?? `focus-time-${generatedId}`
  const errorId = `${inputId}-error`
  const [inputValue, setInputValue] = useState(String(value))
  const valueIsValid = isValidValue(value, min, max, step)
  const currentValue = Number.isFinite(value) ? value : min
  const isInvalid = !valueIsValid

  useEffect(() => {
    setInputValue(String(value))
  }, [value])

  function emitValue(nextValue: number) {
    onValueChange(clampValue(nextValue, min, max, step))
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextInputValue = event.currentTarget.value
    setInputValue(nextInputValue)

    if (nextInputValue.trim() === "") {
      return
    }

    const nextValue = Number(nextInputValue)

    if (Number.isFinite(nextValue)) {
      emitValue(nextValue)
    }
  }

  function handleInputBlur() {
    const parsedValue = Number(inputValue)

    if (inputValue.trim() === "" || !Number.isFinite(parsedValue)) {
      const fallbackValue = valueIsValid
        ? value
        : clampValue(currentValue, min, max, step)
      setInputValue(String(fallbackValue))
      emitValue(fallbackValue)
      return
    }

    const normalizedValue = clampValue(parsedValue, min, max, step)
    setInputValue(String(normalizedValue))
    emitValue(normalizedValue)
  }

  function handleStep(direction: -1 | 1) {
    emitValue(currentValue + direction * step)
  }

  const decreaseDisabled = disabled || currentValue <= min
  const increaseDisabled = disabled || currentValue >= max

  return (
    <div className={cn("space-y-3", className)} data-invalid={isInvalid || undefined}>
      <label className="text-caption font-medium text-muted" htmlFor={inputId}>
        {label}
      </label>

      <div className="flex items-center gap-2">
        <IconButton
          aria-label="Reduzir tempo de foco"
          disabled={decreaseDisabled}
          onClick={() => handleStep(-1)}
          size="sm"
          type="button"
          variant="outline"
        >
          <MinusIcon aria-hidden="true" />
        </IconButton>

        <div
          className={cn(
            "flex h-10 min-w-28 items-center justify-center gap-1 rounded-control border border-border bg-panel px-2 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40",
            isInvalid &&
              "border-danger focus-within:border-danger focus-within:ring-danger/40",
          )}
        >
          <input
            aria-describedby={isInvalid ? errorId : undefined}
            aria-invalid={isInvalid}
            className="w-16 bg-transparent text-center text-title font-semibold text-content outline-none"
            disabled={disabled}
            id={inputId}
            inputMode="numeric"
            max={max}
            min={min}
            onBlur={handleInputBlur}
            onChange={handleInputChange}
            step={step}
            type="number"
            value={inputValue}
          />
          <span className="text-caption text-muted">min</span>
        </div>

        <IconButton
          aria-label="Aumentar tempo de foco"
          disabled={increaseDisabled}
          onClick={() => handleStep(1)}
          size="sm"
          type="button"
          variant="outline"
        >
          <PlusIcon aria-hidden="true" />
        </IconButton>
      </div>

      {presets.length > 0 && (
        <div aria-label="Presets de tempo" className="flex flex-wrap gap-2" role="group">
          {presets.map((preset) => {
            const isSelected = value === preset

            return (
              <Button
                aria-pressed={isSelected}
                disabled={disabled}
                key={preset}
                onClick={() => emitValue(preset)}
                size="sm"
                type="button"
                variant={isSelected ? "default" : "outline"}
              >
                {preset} min
              </Button>
            )
          })}
        </div>
      )}

      {isInvalid && (
        <p className="text-caption text-danger" id={errorId} role="alert">
          Escolha um tempo entre {min} e {max} minutos.
        </p>
      )}
    </div>
  )
}

export { FocusTimePicker }
