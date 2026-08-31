const ACTIVITY_PREVIEW_LEVELS = [
  0, 1, 2, 0, 3, 1, 0, 1, 2, 3, 2, 1, 0, 2, 2, 3, 1, 0, 1, 3, 2, 1, 0, 0, 2,
  3, 3, 2, 1, 0, 1, 1, 2, 0, 3, 2, 1, 2, 3, 1, 0, 0, 1, 2, 1, 3, 2, 0,
] as const

export function ActivityPreviewGrid() {
  return (
    <div
      aria-label="Activity heatmap preview"
      className="activity-preview-grid"
      data-slot="activity-preview-grid"
      role="img"
    >
      {ACTIVITY_PREVIEW_LEVELS.map((level, index) => (
        <span
          aria-hidden="true"
          className="activity-preview-grid__cell"
          data-intensity={level}
          key={"activity-cell-" + index}
        />
      ))}
    </div>
  )
}
