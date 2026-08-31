import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { CheckIcon } from "../../icons"
import { cn } from "../../lib/utils"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      tabIndex={props.disabled ? -1 : 0}
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-control border border-border bg-panel transition-[background-color,border-color,box-shadow,transform] outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/40 data-checked:border-accent data-checked:bg-accent data-checked:text-canvas hover:not-data-disabled:border-border-strong",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
