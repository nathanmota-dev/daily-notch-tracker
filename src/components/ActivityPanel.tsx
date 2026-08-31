import { Divider } from "./Divider"
import { ActivityPreviewGrid } from "./ActivityPreviewGrid"

export function ActivityPanel() {
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
      <h2 id="expanded-dashboard-activity-title">Journey Streak</h2>
      <div className="activity-panel__streak">
        <strong data-slot="streak-count">12</strong>
        <span>day streak</span>
      </div>
      <ActivityPreviewGrid />
      <p className="activity-panel__caption">Keep showing up</p>
    </aside>
  )
}
