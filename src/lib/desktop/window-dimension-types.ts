export type WindowSize = Readonly<{
  width: number
  height: number
}>

export type WindowDimensionContract = Readonly<{
  preferred: WindowSize
  minimum: WindowSize
  maximum: WindowSize
}>

export type OverlayExpandedDimension = Readonly<{
  width: number
  minHeight: number
}>

export type OverlayWindowDimensionContract = Readonly<{
  idle: WindowSize
  collapsed: WindowSize
  minimal: WindowSize
  timelineOff: WindowSize
  expanded: OverlayExpandedDimension
}>
