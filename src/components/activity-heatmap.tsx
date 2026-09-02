import type { ActivityCountsByDate } from "./activity-model"
import { getActivityHeatmapModel } from "./activity-heatmap-model"
import { cn } from "../lib/utils"

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
      className="mt-3.5 grid w-full grid-cols-7 gap-1"
      data-month={`${model.year}-${String(model.month + 1).padStart(2, "0")}`}
      data-row-count={model.rowCount}
      data-slot="activity-heatmap"
      role="img"
    >
      {model.cells.map((cell, index) => (
        <span
          aria-hidden="true"
          className={cn(
            "aspect-square min-w-0 rounded-[3px] bg-white/[0.07]",
            cell.state === "future" || cell.state === "outside-month"
              ? "bg-transparent shadow-none"
              : cell.intensity === 1
                ? "bg-accent/[0.32]"
                : cell.intensity === 2
                  ? "bg-accent/[0.58]"
                  : cell.intensity === 3
                    ? "bg-accent/[0.8]"
                    : cell.intensity === 4
                      ? "bg-accent shadow-[0_0_8px_rgb(96_165_250_/_0.22)]"
                      : undefined,
          )}
          data-cell-state={cell.state}
          data-column={cell.column}
          data-date={cell.date ?? undefined}
          data-day={cell.dayOfMonth ?? undefined}
          data-intensity={cell.intensity ?? undefined}
          data-row={cell.row}
          data-slot="activity-heatmap-cell"
          key={cell.date ?? `empty-cell-${index}`}
        />
      ))}
    </div>
  )
}
