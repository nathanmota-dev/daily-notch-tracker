import type { ButtonHTMLAttributes } from "react"

import { cn } from "../lib/utils"

export type CollapsedNotchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  className?: string
}

/** The always-present idle affordance that gives the overlay a hover target. */
export function CollapsedNotch({ className, ...props }: CollapsedNotchProps) {
  return (
    <button
      aria-label="Open focus dashboard"
      className={cn(
        "h-[var(--collapsed-notch-height)] w-[min(var(--collapsed-notch-width),calc(100vw-8px))] cursor-pointer rounded-b-[var(--collapsed-notch-radius)] border border-t-0 border-white/[0.08] bg-black p-0 shadow-[0_8px_18px_rgb(0_0_0_/_0.28)] outline-none transition-[background-color,box-shadow] duration-150 hover:bg-zinc-950 focus-visible:shadow-[0_0_0_2px_var(--ring),0_8px_18px_rgb(0_0_0_/_0.28)]",
        className,
      )}
      data-slot="collapsed-notch"
      type="button"
      {...props}
    />
  )
}
