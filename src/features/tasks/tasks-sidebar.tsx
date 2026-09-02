import { SettingsIcon } from "../../icons"
import { Button } from "../../components/ui/button"
import { TasksCalendar } from "./tasks-calendar"
import type { TasksSidebarProps } from "./tasks-sidebar-types"

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
      className="flex min-h-0 min-w-0 flex-col gap-7 overflow-y-auto rounded-panel border border-border bg-panel p-6"
      data-slot="tasks-sidebar"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 mb-1.5 text-[0.7rem] font-[650] uppercase tracking-[0.16em] text-muted">
            DailyNotch Linux
          </p>
          <h1 className="m-0 text-[clamp(1.75rem,4vw,2.35rem)] font-bold leading-[1.05] tracking-[-0.045em] text-content">
            Tasks
          </h1>
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
        className="grid gap-5 border-t border-border pt-6"
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
