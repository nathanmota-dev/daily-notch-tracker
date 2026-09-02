import type { ActivityCountsByDate } from "./activity-model"
import { getActivityHeatmapModel } from "./activity-heatmap-model"

export type ActivityHeatmapProps = {
  countsByDate?: ActivityCountsByDate
  today?: Date | number
}

export function ActivityHeatmap({
  countsByDate,
  today = Date.now(),
}: ActivityHeatmapProps) {
  const model = getActivityHeatmapModel(today, countsByDate)

  return (
    <div
      aria-label={`Activity heatmap for ${model.monthLabel}`}
      className="activity-heatmap"
      data-month={`${model.year}-${String(model.month + 1).padStart(2, "0")}`}
      data-row-count={model.rowCount}
      data-slot="activity-heatmap"
      role="img"
    >
      {model.cells.map((cell, index) => (
        <span
          aria-hidden="true"
          className="activity-heatmap__cell"
          data-cell-state={cell.state}
          data-column={cell.column}
          data-date={cell.date ?? undefined}
          data-day={cell.dayOfMonth ?? undefined}
          data-intensity={cell.intensity ?? undefined}
          data-row={cell.row}
          key={cell.date ?? `empty-cell-${index}`}
        />
      ))}
    </div>
  )
}
