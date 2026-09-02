import { SettingsIcon } from "../../icons"
import { Button } from "../../components/ui/button"
import type { TasksCalendarProps } from "./tasks-calendar"
import { TasksCalendar } from "./tasks-calendar"

export type TasksSidebarProps = {
  busy: boolean
  selectedDate: string
  onDateChange: (date: string) => void
  onOpenSettings: () => void
  today?: TasksCalendarProps["today"]
}

export function TasksSidebar({
  busy,
  onDateChange,
  onOpenSettings,
  selectedDate,
  today,
}: TasksSidebarProps) {
  return (
    <aside
      aria-label="Tasks sidebar"
      className="tasks-sidebar"
      data-slot="tasks-sidebar"
    >
      <header className="tasks-sidebar__header">
        <div>
          <p className="tasks-sidebar__eyebrow">DailyNotch Linux</p>
          <h1>Tasks</h1>
        </div>
        <Button
          aria-label="Settings"
          disabled={busy}
          onClick={onOpenSettings}
          size="sm"
          type="button"
          variant="ghost"
        >
          <SettingsIcon aria-hidden="true" />
          <span>Settings</span>
        </Button>
      </header>

      <section
        aria-labelledby="tasks-calendar-heading"
        className="tasks-sidebar__calendar"
        data-slot="tasks-calendar"
      >
        <h2 id="tasks-calendar-heading" className="sr-only">
          Calendar
        </h2>
        <TasksCalendar
          busy={busy}
          onSelectDate={onDateChange}
          selectedDate={selectedDate}
          today={today}
        />
      </section>
    </aside>
  )
}
