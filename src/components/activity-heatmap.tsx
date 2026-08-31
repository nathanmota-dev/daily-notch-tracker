import {
  getActivityHeatmapModel,
  type ActivityLevelsByDay,
} from "./activity-heatmap-model"

export type ActivityHeatmapProps = {
  levelsByDay?: ActivityLevelsByDay
  today?: Date
}

export function ActivityHeatmap({
  levelsByDay,
  today = new Date(),
}: ActivityHeatmapProps) {
  const model = getActivityHeatmapModel(today, levelsByDay)

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
