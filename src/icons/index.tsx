import type { IconBaseProps, IconType } from "react-icons"
import {
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiChevronsDown,
  FiChevronsUp,
  FiClock,
  FiMinus,
  FiMove,
  FiPause,
  FiPlay,
  FiPlus,
  FiSettings,
  FiX,
} from "react-icons/fi"

export type AppIconProps = IconBaseProps
export type AppIcon = IconType

export const icons = {
  clock: FiClock,
  play: FiPlay,
  pause: FiPause,
  check: FiCheck,
  plus: FiPlus,
  minus: FiMinus,
  settings: FiSettings,
  close: FiX,
  grip: FiMove,
  chevronUp: FiChevronUp,
  chevronDown: FiChevronDown,
  chevronLeft: FiChevronLeft,
  chevronRight: FiChevronRight,
  chevronsUp: FiChevronsUp,
  chevronsDown: FiChevronsDown,
} satisfies Record<string, AppIcon>

export const {
  clock: ClockIcon,
  play: PlayIcon,
  pause: PauseIcon,
  check: CheckIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  settings: SettingsIcon,
  close: CloseIcon,
  grip: GripIcon,
  chevronUp: ChevronUpIcon,
  chevronDown: ChevronDownIcon,
  chevronLeft: ChevronLeftIcon,
  chevronRight: ChevronRightIcon,
  chevronsUp: ChevronsUpIcon,
  chevronsDown: ChevronsDownIcon,
} = icons
