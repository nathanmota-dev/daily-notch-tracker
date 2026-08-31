import { Divider } from "./divider"
import {
  ActivityHeatmap,
  type ActivityHeatmapProps,
} from "./activity-heatmap"

export type ActivityPanelProps = Pick<
  ActivityHeatmapProps,
  "levelsByDay" | "today"
>

export function ActivityPanel({ levelsByDay, today }: ActivityPanelProps = {}) {
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
        <strong aria-label="5 day streak" data-slot="streak-count">
          5d
        </strong>
      </div>
      <ActivityHeatmap levelsByDay={levelsByDay} today={today} />
      <p className="activity-panel__caption">Keep showing up</p>
    </aside>
  )
}
