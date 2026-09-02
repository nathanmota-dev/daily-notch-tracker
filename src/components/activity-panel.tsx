import { Divider } from "./divider"
import type { ActivitySummary } from "./activity-model"
import { ActivityHeatmap } from "./activity-heatmap"

const EMPTY_ACTIVITY_SUMMARY: ActivitySummary = {
  countsByDate: {},
  streak: 0,
}

export type ActivityPanelProps = Partial<ActivitySummary> & {
  today?: Date | number
}

export function ActivityPanel({
  countsByDate = EMPTY_ACTIVITY_SUMMARY.countsByDate,
  streak = EMPTY_ACTIVITY_SUMMARY.streak,
  today,
}: ActivityPanelProps = {}) {
  return (
    <aside
      aria-labelledby="expanded-dashboard-activity-title"
      className="relative w-[var(--expanded-dashboard-activity-width)] min-w-[var(--expanded-dashboard-activity-width)] pl-5"
      data-column="activity"
      data-slot="activity-panel"
    >
      <Divider
        aria-hidden="true"
        className="absolute inset-y-0 left-0"
        orientation="vertical"
      />
      <p className="m-0 mb-[5px] text-[0.65rem] font-semibold uppercase leading-[1.2] tracking-[0.12em] text-muted">
        Activity
      </p>
      <div className="flex items-baseline justify-between gap-2">
        <h2
          className="m-0 text-[0.9rem] font-[650] leading-[1.2] tracking-[-0.01em] text-content"
          id="expanded-dashboard-activity-title"
        >
          Journey Streak
        </h2>
        <strong
          className="text-base font-bold leading-none tracking-[-0.04em] text-accent"
          aria-label={`${streak} day streak`}
          data-slot="streak-count"
        >
          {streak}d
        </strong>
      </div>
      <ActivityHeatmap countsByDate={countsByDate} today={today} />
      <p className="m-[10px_0_0] text-[0.67rem] text-muted">Keep showing up</p>
    </aside>
  )
}
