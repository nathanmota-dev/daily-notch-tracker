use std::sync::{
    atomic::{AtomicBool, AtomicU8, Ordering},
    Arc, Mutex,
};
use std::time::Duration as StdDuration;

use chrono::{Duration, Utc};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

use super::*;
use crate::domain::FocusState;
use crate::state::AppState;

fn test_app() -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .manage(Mutex::new(AppState::default()))
        .manage(AppLifecycleState::new())
        .manage(FocusScheduler::new())
        .on_window_event(handle_window_event)
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build")
}

fn create_window(
    app: &tauri::App<tauri::test::MockRuntime>,
    label: &str,
) -> WebviewWindow<tauri::test::MockRuntime> {
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .build()
        .expect("test window should build")
}

fn wait_for_close_event() {
    std::thread::sleep(StdDuration::from_millis(10));
}

#[test]
fn second_instance_focus_prefers_tasks_and_falls_back_to_overlay() {
    let app = test_app();
    let handle = app.handle().clone();
    let _overlay = create_window(&app, "overlay");

    assert_eq!(preferred_focus_window_label(&handle), Some("overlay"));
    focus_tasks_or_overlay(&handle).expect("overlay should be focused");

    let _tasks = create_window(&app, "tasks");

    assert_eq!(preferred_focus_window_label(&handle), Some("tasks"));
    focus_tasks_or_overlay(&handle).expect("tasks should be focused");
}

#[test]
fn second_instance_focus_reports_a_missing_overlay() {
    let app = test_app();
    let handle = app.handle().clone();

    assert_eq!(preferred_focus_window_label(&handle), None);
    assert_eq!(
        focus_tasks_or_overlay(&handle)
            .expect_err("missing overlay should be reported")
            .code,
        crate::domain::AppErrorCode::IntegrationUnavailable
    );
}

#[test]
fn reusable_window_close_is_intercepted_without_removing_the_window() {
    let app = test_app();
    let overlay = create_window(&app, "overlay");
    let tasks = create_window(&app, "tasks");
    let settings = create_window(&app, "settings");
    handle_window_event(&tasks.as_ref().window(), &WindowEvent::Focused(true));
    handle_window_event(&overlay.as_ref().window(), &WindowEvent::Focused(true));
    let close_tasks = tasks.clone();
    let settings_for_run = settings.clone();
    let tasks_preserved = Arc::new(AtomicBool::new(false));
    let settings_preserved = Arc::new(AtomicBool::new(false));
    let tasks_preserved_for_run = Arc::clone(&tasks_preserved);
    let settings_preserved_for_run = Arc::clone(&settings_preserved);

    let closer = std::thread::spawn(move || {
        wait_for_close_event();
        close_tasks.close().expect("tasks window should close");
    });

    let exit_code = app.run_return(move |handle, event| {
        if let RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { .. },
            ..
        } = event
        {
            if label == "tasks" {
                tasks_preserved_for_run.store(
                    handle.get_webview_window("tasks").is_some(),
                    Ordering::Release,
                );
                settings_for_run
                    .close()
                    .expect("settings window should close");
            } else if label == "settings" {
                settings_preserved_for_run.store(
                    handle.get_webview_window("settings").is_some(),
                    Ordering::Release,
                );
                handle
                    .get_webview_window("tasks")
                    .expect("tasks window should still exist")
                    .destroy()
                    .expect("tasks window should be destroyable in the test");
                handle
                    .get_webview_window("settings")
                    .expect("settings window should still exist")
                    .destroy()
                    .expect("settings window should be destroyable in the test");
                handle
                    .get_webview_window("overlay")
                    .expect("overlay window should still exist")
                    .destroy()
                    .expect("overlay window should be destroyable in the test");
            }
        }
    });

    closer.join().expect("window closer should finish");
    assert_eq!(exit_code, 0);
    assert!(tasks_preserved.load(Ordering::Acquire));
    assert!(settings_preserved.load(Ordering::Acquire));
}

fn run_focus_close_scenario(paused: bool) -> (FocusState, bool) {
    let app = test_app();
    let handle = app.handle().clone();
    let _overlay = create_window(&app, "overlay");
    let tasks = create_window(&app, "tasks");
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

    let observed_focus_state = Arc::new(AtomicU8::new(0));
    let observed_focus_state_for_run = Arc::clone(&observed_focus_state);
    let observed_scheduler = Arc::new(AtomicBool::new(false));
    let observed_scheduler_for_run = Arc::clone(&observed_scheduler);
    let close_tasks = tasks.clone();
    let closer = std::thread::spawn(move || {
        wait_for_close_event();
        close_tasks.close().expect("tasks window should close");
    });

    let exit_code = app.run_return(move |handle, event| {
        if let RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { .. },
            ..
        } = event
        {
            if label == "tasks" {
                let state = handle
                    .try_state::<Mutex<AppState>>()
                    .expect("application state should be managed");
                let state = state
                    .lock()
                    .expect("application state should not be poisoned");
                observed_focus_state_for_run.store(
                    match state.snapshot().focus.state {
                        FocusState::Running => 1,
                        FocusState::Paused => 2,
                        FocusState::Idle => 3,
                    },
                    Ordering::Release,
                );
                observed_scheduler_for_run.store(
                    handle
                        .try_state::<FocusScheduler>()
                        .expect("focus scheduler should be managed")
                        .is_scheduled(),
                    Ordering::Release,
                );
                handle
                    .get_webview_window("tasks")
                    .expect("tasks window should still exist")
                    .destroy()
                    .expect("tasks window should be destroyable in the test");
                handle
                    .get_webview_window("overlay")
                    .expect("overlay window should still exist")
                    .destroy()
                    .expect("overlay window should be destroyable in the test");
            }
        }
    });

    closer.join().expect("window closer should finish");
    assert_eq!(exit_code, 0);

    let state = match observed_focus_state.load(Ordering::Acquire) {
        1 => FocusState::Running,
        2 => FocusState::Paused,
        3 => FocusState::Idle,
        _ => panic!("close event did not observe focus state"),
    };
    (state, observed_scheduler.load(Ordering::Acquire))
}

#[test]
fn reusable_window_close_preserves_running_and_paused_focus() {
    let (running_state, running_scheduler) = run_focus_close_scenario(false);
    assert_eq!(running_state, FocusState::Running);
    assert!(running_scheduler);

    let (paused_state, paused_scheduler) = run_focus_close_scenario(true);
    assert_eq!(paused_state, FocusState::Paused);
    assert!(!paused_scheduler);
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
fn lifecycle_state_allows_only_one_shutdown_request() {
    let lifecycle = AppLifecycleState::new();

    assert!(!lifecycle.is_shutting_down());
    assert!(lifecycle.request_shutdown());
    assert!(!lifecycle.request_shutdown());
    assert!(lifecycle.is_shutting_down());
    assert!(lifecycle.start_cleanup());
    assert!(!lifecycle.start_cleanup());
}
