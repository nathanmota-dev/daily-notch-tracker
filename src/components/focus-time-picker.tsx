import { useId, type ChangeEvent } from "react"

import { MinusIcon, PlusIcon } from "../icons"
import { cn } from "../lib/utils"
import { IconButton } from "./icon-button"
import { Button } from "./ui/button"

export const DEFAULT_FOCUS_TIME_MIN = 1
export const DEFAULT_FOCUS_TIME_MAX = 180
export const DEFAULT_FOCUS_TIME_STEP = 1

export type FocusTimePickerProps = {
  value: string
  onValueChange: (value: string) => void
  presets: readonly number[]
  error?: string
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
  const steppedValue = min + Math.round((boundedValue - min) / step) * step

  return Math.min(max, Math.max(min, steppedValue))
}

function parseNumericValue(value: string) {
  const text = value.trim()
  if (text === "") {
    return null
  }

  const numericValue = Number(text)
  return Number.isFinite(numericValue) ? numericValue : null
}

function isValidValue(value: string, min: number, max: number, step: number) {
  const text = value.trim()
  const numericValue = parseNumericValue(value)
  if (
    !/^\d+$/.test(text) ||
    numericValue === null ||
    !Number.isInteger(numericValue) ||
    numericValue < min ||
    numericValue > max
  ) {
    return false
  }

  const remainder = Math.abs((numericValue - min) % step)
  return remainder < Number.EPSILON || Math.abs(remainder - step) < Number.EPSILON
}

function emitFocusTimeValue(
  nextValue: number,
  onValueChange: (value: string) => void,
  min: number,
  max: number,
  step: number,
) {
  onValueChange(String(clampValue(nextValue, min, max, step)))
}

function handleFocusInputChange(
  event: ChangeEvent<HTMLInputElement>,
  onValueChange: (value: string) => void,
) {
  onValueChange(event.currentTarget.value)
}

function handleFocusStep(
  direction: -1 | 1,
  inputValue: string,
  min: number,
  step: number,
  emitValue: (value: number) => void,
) {
  const numericValue = parseNumericValue(inputValue) ?? min
  emitValue(numericValue + direction * step)
}

type FocusTimePickerControlsProps = {
  disabled: boolean
  decreaseDisabled: boolean
  increaseDisabled: boolean
  inputId: string
  errorId: string
  inputValue: string
  isInvalid: boolean
  max: number
  min: number
  step: number
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onStep: (direction: -1 | 1) => void
}

function FocusTimePickerControls({
  disabled,
  decreaseDisabled,
  increaseDisabled,
  inputId,
  errorId,
  inputValue,
  isInvalid,
  max,
  min,
  step,
  onInputChange,
  onStep,
}: FocusTimePickerControlsProps) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <IconButton
        aria-label="Reduzir tempo de foco"
        disabled={decreaseDisabled}
        onClick={() => onStep(-1)}
        size="sm"
        type="button"
        variant="outline"
      >
        <MinusIcon aria-hidden="true" />
      </IconButton>

      <div
        className={cn(
          "flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-control border border-border bg-panel px-2 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40",
          isInvalid &&
            "border-danger focus-within:border-danger focus-within:ring-danger/40",
        )}
      >
        <input
          aria-describedby={isInvalid ? errorId : undefined}
          aria-invalid={isInvalid}
          className="min-w-0 flex-1 bg-transparent text-center text-title font-semibold text-content outline-none"
          disabled={disabled}
          id={inputId}
          inputMode="numeric"
          max={max}
          min={min}
          onChange={onInputChange}
          step={step}
          type="number"
          value={inputValue}
        />
        <span className="text-caption text-muted">min</span>
      </div>

      <IconButton
        aria-label="Aumentar tempo de foco"
        disabled={increaseDisabled}
        onClick={() => onStep(1)}
        size="sm"
        type="button"
        variant="outline"
      >
        <PlusIcon aria-hidden="true" />
      </IconButton>
    </div>
  )
}

type FocusTimePickerPresetsProps = {
  presets: readonly number[]
  value: string
  disabled: boolean
  onSelect: (preset: number) => void
}

function FocusTimePickerPresets({
  presets,
  value,
  disabled,
  onSelect,
}: FocusTimePickerPresetsProps) {
  if (presets.length === 0) {
    return null
  }

  const numericValue = parseNumericValue(value)

  return (
    <div aria-label="Presets de tempo" className="flex flex-wrap gap-2" role="group">
      {presets.map((preset) => {
        const isSelected = numericValue === preset

        return (
          <Button
            aria-pressed={isSelected}
            disabled={disabled}
            key={preset}
            onClick={() => onSelect(preset)}
            size="sm"
            type="button"
            variant={isSelected ? "default" : "outline"}
          >
            {preset} min
          </Button>
        )
      })}
    </div>
  )
}

function FocusTimePicker({
  value,
  onValueChange,
  presets,
  error,
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
  const valueIsValid = isValidValue(value, min, max, step)
  const currentValue = parseNumericValue(value) ?? min
  const visibleError =
    error ??
    (!valueIsValid ? `Escolha um tempo entre ${min} e ${max} minutos.` : undefined)
  const isInvalid = Boolean(visibleError)

  const emitValue = (nextValue: number) =>
    emitFocusTimeValue(nextValue, onValueChange, min, max, step)
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    handleFocusInputChange(event, onValueChange)
  const handleStep = (direction: -1 | 1) =>
    handleFocusStep(direction, value, min, step, emitValue)

  const decreaseDisabled = disabled || currentValue <= min
  const increaseDisabled = disabled || currentValue >= max

  return (
    <div className={cn("space-y-3", className)} data-invalid={isInvalid || undefined}>
      <label className="text-caption font-medium text-muted" htmlFor={inputId}>
        {label}
      </label>

      <FocusTimePickerControls
        decreaseDisabled={decreaseDisabled}
        disabled={disabled}
        errorId={errorId}
        increaseDisabled={increaseDisabled}
        inputId={inputId}
        inputValue={value}
        isInvalid={isInvalid}
        max={max}
        min={min}
        onInputChange={handleInputChange}
        onStep={handleStep}
        step={step}
      />

      <FocusTimePickerPresets
        disabled={disabled}
        onSelect={emitValue}
        presets={presets}
        value={value}
      />

      {visibleError && (
        <p className="text-caption text-danger" id={errorId} role="alert">
          {visibleError}
        </p>
      )}
    </div>
  )
}

export { FocusTimePicker }
