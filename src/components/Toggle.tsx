import { Switch } from "./ui/switch"

export type ToggleProps = Omit<
  React.ComponentProps<typeof Switch>,
  "checked" | "onCheckedChange"
> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function Toggle({ checked, onCheckedChange, ...props }: ToggleProps) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={(nextChecked) => onCheckedChange(nextChecked)}
      {...props}
    />
  )
}

export { Toggle }
