import { ChevronLeftIcon } from "../icons"
import { cn } from "../lib/utils"
import { IconButton } from "./icon-button"
import type { BackButtonProps } from "./back-button-types"

export type { BackButtonProps } from "./back-button-types"

export function BackButton({
  ariaLabel = "Back",
  className,
  disabled = false,
  onClick,
  title,
}: BackButtonProps) {
  return (
    <IconButton
      aria-label={ariaLabel}
      className={cn(
        "shrink-0 rounded-full bg-panel-hover text-muted hover:text-content",
        className,
      )}
      data-slot="back-button"
      disabled={disabled}
      onClick={onClick}
      size="sm"
      title={title ?? ariaLabel}
      type="button"
      variant="ghost"
    >
      <ChevronLeftIcon aria-hidden="true" />
    </IconButton>
  )
}
