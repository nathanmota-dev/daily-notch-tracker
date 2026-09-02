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
      className="activity-panel"
      data-column="activity"
      data-slot="activity-panel"
    >
      <Divider
        aria-hidden="true"
        className="activity-panel__divider"
        orientation="vertical"
      />
      <p className="activity-panel__eyebrow">Activity</p>
      <div className="activity-panel__heading">
        <h2 id="expanded-dashboard-activity-title">Journey Streak</h2>
        <strong aria-label={`${streak} day streak`} data-slot="streak-count">
          {streak}d
        </strong>
      </div>
      <ActivityHeatmap countsByDate={countsByDate} today={today} />
      <p className="activity-panel__caption">Keep showing up</p>
    </aside>
  )
}
