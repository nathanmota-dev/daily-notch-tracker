import { Separator } from "./ui/separator"
import { cn } from "../lib/utils"

export type DividerProps = React.ComponentProps<typeof Separator>

function Divider({ className, ...props }: DividerProps) {
  return (
    <Separator
      data-slot="divider"
      className={cn("bg-border/90", className)}
      {...props}
    />
  )
}

export { Divider }
