use super::super::window_navigation_types::{OverlayPresentationMode, SurfaceLabel};
use super::WindowNavigationState;

#[test]
fn navigation_state_starts_on_the_overlay_without_an_origin() {
    let state = WindowNavigationState::new();

    let snapshot = state
        .snapshot()
        .expect("navigation state should be readable");

    assert_eq!(snapshot.active_surface, SurfaceLabel::Overlay);
    assert_eq!(snapshot.presentation_origin, None);
}

#[test]
fn navigation_state_tracks_the_active_surface_and_origin() {
    let state = WindowNavigationState::new();

    state
        .transition_to(SurfaceLabel::Tasks, Some(OverlayPresentationMode::Expanded))
        .expect("tasks surface should be recorded");
    state
        .transition_to(
            SurfaceLabel::Settings,
            Some(OverlayPresentationMode::Expanded),
        )
        .expect("settings surface should be recorded");

    let snapshot = state
        .snapshot()
        .expect("navigation state should be readable");

    assert_eq!(snapshot.active_surface, SurfaceLabel::Settings);
    assert_eq!(
        snapshot.presentation_origin,
        Some(OverlayPresentationMode::Expanded)
    );
}

#[test]
fn navigation_state_clears_the_origin_when_returning_to_the_overlay() {
    let state = WindowNavigationState::new();

    state
        .transition_to(SurfaceLabel::Tasks, Some(OverlayPresentationMode::Expanded))
        .expect("tasks surface should be recorded");
    state
        .transition_to(SurfaceLabel::Overlay, None)
        .expect("overlay surface should be recorded");

    let snapshot = state
        .snapshot()
        .expect("navigation state should be readable");

    assert_eq!(snapshot.active_surface, SurfaceLabel::Overlay);
    assert_eq!(snapshot.presentation_origin, None);
}
