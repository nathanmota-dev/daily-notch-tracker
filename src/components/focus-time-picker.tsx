import { useEffect, useId, useState, type ChangeEvent } from "react"

import { IconButton } from "./icon-button"
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

function emitFocusTimeValue(
  nextValue: number,
  onValueChange: (value: number) => void,
  min: number,
  max: number,
  step: number,
) {
  onValueChange(clampValue(nextValue, min, max, step))
}

function handleFocusInputChange(
  event: ChangeEvent<HTMLInputElement>,
  setInputValue: (value: string) => void,
  emitValue: (value: number) => void,
) {
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

function handleFocusInputBlur(
  inputValue: string,
  value: number,
  valueIsValid: boolean,
  currentValue: number,
  min: number,
  max: number,
  step: number,
  setInputValue: (value: string) => void,
  emitValue: (value: number) => void,
) {
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

function handleFocusStep(
  direction: -1 | 1,
  currentValue: number,
  step: number,
  emitValue: (value: number) => void,
) {
  emitValue(currentValue + direction * step)
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
  onInputBlur: () => void
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
  onInputBlur,
  onInputChange,
  onStep,
}: FocusTimePickerControlsProps) {
  return (
    <div className="flex items-center gap-2">
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
          onBlur={onInputBlur}
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
  value: number
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

  return (
    <div aria-label="Presets de tempo" className="flex flex-wrap gap-2" role="group">
      {presets.map((preset) => {
        const isSelected = value === preset

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

  const emitValue = (nextValue: number) =>
    emitFocusTimeValue(nextValue, onValueChange, min, max, step)
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    handleFocusInputChange(event, setInputValue, emitValue)
  const handleInputBlur = () =>
    handleFocusInputBlur(
      inputValue,
      value,
      valueIsValid,
      currentValue,
      min,
      max,
      step,
      setInputValue,
      emitValue,
    )
  const handleStep = (direction: -1 | 1) =>
    handleFocusStep(direction, currentValue, step, emitValue)

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
        inputValue={inputValue}
        isInvalid={isInvalid}
        max={max}
        min={min}
        onInputBlur={handleInputBlur}
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

      {isInvalid && (
        <p className="text-caption text-danger" id={errorId} role="alert">
          Escolha um tempo entre {min} e {max} minutos.
        </p>
      )}
    </div>
  )
}

export { FocusTimePicker }
