import { SettingsIcon } from "../../icons"
import { Button } from "../../components/ui/button"

export type TasksSidebarProps = {
  busy: boolean
  selectedDate: string
  onDateChange: (date: string) => void
  onOpenSettings: () => void
}

export function TasksSidebar({
  busy,
  onDateChange,
  onOpenSettings,
  selectedDate,
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
        <div className="tasks-sidebar__section-heading">
          <div>
            <p className="tasks-sidebar__eyebrow">Planning</p>
            <h2 id="tasks-calendar-heading">Calendar</h2>
          </div>
        </div>
        <label className="tasks-sidebar__date-label">
          <span>Selected day</span>
          <input
            aria-label="Selected day"
            disabled={busy}
            onChange={(event) => onDateChange(event.currentTarget.value)}
            type="date"
            value={selectedDate}
          />
        </label>
      </section>
    </aside>
  )
}
