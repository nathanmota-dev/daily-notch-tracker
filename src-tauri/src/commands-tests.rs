use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc, Mutex,
};
use std::time::{Duration as StdDuration, Instant};

use super::*;
use crate::domain::{
    CreateTaskInput, FocusSettingsPatch, MoveTasksInput, ShortcutStatus, StartFocusInput,
    TaskBucket, TasksWindowIntent, UpdateTaskInput,
};
use crate::services::{
    AutostartBackendError, AutostartService, FocusScheduler, MockAutostartBackend,
    MockNotificationBackend, NotificationBackendError, OverlayPresentationMode, TasksWindowOrigin,
    WindowNavigationState,
};
use crate::state::AppState;
use chrono::{Duration, Utc};
use tauri::{Listener, WebviewUrl, WebviewWindowBuilder};

fn test_app() -> tauri::App<tauri::test::MockRuntime> {
    let notification_backend = Arc::new(MockNotificationBackend::default());
    tauri::test::mock_builder()
        .manage(Mutex::new(AppState::default()))
        .manage(FocusScheduler::new())
        .manage(WindowNavigationState::new())
        .manage(Arc::clone(&notification_backend))
        .manage(crate::services::NotificationService::new(
            notification_backend,
        ))
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build")
}

fn test_app_with_autostart_backend(
    backend: Arc<MockAutostartBackend>,
) -> tauri::App<tauri::test::MockRuntime> {
    let notification_backend = Arc::new(MockNotificationBackend::default());
    tauri::test::mock_builder()
        .manage(Mutex::new(AppState::default()))
        .manage(FocusScheduler::new())
        .manage(Arc::clone(&notification_backend))
        .manage(crate::services::NotificationService::new(
            notification_backend,
        ))
        .manage(AutostartService::new(backend))
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build")
}

fn wait_for_focus_events(focus_events: &AtomicUsize, store_events: &AtomicUsize) {
    let deadline = Instant::now() + StdDuration::from_secs(1);
    while (focus_events.load(Ordering::Acquire) < 1 || store_events.load(Ordering::Acquire) < 1)
        && Instant::now() < deadline
    {
        std::thread::sleep(StdDuration::from_millis(5));
    }
}

fn create_window(
    app: &tauri::App<tauri::test::MockRuntime>,
    label: &str,
) -> tauri::WebviewWindow<tauri::test::MockRuntime> {
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .build()
        .expect("test window should build")
}

#[test]
fn greet_returns_a_rust_message() {
    assert_eq!(
        greet("DailyNotch"),
        "Hello, DailyNotch! DailyNotch Linux is running with Rust."
    );
}

#[test]
fn task_window_intent_accepts_list_and_add_modes() {
    assert!(validate_tasks_window_intent(Some(&TasksWindowIntent::List)).is_ok());
    assert!(validate_tasks_window_intent(Some(&TasksWindowIntent::Add)).is_ok());
}

#[test]
fn task_window_intent_rejects_an_invalid_task_id() {
    let error = validate_tasks_window_intent(Some(&TasksWindowIntent::Task {
        task_id: "not-a-uuid".to_owned(),
    }))
    .expect_err("invalid task intent should fail");

    assert_eq!(error.code, crate::domain::AppErrorCode::Validation);
}

#[test]
fn task_window_intents_are_encoded_for_new_window_urls() {
    assert_eq!(
        tasks_window_url(&TasksWindowIntent::List),
        "index.html?surface=tasks&intent=list"
    );
    assert_eq!(
        tasks_window_url(&TasksWindowIntent::Add),
        "index.html?surface=tasks&intent=add"
    );
    assert_eq!(
        tasks_window_url(&TasksWindowIntent::Task {
            task_id: "11111111-1111-4111-8111-111111111111".to_owned(),
        }),
        "index.html?surface=tasks&intent=task&taskId=11111111-1111-4111-8111-111111111111"
    );
}

#[test]
fn release_url_validation_requires_an_https_host() {
    assert!(is_allowed_release_url("https://github.com/example/release"));
    assert!(!is_allowed_release_url("http://github.com/example/release"));
    assert!(!is_allowed_release_url("https://release"));
    assert!(!is_allowed_release_url(
        " https://github.com/example/release"
    ));
}

#[test]
fn state_commands_share_the_managed_state_and_emit_snapshots() {
    let app = test_app();
    let handle = app.handle().clone();
    let snapshot =
        tauri::async_runtime::block_on(get_snapshot(handle.clone())).expect("snapshot should load");
    assert_eq!(snapshot.revision, 0);

    let added = tauri::async_runtime::block_on(add_task(
        handle.clone(),
        CreateTaskInput {
            title: "Command task".to_owned(),
            notes: String::new(),
            scheduled_date: None,
            estimate_minutes: 30,
        },
    ))
    .expect("task should be added");
    let task_id = added.tasks[0].id;

    tauri::async_runtime::block_on(update_task(
        handle.clone(),
        UpdateTaskInput {
            id: task_id.to_string(),
            title: "Updated command task".to_owned(),
            notes: "Notes".to_owned(),
            scheduled_date: None,
            estimate_minutes: 35,
            is_done: false,
        },
    ))
    .expect("task should be updated");
    tauri::async_runtime::block_on(toggle_task(handle.clone(), task_id.to_string()))
        .expect("task should toggle");
    tauri::async_runtime::block_on(update_task(
        handle.clone(),
        UpdateTaskInput {
            id: task_id.to_string(),
            title: "Updated command task".to_owned(),
            notes: "Notes".to_owned(),
            scheduled_date: None,
            estimate_minutes: 35,
            is_done: false,
        },
    ))
    .expect("task should be reopened");
    tauri::async_runtime::block_on(move_tasks(
        handle.clone(),
        MoveTasksInput {
            task_ids: vec![task_id.to_string()],
            source: TaskBucket::unscheduled(),
            destination: TaskBucket::for_date("2026-08-31"),
        },
    ))
    .expect("task should move");

    tauri::async_runtime::block_on(start_focus(
        handle.clone(),
        StartFocusInput::without_custom_duration(Some(task_id.to_string())),
    ))
    .expect("task focus should start");
    tauri::async_runtime::block_on(pause_focus(handle.clone())).expect("focus should pause");
    tauri::async_runtime::block_on(resume_focus(handle.clone())).expect("focus should resume");
    tauri::async_runtime::block_on(stop_focus(handle.clone())).expect("focus should stop");
    tauri::async_runtime::block_on(toggle_focus(handle.clone()))
        .expect("standalone focus should start");
    tauri::async_runtime::block_on(toggle_focus(handle.clone()))
        .expect("standalone focus should stop");
    tauri::async_runtime::block_on(update_settings(
        handle.clone(),
        FocusSettingsPatch {
            focus_minutes: Some(45),
            ..FocusSettingsPatch::default()
        },
    ))
    .expect("settings should update");

    let diagnostics = tauri::async_runtime::block_on(get_app_diagnostics(handle.clone()))
        .expect("diagnostics should load");
    assert_eq!(
        diagnostics.autostart.status,
        crate::domain::IntegrationStatus::Unavailable
    );
    assert_eq!(
        tauri::async_runtime::block_on(set_autostart(handle.clone(), true))
            .expect_err("autostart is not available")
            .code,
        crate::domain::AppErrorCode::IntegrationUnavailable
    );
    assert_eq!(
        tauri::async_runtime::block_on(open_external_release(
            "https://github.com/example/release".to_owned(),
        ))
        .expect_err("release integration is not available")
        .code,
        crate::domain::AppErrorCode::IntegrationUnavailable
    );
    tauri::async_runtime::block_on(delete_task(handle, task_id.to_string()))
        .expect("task should be deleted");
}

#[test]
fn autostart_commands_confirm_effective_state_without_persisting_or_emitting() {
    let backend = Arc::new(MockAutostartBackend::default());
    let app = test_app_with_autostart_backend(Arc::clone(&backend));
    let handle = app.handle().clone();
    let store_events = Arc::new(AtomicUsize::new(0));
    let store_events_for_listener = Arc::clone(&store_events);
    handle.listen_any("store-changed", move |_| {
        store_events_for_listener.fetch_add(1, Ordering::Release);
    });

    let before =
        tauri::async_runtime::block_on(get_snapshot(handle.clone())).expect("snapshot should load");
    let enabled_snapshot = tauri::async_runtime::block_on(set_autostart(handle.clone(), true))
        .expect("autostart should enable");
    let enabled_diagnostics = tauri::async_runtime::block_on(get_app_diagnostics(handle.clone()))
        .expect("diagnostics should load");

    assert_eq!(enabled_snapshot, before);
    assert!(enabled_diagnostics.autostart.enabled);
    assert_eq!(
        enabled_diagnostics.autostart.status,
        crate::domain::IntegrationStatus::Available
    );
    assert!(!enabled_snapshot.settings.launch_at_login);
    assert_eq!(backend.enable_calls(), 1);
    assert_eq!(backend.is_enabled_calls(), 2);

    let disabled_snapshot = tauri::async_runtime::block_on(set_autostart(handle.clone(), false))
        .expect("autostart should disable");
    let disabled_diagnostics = tauri::async_runtime::block_on(get_app_diagnostics(handle))
        .expect("diagnostics should load");

    assert_eq!(disabled_snapshot, before);
    assert!(!disabled_diagnostics.autostart.enabled);
    assert_eq!(backend.disable_calls(), 1);
    assert_eq!(store_events.load(Ordering::Acquire), 0);
}

#[test]
fn autostart_commands_map_permission_failures_to_sanitized_errors() {
    let backend = Arc::new(MockAutostartBackend::default());
    backend.set_enable_error(Some(AutostartBackendError::PermissionDenied));
    let app = test_app_with_autostart_backend(backend);
    let handle = app.handle().clone();

    let error = tauri::async_runtime::block_on(set_autostart(handle, true))
        .expect_err("permission failure should be returned");

    assert_eq!(error.code, crate::domain::AppErrorCode::PermissionDenied);
    assert_eq!(
        error.message,
        "Autostart permission was denied by the desktop session."
    );
}

#[test]
fn autostart_commands_map_generic_operation_failures_to_integration_errors() {
    let backend = Arc::new(MockAutostartBackend::with_enabled(true));
    backend.set_disable_error(Some(AutostartBackendError::Failed));
    let app = test_app_with_autostart_backend(backend);

    let error = tauri::async_runtime::block_on(set_autostart(app.handle().clone(), false))
        .expect_err("generic operation failure should be returned");

    assert_eq!(
        error.code,
        crate::domain::AppErrorCode::IntegrationUnavailable
    );
    assert_eq!(
        error.message,
        "Autostart could not be updated in this desktop session."
    );
}

#[test]
fn autostart_diagnostics_map_generic_read_failures_to_error_status() {
    let backend = Arc::new(MockAutostartBackend::default());
    backend.set_is_enabled_error(Some(AutostartBackendError::Failed));
    let app = test_app_with_autostart_backend(backend);

    let diagnostics = tauri::async_runtime::block_on(get_app_diagnostics(app.handle().clone()))
        .expect("diagnostics should remain available");

    assert_eq!(
        diagnostics.autostart.status,
        crate::domain::IntegrationStatus::Error
    );
    assert_eq!(
        diagnostics.autostart.message.as_deref(),
        Some("Autostart status could not be read from the desktop session.")
    );
}

#[test]
fn shortcut_status_publishes_complete_snapshots_without_tray_state() {
    let app = test_app();
    let handle = app.handle().clone();
    let received = Arc::new(Mutex::new(Vec::<AppSnapshot>::new()));
    let received_for_listener = Arc::clone(&received);
    handle.listen_any("shortcut-changed", move |event| {
        if let Ok(snapshot) = serde_json::from_str::<AppSnapshot>(event.payload()) {
            received_for_listener
                .lock()
                .expect("shortcut listener should not be poisoned")
                .push(snapshot);
        }
    });

    publish_shortcut_status(&handle, ShortcutStatus::Registered)
        .expect("shortcut status should publish");
    publish_shortcut_status(&handle, ShortcutStatus::Registered)
        .expect("same shortcut status should be a no-op");
    publish_shortcut_status(&handle, ShortcutStatus::Error)
        .expect("shortcut error status should publish");

    let snapshots = received
        .lock()
        .expect("shortcut snapshots should not be poisoned")
        .clone();
    assert_eq!(snapshots.len(), 2);
    assert_eq!(snapshots[0].revision, 1);
    assert_eq!(snapshots[0].shortcut_status, ShortcutStatus::Registered);
    assert_eq!(snapshots[1].revision, 2);
    assert_eq!(snapshots[1].shortcut_status, ShortcutStatus::Error);
    assert_eq!(snapshots[1].tasks, Vec::new());
}

#[test]
fn window_commands_reuse_labels_and_validate_external_inputs() {
    let app = test_app();
    let handle = app.handle().clone();
    let task_id = "11111111-1111-4111-8111-111111111111".to_owned();
    let received_intents = Arc::new(Mutex::new(Vec::<TasksWindowIntent>::new()));
    let received_intents_clone = Arc::clone(&received_intents);
    handle.listen_any(TASKS_WINDOW_INTENT_EVENT, move |event| {
        if let Ok(intent) = serde_json::from_str::<TasksWindowIntent>(event.payload()) {
            received_intents_clone
                .lock()
                .expect("intent listener should not be poisoned")
                .push(intent);
        }
    });

    tauri::async_runtime::block_on(toggle_focus(handle.clone()))
        .expect("standalone focus should start");
    let snapshot_before_opening =
        tauri::async_runtime::block_on(get_snapshot(handle.clone())).expect("snapshot should load");

    tauri::async_runtime::block_on(open_tasks_window(
        handle.clone(),
        Some(TasksWindowIntent::Task {
            task_id: task_id.clone(),
        }),
        Some(TasksWindowOrigin {
            presentation_mode: OverlayPresentationMode::Expanded,
        }),
    ))
    .expect("tasks window should open");
    tauri::async_runtime::block_on(open_tasks_window(
        handle.clone(),
        Some(TasksWindowIntent::List),
        None,
    ))
    .expect("existing tasks window should be reused");
    tauri::async_runtime::block_on(open_tasks_window(
        handle.clone(),
        Some(TasksWindowIntent::Add),
        None,
    ))
    .expect("existing tasks window should receive an add intent");
    tauri::async_runtime::block_on(open_tasks_window(
        handle.clone(),
        Some(TasksWindowIntent::Task {
            task_id: task_id.clone(),
        }),
        None,
    ))
    .expect("existing tasks window should receive a task intent");
    tauri::async_runtime::block_on(open_settings_window(handle.clone()))
        .expect("settings window should open");
    tauri::async_runtime::block_on(open_settings_window(handle.clone()))
        .expect("existing settings window should be reused");
    tauri::async_runtime::block_on(close_settings_window(handle.clone()))
        .expect("settings window should close without being destroyed");
    tauri::async_runtime::block_on(close_settings_window(handle.clone()))
        .expect("closing an already hidden settings window should be idempotent");
    tauri::async_runtime::block_on(open_settings_window(handle.clone()))
        .expect("hidden settings window should be reused");

    assert_eq!(handle.webview_windows().len(), 2);
    assert_eq!(
        received_intents
            .lock()
            .expect("intent listener should not be poisoned")
            .clone(),
        vec![
            TasksWindowIntent::List,
            TasksWindowIntent::Add,
            TasksWindowIntent::Task {
                task_id: task_id.clone(),
            },
        ]
    );
    let snapshot_after_opening =
        tauri::async_runtime::block_on(get_snapshot(handle.clone())).expect("snapshot should load");
    assert_eq!(snapshot_after_opening.focus, snapshot_before_opening.focus);
    assert_eq!(snapshot_after_opening.tasks, snapshot_before_opening.tasks);

    assert_eq!(
        tauri::async_runtime::block_on(open_tasks_window(
            handle.clone(),
            Some(TasksWindowIntent::Task {
                task_id: "invalid".to_owned(),
            }),
            None,
        ))
        .expect_err("invalid task intent should fail")
        .code,
        crate::domain::AppErrorCode::Validation
    );
    assert_eq!(
        tauri::async_runtime::block_on(open_external_release(
            "http://github.com/release".to_owned(),
        ))
        .expect_err("non-HTTPS release should fail")
        .code,
        crate::domain::AppErrorCode::InvalidUrl
    );
    tauri::async_runtime::block_on(stop_focus(handle)).expect("standalone focus should stop");
}

#[test]
fn returning_from_settings_hides_settings_and_focuses_tasks() {
    let app = test_app();
    let handle = app.handle().clone();
    let overlay = create_window(&app, "overlay");

    crate::services::show_and_focus_window(&overlay).expect("overlay should be shown and focused");
    tauri::async_runtime::block_on(open_tasks_window(
        handle.clone(),
        Some(TasksWindowIntent::List),
        Some(TasksWindowOrigin {
            presentation_mode: OverlayPresentationMode::Expanded,
        }),
    ))
    .expect("tasks should open from the overlay");
    tauri::async_runtime::block_on(open_settings_window(handle.clone()))
        .expect("settings should open");

    tauri::async_runtime::block_on(return_to_tasks_window(handle.clone()))
        .expect("settings should return to tasks");

    let navigation = handle
        .try_state::<WindowNavigationState>()
        .expect("navigation state should be managed")
        .snapshot()
        .expect("navigation state should be readable");
    assert_eq!(
        navigation.focused_window,
        Some(crate::services::ManagedWindowLabel::Tasks)
    );
    assert!(navigation
        .visible_windows
        .contains(&crate::services::ManagedWindowLabel::Overlay));
    assert!(navigation
        .visible_windows
        .contains(&crate::services::ManagedWindowLabel::Tasks));
    assert!(!navigation
        .visible_windows
        .contains(&crate::services::ManagedWindowLabel::Settings));
    assert_eq!(
        navigation.tasks_window_origin,
        Some(TasksWindowOrigin {
            presentation_mode: OverlayPresentationMode::Expanded,
        })
    );
}

#[test]
fn reusable_windows_work_without_overlay_and_preserve_focus_scheduler() {
    let app = test_app();
    let handle = app.handle().clone();

    tauri::async_runtime::block_on(toggle_focus(handle.clone()))
        .expect("standalone focus should start");
    assert!(handle
        .try_state::<FocusScheduler>()
        .expect("scheduler should be managed")
        .is_scheduled());

    tauri::async_runtime::block_on(open_tasks_window(
        handle.clone(),
        Some(TasksWindowIntent::List),
        None,
    ))
    .expect("Tasks should open without an overlay");
    tauri::async_runtime::block_on(open_settings_window(handle.clone()))
        .expect("Settings should open without an overlay");
    tauri::async_runtime::block_on(close_tasks_window(handle.clone()))
        .expect("Tasks should hide without an overlay");
    tauri::async_runtime::block_on(close_settings_window(handle.clone()))
        .expect("Settings should hide without an overlay");

    assert_eq!(handle.webview_windows().len(), 2);
    let snapshot = tauri::async_runtime::block_on(get_snapshot(handle.clone()))
        .expect("snapshot should remain available");
    assert_eq!(snapshot.focus.state, crate::domain::FocusState::Running);
    assert!(handle
        .try_state::<FocusScheduler>()
        .expect("scheduler should remain managed")
        .is_scheduled());

    tauri::async_runtime::block_on(stop_focus(handle)).expect("focus should stop");
}

#[test]
fn due_focus_is_completed_by_the_managed_scheduler() {
    let app = test_app();
    let handle = app.handle().clone();
    let notification_backend = handle
        .try_state::<Arc<MockNotificationBackend>>()
        .expect("notification backend should be managed");
    let focus_events = Arc::new(AtomicUsize::new(0));
    let store_events = Arc::new(AtomicUsize::new(0));
    let focus_event_counter = Arc::clone(&focus_events);
    let store_event_counter = Arc::clone(&store_events);
    handle.listen_any("focus-changed", move |_| {
        focus_event_counter.fetch_add(1, Ordering::Release);
    });
    handle.listen_any("store-changed", move |_| {
        store_event_counter.fetch_add(1, Ordering::Release);
    });
    let schedule = tauri::async_runtime::block_on(with_state(&handle, |state| {
        state.start_focus_at(None, Utc::now() - Duration::minutes(25))?;
        state
            .focus_schedule()
            .ok_or_else(|| crate::domain::AppError::internal("focus should be schedulable"))
    }))
    .expect("a running focus should expose a scheduler deadline");

    sync_focus_scheduler(&handle, Some(schedule));

    let deadline = Instant::now() + StdDuration::from_secs(1);
    let snapshot = loop {
        let snapshot = tauri::async_runtime::block_on(get_snapshot(handle.clone()))
            .expect("snapshot should load");
        if snapshot.focus.state == crate::domain::FocusState::Idle || Instant::now() >= deadline {
            break snapshot;
        }
        std::thread::sleep(StdDuration::from_millis(5));
    };

    assert_eq!(snapshot.focus.state, crate::domain::FocusState::Idle);
    assert_eq!(snapshot.sessions.len(), 1);
    assert!(snapshot.sessions[0].completed);
    wait_for_focus_events(&focus_events, &store_events);
    assert_eq!(focus_events.load(Ordering::Acquire), 1);
    assert_eq!(store_events.load(Ordering::Acquire), 1);
    assert_eq!(notification_backend.sent_requests().len(), 1);
}

#[test]
fn completed_focus_command_notifies_after_the_state_is_committed() {
    let app = test_app();
    let handle = app.handle().clone();
    let added = tauri::async_runtime::block_on(add_task(
        handle.clone(),
        CreateTaskInput {
            title: "Command notification task".to_owned(),
            notes: "private notes".to_owned(),
            scheduled_date: None,
            estimate_minutes: 25,
        },
    ))
    .expect("task should be added");
    let task_id = added.tasks[0].id;
    let started_at = Utc::now() - Duration::seconds(2);

    tauri::async_runtime::block_on(with_state(&handle, move |state| {
        state
            .start_focus_with_duration_at(Some(task_id), Some(1), started_at)
            .map(|_| ())
    }))
    .expect("focus should start");

    let completed = tauri::async_runtime::block_on(stop_focus(handle.clone()))
        .expect("due focus should stop as completed");
    assert_eq!(completed.sessions.len(), 1);
    assert!(completed.sessions[0].completed);

    let backend = handle
        .try_state::<Arc<MockNotificationBackend>>()
        .expect("notification backend should be managed");
    let requests = backend.sent_requests();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].title, "Focus block complete");
    assert_eq!(
        requests[0].body.as_deref(),
        Some("Command notification task")
    );
}

#[test]
fn completing_the_active_task_notifies_after_the_session_is_persisted() {
    let app = test_app();
    let handle = app.handle().clone();
    let added = tauri::async_runtime::block_on(add_task(
        handle.clone(),
        CreateTaskInput {
            title: "Active task completion".to_owned(),
            notes: String::new(),
            scheduled_date: None,
            estimate_minutes: 25,
        },
    ))
    .expect("task should be added");
    let task_id = added.tasks[0].id;
    let started_at = Utc::now() - Duration::seconds(2);

    tauri::async_runtime::block_on(with_state(&handle, move |state| {
        state
            .start_focus_with_duration_at(Some(task_id), Some(1), started_at)
            .map(|_| ())
    }))
    .expect("focus should start");

    let completed =
        tauri::async_runtime::block_on(toggle_task(handle.clone(), task_id.to_string()))
            .expect("completing the active task should succeed");
    assert!(completed.tasks[0].is_done);
    assert!(completed.sessions[0].completed);

    let backend = handle
        .try_state::<Arc<MockNotificationBackend>>()
        .expect("notification backend should be managed");
    let requests = backend.sent_requests();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].title, "Focus block complete");
    assert_eq!(requests[0].body.as_deref(), Some("Active task completion"));
}

#[test]
fn notification_failure_does_not_fail_or_undo_a_completed_focus_command() {
    let app = test_app();
    let handle = app.handle().clone();
    let backend = handle
        .try_state::<Arc<MockNotificationBackend>>()
        .expect("notification backend should be managed");
    backend.set_send_error(Some(NotificationBackendError::Failed));

    let started_at = Utc::now() - Duration::seconds(2);
    tauri::async_runtime::block_on(with_state(&handle, move |state| {
        state
            .start_focus_with_duration_at(None, Some(1), started_at)
            .map(|_| ())
    }))
    .expect("focus should start");

    let completed = tauri::async_runtime::block_on(stop_focus(handle.clone()))
        .expect("notification failure should not fail focus completion");

    assert_eq!(completed.sessions.len(), 1);
    assert!(completed.sessions[0].completed);
    assert!(backend.sent_requests().is_empty());
}

#[test]
fn disabled_notifications_do_not_call_the_notification_backend_from_commands() {
    let app = test_app();
    let handle = app.handle().clone();
    let backend = handle
        .try_state::<Arc<MockNotificationBackend>>()
        .expect("notification backend should be managed");

    tauri::async_runtime::block_on(update_settings(
        handle.clone(),
        FocusSettingsPatch {
            notifications_enabled: Some(false),
            ..FocusSettingsPatch::default()
        },
    ))
    .expect("notifications should be disabled");

    let started_at = Utc::now() - Duration::seconds(2);
    tauri::async_runtime::block_on(with_state(&handle, move |state| {
        state
            .start_focus_with_duration_at(None, Some(1), started_at)
            .map(|_| ())
    }))
    .expect("focus should start");
    tauri::async_runtime::block_on(stop_focus(handle.clone())).expect("focus should complete");

    assert_eq!(backend.permission_state_calls(), 0);
    assert!(backend.sent_requests().is_empty());
}
