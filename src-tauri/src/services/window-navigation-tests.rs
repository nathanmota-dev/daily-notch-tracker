use super::super::window_navigation_types::{
    ManagedWindowLabel, OverlayPresentationMode, TasksWindowOrigin,
};
use super::WindowNavigationState;

#[test]
fn navigation_state_tracks_visible_and_focused_windows() {
    let state = WindowNavigationState::new();

    state
        .register_visible_window("overlay")
        .expect("overlay should be registered");
    state
        .record_shown_and_focused("tasks")
        .expect("tasks should be focused");
    state
        .record_shown_and_focused("settings")
        .expect("settings should be focused");

    let snapshot = state
        .snapshot()
        .expect("navigation state should be readable");
    assert_eq!(snapshot.focused_window, Some(ManagedWindowLabel::Settings));
    assert!(snapshot
        .visible_windows
        .contains(&ManagedWindowLabel::Overlay));
    assert!(snapshot
        .visible_windows
        .contains(&ManagedWindowLabel::Tasks));
    assert!(snapshot
        .visible_windows
        .contains(&ManagedWindowLabel::Settings));
}

#[test]
fn navigation_state_clears_focus_when_a_window_is_hidden() {
    let state = WindowNavigationState::new();
    state
        .record_shown_and_focused("tasks")
        .expect("tasks should be focused");

    state
        .record_hidden("tasks")
        .expect("tasks should be hidden");

    let snapshot = state
        .snapshot()
        .expect("navigation state should be readable");
    assert_eq!(snapshot.focused_window, None);
    assert!(!snapshot
        .visible_windows
        .contains(&ManagedWindowLabel::Tasks));
}

#[test]
fn navigation_state_remembers_overlay_presentation_origin() {
    let state = WindowNavigationState::new();
    let origin = TasksWindowOrigin {
        presentation_mode: OverlayPresentationMode::Expanded,
    };

    state
        .remember_tasks_origin(Some(origin))
        .expect("tasks origin should be stored");

    assert_eq!(
        state
            .tasks_window_origin()
            .expect("tasks origin should be readable"),
        Some(origin)
    );

    state
        .clear_tasks_window_origin()
        .expect("tasks origin should be cleared");
    assert_eq!(
        state
            .tasks_window_origin()
            .expect("tasks origin should be readable"),
        None
    );
}
