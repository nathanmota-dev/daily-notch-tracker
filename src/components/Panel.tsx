import { cva, type VariantProps } from "class-variance-authority"

import { Card } from "./ui/card"
import { cn } from "../lib/utils"

const panelVariants = cva("", {
  variants: {
    variant: {
      default: "",
      normal: "",
      danger: "bg-danger/5 ring-danger/30",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export type PanelProps = React.ComponentProps<typeof Card> &
  VariantProps<typeof panelVariants>

function Panel({ className, variant = "default", ...props }: PanelProps) {
  return (
    <Card
      data-variant={variant}
      className={cn(panelVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Panel }
