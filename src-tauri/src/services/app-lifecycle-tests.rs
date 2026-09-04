use std::sync::{Arc, Mutex};

use chrono::{Duration, Utc};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use super::*;
use crate::domain::FocusState;
use crate::services::{GlobalShortcutService, MockShortcutBackend, WindowNavigationState};
use crate::state::AppState;

fn test_app() -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .manage(Mutex::new(AppState::default()))
        .manage(AppLifecycleState::new())
        .manage(WindowNavigationState::new())
        .manage(FocusScheduler::new())
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build")
}

fn test_app_with_shortcut(
    backend: Arc<MockShortcutBackend>,
) -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .manage(Mutex::new(AppState::default()))
        .manage(AppLifecycleState::new())
        .manage(WindowNavigationState::new())
        .manage(FocusScheduler::new())
        .manage(GlobalShortcutService::new(backend))
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build")
}

fn create_overlay_window(
    app: &tauri::App<tauri::test::MockRuntime>,
) -> WebviewWindow<tauri::test::MockRuntime> {
    WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("index.html".into()))
        .build()
        .expect("overlay window should build")
}

#[test]
fn second_instance_focus_targets_the_single_overlay() {
    let app = test_app();
    let overlay = create_overlay_window(&app);

    focus_overlay(app.handle()).expect("overlay should be focused");
    assert_eq!(app.handle().webview_windows().len(), 1);
    assert_eq!(overlay.label(), "overlay");
}

#[test]
fn second_instance_focus_reports_a_missing_overlay() {
    let app = test_app();

    assert_eq!(
        focus_overlay(app.handle())
            .expect_err("missing overlay should be reported")
            .code,
        crate::domain::AppErrorCode::IntegrationUnavailable
    );
}

fn run_focus_exit_scenario(paused: bool) -> FocusState {
    let app = test_app();
    let handle = app.handle().clone();
    let _overlay = create_overlay_window(&app);
    let focus_state = handle
        .try_state::<Mutex<AppState>>()
        .expect("application state should be managed");
    let mut focus_state = focus_state
        .lock()
        .expect("application state should not be poisoned");
    focus_state
        .start_focus_at(None, Utc::now())
        .expect("focus should start");
    if paused {
        focus_state
            .pause_focus_at(Utc::now())
            .expect("focus should pause");
    }
    drop(focus_state);

    let scheduler = handle
        .try_state::<FocusScheduler>()
        .expect("focus scheduler should be managed");
    if !paused {
        scheduler.schedule(Utc::now() + Duration::minutes(30), || {});
    }

    handle_run_event(&handle, RunEvent::Exit);

    let app_state = handle
        .try_state::<Mutex<AppState>>()
        .expect("application state should be managed");
    let state = app_state
        .lock()
        .expect("application state should not be poisoned");

    state.snapshot().focus.state
}

#[test]
fn exit_cleanup_preserves_running_and_paused_focus_until_shutdown() {
    assert_eq!(run_focus_exit_scenario(false), FocusState::Running);

    assert_eq!(run_focus_exit_scenario(true), FocusState::Paused);
}

#[test]
fn run_event_exit_cancels_focus_scheduler() {
    let app = test_app();
    let handle = app.handle().clone();
    let scheduler = handle
        .try_state::<FocusScheduler>()
        .expect("focus scheduler should be managed");
    scheduler.schedule(Utc::now() + Duration::hours(1), || {});
    assert!(scheduler.is_scheduled());

    handle_run_event(&handle, RunEvent::Exit);

    assert!(!scheduler.is_scheduled());
    assert!(handle
        .try_state::<AppLifecycleState>()
        .expect("lifecycle state should be managed")
        .is_cleanup_started());
}

#[test]
fn exit_cleanup_is_idempotent() {
    let app = test_app();
    let handle = app.handle().clone();
    let scheduler = handle
        .try_state::<FocusScheduler>()
        .expect("focus scheduler should be managed");

    scheduler.schedule(Utc::now() + Duration::hours(1), || {});
    cleanup_before_exit(&handle);
    assert!(!scheduler.is_scheduled());

    scheduler.schedule(Utc::now() + Duration::hours(1), || {});
    cleanup_before_exit(&handle);
    assert!(scheduler.is_scheduled());
    scheduler.cancel();
}

#[test]
fn exit_cleanup_unregisters_the_shortcut_once() {
    let backend = Arc::new(MockShortcutBackend::default());
    let app = test_app_with_shortcut(backend.clone());
    let handle = app.handle().clone();
    handle
        .state::<GlobalShortcutService>()
        .register()
        .expect("shortcut should register");

    cleanup_before_exit(&handle);
    cleanup_before_exit(&handle);

    assert_eq!(backend.unregister_calls(), 1);
}

#[test]
fn shortcut_cleanup_failure_does_not_keep_scheduler_running() {
    let backend = Arc::new(MockShortcutBackend::default());
    let app = test_app_with_shortcut(backend.clone());
    let handle = app.handle().clone();
    handle
        .state::<GlobalShortcutService>()
        .register()
        .expect("shortcut should register");
    backend.set_unregister_error(Some(
        crate::services::global_shortcut_types::ShortcutBackendError::Failed,
    ));

    let scheduler = handle
        .try_state::<FocusScheduler>()
        .expect("focus scheduler should be managed");
    scheduler.schedule(Utc::now() + Duration::hours(1), || {});
    cleanup_before_exit(&handle);

    assert_eq!(backend.unregister_calls(), 1);
    assert!(!scheduler.is_scheduled());
}

#[test]
fn lifecycle_state_allows_only_one_shutdown_request() {
    let lifecycle = AppLifecycleState::new();

    assert!(!lifecycle.is_shutting_down());
    assert!(lifecycle.request_shutdown());
    assert!(!lifecycle.request_shutdown());
    assert!(lifecycle.is_shutting_down());
    assert!(lifecycle.start_cleanup());
    assert!(!lifecycle.start_cleanup());
}
