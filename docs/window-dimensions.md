# Window dimensions

DailyNotch keeps one transparent native `overlay` window plus hidden transparent
native `tasks` and `settings` webviews. Their black rounded panels provide the
visible content, while the transparent window corners preserve the shape on the
desktop. The content windows are shown and stacked below the overlay by Rust,
and the dimensions below are the shared contract for the frontend layout and
Tauri navigation.

## Contract

| Surface/state | Preferred | Minimum | Maximum | Unit |
| --- | ---: | ---: | ---: | --- |
| Overlay idle | 204 × 32 | 204 × 32 | 204 × 32 | logical px |
| Overlay collapsed | 360 × 72 | 104 × 52 | 360 × 72 | logical px |
| Overlay expanded | 620 × ≥206 | 620 × ≥206 | content-driven | logical px |
| Tasks | 800 × 550 | 760 × 480 | 800 × 550 | logical px |
| Settings | 800 × 550 | 760 × 480 | 800 × 550 | logical px |

The collapsed overlay also supports the 360 × 52 timeline-off state and the
104 × 72 or 104 × 52 minimal states. The expanded minimum includes the
transparent 8 px gutter above and below the dashboard; the visible dashboard
itself has a 190 px minimum height.

Tasks and Settings share the same logical-pixel contract in both CSS and Tauri.
Opening either view configures its native window within the content minimum and
maximum bounds, centers it below the overlay, and keeps it inside the active
monitor work area. The frontend fills the available viewport, clamps it to those
bounds, and keeps overflow inside the surface instead of allowing the document
to grow horizontally. Settings scrolls its content vertically within that
shared 800 × 550 surface.

## Scrolling and responsive layout

- Tasks reserves the desktop window height for its header, sidebar, calendar,
  task list, and form. The task list/detail area scrolls internally. Below
  640 px, the sidebar and task content stack vertically and controls use the
  available width.
- Settings uses a vertically scrolling viewport. Status messages, diagnostics
  paths, toggles, and the duration input wrap or stack below 640 px. Horizontal
  overflow is blocked so long integration messages remain readable.
- Closing Tasks or Settings hides the content webview and returns focus to the
  overlay; the current lifecycle and focus behavior are preserved.

## Overlay scale and placement

Overlay targets are measured in logical CSS pixels. Before a resize, the
frontend reads the native `scaleFactor`, converts the target to physical
pixels, and keeps the current horizontal center and top edge. The transparent
gutter is included in the physical resize, while positioning continues to use
the existing monitor and work-area calculations.

## X11 and Wayland

X11 and Wayland may report different scale factors, monitor origins, and
window-manager decorations. Tasks and Settings therefore use Tauri's logical
inner-size constraints for the content views, while the overlay retains its
physical DPI-aware resize path. The overlay adapter treats native resize or positioning failures
as recoverable so a compositor limitation does not make the React surface
unusable.
