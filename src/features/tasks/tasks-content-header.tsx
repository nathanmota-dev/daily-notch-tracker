import { Button } from "../../components/ui/button"
import type { TasksTab } from "./tasks-model"

function formatSelectedDay(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  if (!match) {
    return "Choose a day"
  }

  const date = new Date(0)
  date.setHours(0, 0, 0, 0)
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))

  if (Number.isNaN(date.getTime())) {
    return "Choose a day"
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  }).format(date)
}

export function TasksContentHeader({
  activeTab,
  busy,
  date,
  totalCount,
  onAdd,
  onTabChange,
}: {
  activeTab: TasksTab
  busy: boolean
  date: string
  totalCount: number
  onAdd: () => void
  onTabChange: (tab: TasksTab) => void
}) {
  return (
    <header
      className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-5 max-[640px]:grid-cols-[minmax(0,1fr)]"
      data-date={date}
      data-slot="tasks-day-header"
    >
      <div>
        <p className="m-0 mb-1.5 text-[0.7rem] font-[650] uppercase tracking-[0.16em] text-muted">
          Selected day
        </p>
        <h2 className="m-0 text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.045em] text-content">
          Day
        </h2>
        <p
          className="m-0 mt-2 text-[0.9rem] text-muted"
          data-slot="tasks-day-title"
        >
          {formatSelectedDay(date)}
        </p>
        <p className="m-0 mt-2 text-[0.82rem] text-muted">
          {totalCount} {totalCount === 1 ? "tarefa" : "tarefas"}
        </p>
      </div>
      <Button
        aria-label="Add task"
        className="max-[640px]:justify-self-start"
        disabled={busy}
        onClick={onAdd}
        type="button"
      >
        Add a task
      </Button>
      <div
        aria-label="Task lists"
        className="col-span-full flex flex-wrap items-end gap-1.5 border-b border-border pt-2 max-[640px]:col-start-1"
        role="tablist"
      >
        <button
          aria-selected={activeTab === "day"}
          className="min-h-9 cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-3 text-[0.85rem] font-[650] text-muted outline-none hover:text-content aria-selected:border-accent aria-selected:text-content focus-visible:rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={() => onTabChange("day")}
          role="tab"
          type="button"
        >
          Day
        </button>
        <button
          aria-selected={activeTab === "unscheduled"}
          className="min-h-9 cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-3 text-[0.85rem] font-[650] text-muted outline-none hover:text-content aria-selected:border-accent aria-selected:text-content focus-visible:rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={() => onTabChange("unscheduled")}
          role="tab"
          type="button"
        >
          Unscheduled
        </button>
      </div>
    </header>
  )
}
