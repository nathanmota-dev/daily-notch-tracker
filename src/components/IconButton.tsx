import type { ComponentProps } from "react"

import { Button } from "./ui/button"
import { cn } from "../lib/utils"

type IconButtonSize = "sm" | "default" | "lg"

const iconButtonSizes: Record<IconButtonSize, "icon-sm" | "icon" | "icon-lg"> =
  {
    sm: "icon-sm",
    default: "icon",
    lg: "icon-lg",
  }

export type IconButtonProps = Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "size"
> & {
  "aria-label": string
  size?: IconButtonSize
}

function IconButton({
  "aria-label": ariaLabel,
  className,
  size = "default",
  ...props
}: IconButtonProps) {
  return (
    <Button
      aria-label={ariaLabel}
      size={iconButtonSizes[size]}
      className={cn(
        "[&_svg]:size-4",
        size === "sm" && "[&_svg]:size-3.5",
        size === "lg" && "[&_svg]:size-[1.125rem]",
        className,
      )}
      {...props}
    />
  )
}

export { IconButton }
