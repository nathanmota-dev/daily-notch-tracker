use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Duration, NaiveDate, Utc};
use uuid::Uuid;

use super::*;
use crate::domain::session::FocusSession;
use crate::domain::{
    AppErrorCode, CreateTaskInput, FocusSettingsPatch, MoveTasksInput, TaskBucket, UpdateTaskInput,
    WindowMonitorSnapshot, WindowPlacementSnapshot,
};
use crate::storage::Repository;

struct TestDirectory {
    path: PathBuf,
}

impl TestDirectory {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("dailynotch-state-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).expect("test directory should be created");
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn loaded_state() -> (TestDirectory, AppState) {
    let test_directory = TestDirectory::new();
    let state = AppState::load(Repository::new(test_directory.path()))
        .expect("empty repository should load");
    (test_directory, state)
}

fn sample_window_placement(x: i32, y: i32) -> WindowPlacementSnapshot {
    WindowPlacementSnapshot {
        revision: 0,
        window_label: "overlay".to_owned(),
        x,
        y,
        width: 800,
        height: 550,
        scale_factor: 1.0,
        monitor: WindowMonitorSnapshot {
            name: Some("primary".to_owned()),
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            scale_factor: 1.0,
        },
    }
}

fn default_diagnostics(state: &AppState) -> crate::domain::AppDiagnostics {
    state.diagnostics(
        "0.1.0".to_owned(),
        crate::domain::AutostartDiagnostic::default(),
        crate::domain::TrayDiagnostic::default(),
    )
}

fn date(year: i32, month: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(year, month, day).expect("test date should be valid")
}

fn timestamp(day: u32, hour: u32) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(&format!("2026-08-{day:02}T{hour:02}:00:00Z"))
        .expect("test timestamp should be valid")
        .with_timezone(&Utc)
}

fn create_input(
    title: &str,
    scheduled_date: Option<&str>,
    estimate_minutes: i64,
) -> CreateTaskInput {
    CreateTaskInput {
        title: title.to_owned(),
        notes: String::new(),
        scheduled_date: scheduled_date.map(str::to_owned),
        estimate_minutes,
    }
}

fn update_input(
    id: Uuid,
    title: &str,
    scheduled_date: Option<&str>,
    estimate_minutes: i64,
    is_done: bool,
) -> UpdateTaskInput {
    UpdateTaskInput {
        id: id.to_string(),
        title: title.to_owned(),
        notes: String::new(),
        scheduled_date: scheduled_date.map(str::to_owned),
        estimate_minutes,
        is_done,
    }
}

fn snapshot_tasks_for_date(
    snapshot: &crate::domain::AppSnapshot,
    scheduled_date: NaiveDate,
) -> Vec<&crate::domain::Task> {
    snapshot
        .tasks
        .iter()
        .filter(|task| task.scheduled_date == Some(scheduled_date))
        .collect()
}

fn assert_invalid_estimate_update(
    state: &mut AppState,
    input: UpdateTaskInput,
    before: &crate::domain::AppSnapshot,
) {
    let error = state
        .update_task(input)
        .expect_err("an out-of-range estimate should fail");
    assert_eq!(error.code, AppErrorCode::Validation);
    assert_eq!(error.field.as_deref(), Some("estimateMinutes"));
    assert_eq!(&state.snapshot(), before);
}

fn add_task(
    state: &mut AppState,
    id: &str,
    title: &str,
    scheduled_date: Option<&str>,
    created_day: u32,
    created_hour: u32,
) -> Uuid {
    let id = Uuid::parse_str(id).expect("test UUID should be valid");
    state
        .add_task_at(
            create_input(title, scheduled_date, 25),
            id,
            timestamp(created_day, created_hour),
        )
        .expect("test task should be added");
    id
}

fn add_active_task(state: &mut AppState) -> Uuid {
    let task_id = Uuid::new_v4();
    state
        .add_task_at(
            create_input("Active task", None, 25),
            task_id,
            timestamp(31, 9),
        )
        .expect("active task should be added");
    state
        .start_focus_at(Some(task_id), timestamp(31, 10))
        .expect("active task focus should start");
    task_id
}

#[test]
fn empty_state_matches_the_typescript_snapshot_contract() {
    let snapshot = AppState::default().snapshot();
    let json = serde_json::to_value(snapshot).expect("snapshot should serialize");

    assert_eq!(json["revision"], 0);
    assert_eq!(json["tasks"], serde_json::json!([]));
    assert_eq!(json["sessions"], serde_json::json!([]));
    assert_eq!(json["settings"]["focusMinutes"], 25);
    assert_eq!(json["settings"]["notificationsEnabled"], true);
    assert!(json["settings"].get("playSound").is_none());
    assert_eq!(json["settings"]["showTimeline"], true);
    assert_eq!(json["settings"]["rainbowTimeline"], false);
    assert_eq!(json["settings"]["minimalMode"], false);
    assert_eq!(json["settings"]["launchAtLogin"], false);
    assert_eq!(json["focus"]["state"], "idle");
    assert_eq!(json["focus"]["activeTaskId"], serde_json::Value::Null);
    assert_eq!(json["shortcutStatus"], "unavailable");
}

#[test]
fn diagnostics_expose_the_data_path_without_persistence_details() {
    let (_test_directory, state) = loaded_state();
    let diagnostics = default_diagnostics(&state);

    assert_eq!(diagnostics.app_version, "0.1.0");
    assert!(diagnostics.data_file_path.ends_with("dailynotch.json"));
    assert_eq!(diagnostics.shortcut.status, ShortcutStatus::Unavailable);
    assert_eq!(
        diagnostics.tray.status,
        crate::domain::IntegrationStatus::Unavailable
    );
    assert_eq!(
        diagnostics.autostart.status,
        crate::domain::IntegrationStatus::Unavailable
    );
    assert!(!diagnostics.autostart.enabled);
}

#[test]
fn diagnostics_preserve_the_effective_autostart_state_received_from_the_service() {
    let (_test_directory, state) = loaded_state();
    let autostart = crate::domain::AutostartDiagnostic {
        enabled: true,
        status: crate::domain::IntegrationStatus::Available,
        message: None,
    };

    let diagnostics = state.diagnostics(
        "0.1.0".to_owned(),
        autostart.clone(),
        crate::domain::TrayDiagnostic::default(),
    );

    assert_eq!(diagnostics.autostart, autostart);
}

#[test]
fn shortcut_status_revision_changes_only_when_the_status_changes() {
    let mut state = AppState::default();

    let registered = state
        .set_shortcut_status(ShortcutStatus::Registered)
        .expect("shortcut status should update")
        .expect("a changed status should produce a snapshot");
    assert_eq!(registered.revision, 1);
    assert_eq!(registered.shortcut_status, ShortcutStatus::Registered);

    assert!(state
        .set_shortcut_status(ShortcutStatus::Registered)
        .expect("same shortcut status should be accepted")
        .is_none());
    assert_eq!(state.revision(), 1);

    let error = state
        .set_shortcut_status(ShortcutStatus::Error)
        .expect("shortcut status should update")
        .expect("a changed status should produce a snapshot");
    assert_eq!(error.revision, 2);
    assert_eq!(error.shortcut_status, ShortcutStatus::Error);
}

#[test]
fn shortcut_status_does_not_overflow_the_runtime_revision() {
    let mut state = AppState {
        revision: u64::MAX,
        ..AppState::default()
    };

    let error = state
        .set_shortcut_status(ShortcutStatus::Registered)
        .expect_err("an exhausted revision should reject status changes");

    assert_eq!(error.code, AppErrorCode::Internal);
    assert_eq!(
        state.snapshot().shortcut_status,
        ShortcutStatus::Unavailable
    );
}

#[test]
fn shortcut_diagnostics_use_sanitized_messages_for_runtime_failures() {
    let mut state = AppState::default();
    state
        .set_shortcut_status(ShortcutStatus::Error)
        .expect("shortcut status should update");

    let diagnostics = default_diagnostics(&state);

    assert_eq!(
        diagnostics.shortcut.message.as_deref(),
        Some("Global shortcut could not be registered. It may already be in use.")
    );
}

#[test]
fn shortcut_status_is_not_written_to_the_persisted_payload() {
    let (test_directory, mut state) = loaded_state();
    state
        .set_shortcut_status(ShortcutStatus::Registered)
        .expect("shortcut status should update");
    drop(state);

    let reloaded = AppState::load(Repository::new(test_directory.path()))
        .expect("persisted state should reload");

    assert_eq!(
        reloaded.snapshot().shortcut_status,
        ShortcutStatus::Unavailable
    );
    assert_eq!(reloaded.revision(), 0);
}

#[test]
fn task_crud_increments_revision_only_after_success() {
    let mut state = AppState::default();
    let task_id = add_task(
        &mut state,
        "11111111-1111-4111-8111-111111111111",
        "  First task  ",
        Some("2026-08-31"),
        31,
        8,
    );

    assert_eq!(state.snapshot().revision, 1);
    assert_eq!(state.snapshot().tasks[0].title, "First task");

    state
        .update_task(update_input(
            task_id,
            "Updated task",
            Some("2026-09-01"),
            180,
            true,
        ))
        .expect("existing task should update");
    assert_eq!(state.snapshot().revision, 2);
    assert_eq!(
        state.snapshot().tasks[0].scheduled_date,
        Some(date(2026, 9, 1))
    );
    assert_eq!(state.snapshot().tasks[0].estimate_minutes, 180);

    let before_invalid_update = state.snapshot();
    assert_invalid_estimate_update(
        &mut state,
        update_input(task_id, "Updated task", Some("2026-09-01"), 181, true),
        &before_invalid_update,
    );

    state
        .toggle_task(&task_id.to_string())
        .expect("existing task should toggle");
    assert!(!state.snapshot().tasks[0].is_done);

    let before_missing_delete = state.snapshot();
    let error = state
        .delete_task("not-a-uuid")
        .expect_err("invalid task id should fail");
    assert_eq!(error.code, AppErrorCode::Validation);
    assert_eq!(state.snapshot(), before_missing_delete);

    state
        .delete_task(&task_id.to_string())
        .expect("existing task should delete");
    assert!(state.snapshot().tasks.is_empty());

    let error = state
        .delete_task(&task_id.to_string())
        .expect_err("deleted task should not be found");
    assert_eq!(error.code, AppErrorCode::NotFound);
    assert_eq!(state.revision(), 4);
}

#[test]
fn task_validation_rejects_invalid_text_and_dates_without_mutating_state() {
    let mut state = AppState::default();
    let before = state.snapshot();

    let error = state
        .add_task(create_input("   ", None, 25))
        .expect_err("blank title should fail");
    assert_eq!(error.field.as_deref(), Some("title"));
    assert_eq!(state.snapshot(), before);

    let error = state
        .add_task(create_input("Task", Some("2026-02-30"), 25))
        .expect_err("invalid date should fail");
    assert_eq!(error.field.as_deref(), Some("scheduledDate"));
    assert_eq!(state.snapshot(), before);

    let error = state
        .add_task(create_input(&"x".repeat(151), None, 25))
        .expect_err("long title should fail");
    assert_eq!(error.code, AppErrorCode::Validation);
    assert_eq!(state.snapshot(), before);
}

#[test]
fn task_durations_are_rejected_while_settings_keep_defensive_clamp() {
    let mut state = AppState::default();
    let error = state
        .add_task(create_input("Invalid task", None, 0))
        .expect_err("an out-of-range estimate should fail on create");
    assert_eq!(error.code, AppErrorCode::Validation);
    assert_eq!(error.field.as_deref(), Some("estimateMinutes"));

    let task_id = add_task(
        &mut state,
        "22222222-2222-4222-8222-222222222222",
        "Clamped task",
        None,
        31,
        9,
    );
    let before_invalid_update = state.snapshot();
    assert_invalid_estimate_update(
        &mut state,
        update_input(task_id, "Clamped task", None, -20, false),
        &before_invalid_update,
    );

    let snapshot = state
        .update_settings(FocusSettingsPatch {
            focus_minutes: Some(0),
            ..FocusSettingsPatch::default()
        })
        .expect("settings patch should succeed");
    assert_eq!(snapshot.settings.focus_minutes, 1);
}

#[test]
fn updated_default_duration_is_used_for_a_task_free_focus() {
    let mut state = AppState::default();
    state
        .update_settings(FocusSettingsPatch {
            focus_minutes: Some(45),
            ..FocusSettingsPatch::default()
        })
        .expect("settings patch should succeed");

    let snapshot = state
        .start_focus_at(None, timestamp(31, 10))
        .expect("a task-free focus should start");

    assert_eq!(snapshot.focus.active_task_id, None);
    assert_eq!(snapshot.focus.total_ms, 45 * 60_000);
}

#[test]
fn task_queries_keep_day_and_unscheduled_buckets_separate() {
    let mut state = AppState::default();
    let day_id = add_task(
        &mut state,
        "33333333-3333-4333-8333-333333333333",
        "Day task",
        Some("2026-08-31"),
        31,
        10,
    );
    let unscheduled_id = add_task(
        &mut state,
        "44444444-4444-4444-8444-444444444444",
        "Unscheduled task",
        None,
        31,
        11,
    );

    assert_eq!(
        state
            .tasks_for_date_string("2026-08-31")
            .expect("valid day should query")
            .iter()
            .map(|task| task.id)
            .collect::<Vec<_>>(),
        vec![day_id]
    );
    assert_eq!(
        state
            .tasks_without_date()
            .iter()
            .map(|task| task.id)
            .collect::<Vec<_>>(),
        vec![unscheduled_id]
    );
}

#[test]
fn sorting_puts_incomplete_tasks_first_then_uses_sort_order_and_creation_time() {
    let mut state = AppState::default();
    let first_id = add_task(
        &mut state,
        "55555555-5555-4555-8555-555555555555",
        "First",
        Some("2026-08-31"),
        31,
        12,
    );
    let second_id = add_task(
        &mut state,
        "66666666-6666-4666-8666-666666666666",
        "Second",
        Some("2026-08-31"),
        31,
        13,
    );
    let third_id = add_task(
        &mut state,
        "77777777-7777-4777-8777-777777777777",
        "Third",
        Some("2026-08-31"),
        31,
        14,
    );
    state
        .update_task(update_input(
            second_id,
            "Second",
            Some("2026-08-31"),
            25,
            true,
        ))
        .expect("task should be completable");

    let ids = state
        .tasks_for_date(date(2026, 8, 31))
        .iter()
        .map(|task| task.id)
        .collect::<Vec<_>>();
    assert_eq!(ids, vec![first_id, third_id, second_id]);
}

#[test]
fn reorder_same_bucket_requires_a_complete_permutation_and_is_atomic() {
    let mut state = AppState::default();
    let first_id = add_task(
        &mut state,
        "88888888-8888-4888-8888-888888888888",
        "First",
        Some("2026-08-31"),
        31,
        15,
    );
    let second_id = add_task(
        &mut state,
        "99999999-9999-4999-8999-999999999999",
        "Second",
        Some("2026-08-31"),
        31,
        16,
    );
    let before_invalid = state.snapshot();

    let error = state
        .move_tasks(MoveTasksInput {
            task_ids: vec![first_id.to_string()],
            source: TaskBucket::for_date("2026-08-31"),
            destination: TaskBucket::for_date("2026-08-31"),
        })
        .expect_err("partial same-bucket reorder should fail");
    assert_eq!(error.code, AppErrorCode::Conflict);
    assert_eq!(state.snapshot(), before_invalid);

    let snapshot = state
        .move_tasks(MoveTasksInput {
            task_ids: vec![second_id.to_string(), first_id.to_string()],
            source: TaskBucket::for_date("2026-08-31"),
            destination: TaskBucket::for_date("2026-08-31"),
        })
        .expect("complete permutation should reorder");
    let tasks = snapshot_tasks_for_date(&snapshot, date(2026, 8, 31));
    assert_eq!(tasks[0].id, second_id);
    assert_eq!(tasks[0].sort_order, 0);
    assert_eq!(tasks[1].id, first_id);
    assert_eq!(tasks[1].sort_order, 1);
}

#[test]
fn moving_between_buckets_updates_only_source_and_destination_orders() {
    let mut state = AppState::default();
    let source_first = add_task(
        &mut state,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "Source first",
        Some("2026-08-31"),
        31,
        17,
    );
    let source_second = add_task(
        &mut state,
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "Source second",
        Some("2026-08-31"),
        31,
        18,
    );
    let destination = add_task(
        &mut state,
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "Destination",
        Some("2026-09-01"),
        31,
        19,
    );

    let snapshot = state
        .move_tasks(MoveTasksInput {
            task_ids: vec![source_second.to_string()],
            source: TaskBucket::for_date("2026-08-31"),
            destination: TaskBucket::for_date("2026-09-01"),
        })
        .expect("cross-bucket move should succeed");

    let source_tasks = snapshot_tasks_for_date(&snapshot, date(2026, 8, 31));
    let destination_tasks = snapshot_tasks_for_date(&snapshot, date(2026, 9, 1));

    assert_eq!(source_tasks.len(), 1);
    assert_eq!(source_tasks[0].id, source_first);
    assert_eq!(source_tasks[0].sort_order, 0);
    assert_eq!(destination_tasks[0].id, destination);
    assert_eq!(destination_tasks[0].sort_order, 0);
    assert_eq!(destination_tasks[1].id, source_second);
    assert_eq!(destination_tasks[1].sort_order, 1);
}

#[test]
fn recording_completed_and_aborted_sessions_adds_focused_seconds_directly() {
    let mut state = AppState::default();
    let task_id = add_task(
        &mut state,
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "Focus task",
        None,
        31,
        20,
    );
    let started_at = timestamp(31, 21);

    state
        .record_session(FocusSession {
            id: Uuid::new_v4(),
            task_id: Some(task_id),
            started_at,
            ended_at: started_at + Duration::hours(3),
            focused_seconds: 25,
            completed: true,
        })
        .expect("completed session should record");
    state
        .record_session(FocusSession {
            id: Uuid::new_v4(),
            task_id: Some(task_id),
            started_at: started_at + Duration::hours(4),
            ended_at: started_at + Duration::hours(7),
            focused_seconds: 7,
            completed: false,
        })
        .expect("aborted session should record");

    assert_eq!(state.focused_seconds_for_task(task_id), 32);
    assert_eq!(state.snapshot().tasks[0].focused_seconds, 32);
}

#[test]
fn structured_errors_serialize_with_code_message_and_optional_field() {
    let error = AppError::validation("The title is required.", "title");
    let json = serde_json::to_value(error).expect("error should serialize");

    assert_eq!(json["code"], "validation");
    assert_eq!(json["message"], "The title is required.");
    assert_eq!(json["field"], "title");
}

#[test]
fn persisted_state_recovers_tasks_sessions_and_settings_after_reloading() {
    let (test_directory, mut state) = loaded_state();
    let task_id = add_task(
        &mut state,
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        "Persisted task",
        Some("2026-08-31"),
        31,
        22,
    );
    state
        .update_settings(FocusSettingsPatch {
            focus_minutes: Some(50),
            notifications_enabled: Some(false),
            show_timeline: Some(false),
            rainbow_timeline: Some(true),
            minimal_mode: Some(true),
        })
        .expect("settings should persist");
    let started_at = timestamp(31, 23);
    state
        .record_session(FocusSession {
            id: Uuid::parse_str("ffffffff-ffff-4fff-8fff-ffffffffffff")
                .expect("test UUID should be valid"),
            task_id: Some(task_id),
            started_at,
            ended_at: started_at + Duration::minutes(25),
            focused_seconds: 1_500,
            completed: true,
        })
        .expect("session should persist");

    let reloaded = AppState::load(Repository::new(test_directory.path()))
        .expect("persisted repository should reload");
    let snapshot = reloaded.snapshot();

    assert_eq!(snapshot.revision, 0);
    assert_eq!(snapshot.tasks.len(), 1);
    assert_eq!(snapshot.tasks[0].id, task_id);
    assert_eq!(snapshot.tasks[0].focused_seconds, 1_500);
    assert_eq!(snapshot.sessions.len(), 1);
    assert_eq!(snapshot.sessions[0].focused_seconds, 1_500);
    assert_eq!(snapshot.settings.focus_minutes, 50);
    assert!(!snapshot.settings.notifications_enabled);
    assert!(!snapshot.settings.show_timeline);
    assert!(snapshot.settings.rainbow_timeline);
    assert!(snapshot.settings.minimal_mode);
    assert_eq!(snapshot.focus, FocusSnapshot::default());
}

#[test]
fn window_placement_persists_with_its_own_revision_without_changing_the_snapshot() {
    let (test_directory, mut state) = loaded_state();
    let before = state.snapshot();

    let saved = state
        .save_window_placement(sample_window_placement(320, 180))
        .expect("window placement should persist");

    assert_eq!(saved.revision, 1);
    assert_eq!(state.snapshot(), before);
    assert_eq!(state.window_placement(), Some(saved.clone()));

    let reloaded = AppState::load(Repository::new(test_directory.path()))
        .expect("window placement should reload");
    assert_eq!(reloaded.window_placement(), Some(saved));
    assert_eq!(reloaded.revision(), 0);
}

#[test]
fn window_placement_persistence_failure_restores_the_last_valid_value() {
    let (test_directory, mut state) = loaded_state();
    let first = state
        .save_window_placement(sample_window_placement(100, 120))
        .expect("initial window placement should persist");
    state.fail_next_persistence_write();

    let error = state
        .save_window_placement(sample_window_placement(700, 420))
        .expect_err("simulated placement write should fail");

    assert_eq!(error.code, AppErrorCode::Persistence);
    assert_eq!(state.window_placement(), Some(first.clone()));
    assert_eq!(state.window_placement.revision, first.revision);

    let reloaded = AppState::load(Repository::new(test_directory.path()))
        .expect("last valid placement should remain readable");
    assert_eq!(reloaded.window_placement(), Some(first));
}

#[test]
fn invalid_window_placement_is_rejected_without_mutation() {
    let (_test_directory, mut state) = loaded_state();
    let mut invalid = sample_window_placement(0, 0);
    invalid.window_label = "tasks".to_owned();

    let error = state
        .save_window_placement(invalid)
        .expect_err("a placement for another native window should fail");

    assert_eq!(error.code, AppErrorCode::Validation);
    assert!(state.window_placement().is_none());
    assert_eq!(state.revision(), 0);
}

#[test]
fn persisted_state_ignores_the_legacy_play_sound_setting() {
    let test_directory = TestDirectory::new();
    fs::write(
        test_directory.path().join("dailynotch.json"),
        br#"{
            "schema_version": 1,
            "tasks": [],
            "sessions": [],
            "settings": {
                "focusMinutes": 25,
                "notificationsEnabled": true,
                "playSound": false
            }
        }"#,
    )
    .expect("legacy payload should be written");

    let state = AppState::load(Repository::new(test_directory.path()))
        .expect("legacy payload should still load");
    let json = serde_json::to_value(state.snapshot()).expect("snapshot should serialize");

    assert!(json["settings"].get("playSound").is_none());
    assert!(state.snapshot().settings.notifications_enabled);
}

#[test]
fn persistence_write_failure_restores_state_without_revision_increment() {
    let (test_directory, mut state) = loaded_state();
    add_task(
        &mut state,
        "12121212-1212-4121-8121-121212121212",
        "Confirmed task",
        None,
        31,
        8,
    );
    let before = state.snapshot();
    let original_bytes = fs::read(test_directory.path().join("dailynotch.json"))
        .expect("confirmed JSON should be readable");
    state.fail_next_persistence_write();

    let error = state
        .update_settings(FocusSettingsPatch {
            focus_minutes: Some(50),
            ..FocusSettingsPatch::default()
        })
        .expect_err("simulated persistence failure should be returned");

    assert_eq!(error.code, AppErrorCode::Persistence);
    assert_eq!(error.message, "Unable to persist local data.");
    assert_eq!(state.snapshot(), before);
    assert_eq!(state.revision(), before.revision);
    assert_eq!(
        fs::read(test_directory.path().join("dailynotch.json"))
            .expect("confirmed JSON should remain readable"),
        original_bytes
    );
}

#[test]
fn persistence_rename_failure_restores_state_without_revision_increment() {
    let (_test_directory, mut state) = loaded_state();
    add_task(
        &mut state,
        "13131313-1313-4131-8131-131313131313",
        "Confirmed task",
        None,
        31,
        8,
    );
    let before = state.snapshot();
    state.fail_next_persistence_rename();

    let error = state
        .update_settings(FocusSettingsPatch {
            minimal_mode: Some(true),
            ..FocusSettingsPatch::default()
        })
        .expect_err("simulated rename failure should be returned");

    assert_eq!(error.code, AppErrorCode::Persistence);
    assert_eq!(state.snapshot(), before);
    assert_eq!(state.revision(), before.revision);
}

#[test]
fn completing_the_active_task_clears_runtime_focus() {
    let (_test_directory, mut state) = loaded_state();
    let task_id = add_active_task(&mut state);

    state
        .update_task_at(
            update_input(task_id, "Active task", None, 25, true),
            timestamp(31, 10) + Duration::minutes(5),
        )
        .expect("completing the task should succeed");

    assert_eq!(state.snapshot().focus, FocusSnapshot::default());
    assert!(state.snapshot().tasks[0].is_done);
    assert_eq!(state.snapshot().tasks[0].focused_seconds, 300);
    assert_eq!(state.snapshot().sessions.len(), 1);
    assert!(state.snapshot().sessions[0].completed);
}

#[test]
fn deleting_the_active_task_clears_runtime_focus() {
    let (_test_directory, mut state) = loaded_state();
    let task_id = add_active_task(&mut state);

    state
        .delete_task_at(
            &task_id.to_string(),
            timestamp(31, 10) + Duration::minutes(5),
        )
        .expect("deleting the task should succeed");

    assert_eq!(state.snapshot().focus, FocusSnapshot::default());
    assert!(state.snapshot().tasks.is_empty());
    assert_eq!(state.snapshot().sessions.len(), 1);
    assert_eq!(state.snapshot().sessions[0].task_id, None);
    assert_eq!(state.snapshot().sessions[0].focused_seconds, 300);
    assert!(!state.snapshot().sessions[0].completed);
}

#[test]
fn persistence_failure_restores_focus_when_completion_would_clear_it() {
    let (_test_directory, mut state) = loaded_state();
    let task_id = add_active_task(&mut state);
    let before = state.snapshot();
    state.fail_next_persistence_write();

    let error = state
        .update_task(update_input(task_id, "Active task", None, 25, true))
        .expect_err("the simulated write should fail");

    assert_eq!(error.code, AppErrorCode::Persistence);
    assert_eq!(state.snapshot(), before);
}

#[test]
fn persistence_failure_restores_automatic_completion_and_runtime_accounting() {
    let (_test_directory, mut state) = loaded_state();
    let task_id = add_active_task(&mut state);
    let before = state.snapshot();
    let token = state.focus_token;
    state.fail_next_persistence_write();

    let error = state
        .complete_focus_if_due_at(token, timestamp(31, 10) + Duration::minutes(25))
        .expect_err("the simulated write should fail");

    assert_eq!(error.code, AppErrorCode::Persistence);
    assert_eq!(state.snapshot(), before);
    assert_eq!(state.snapshot().tasks[0].id, task_id);
    assert_eq!(state.snapshot().sessions.len(), 0);
}

#[test]
fn duplicate_and_out_of_bucket_reorders_are_rejected_without_mutation() {
    let mut state = AppState::default();
    let first_id = add_task(
        &mut state,
        "17171717-1717-4171-8171-171717171717",
        "First",
        Some("2026-08-31"),
        31,
        9,
    );
    let second_id = add_task(
        &mut state,
        "18181818-1818-4181-8181-181818181818",
        "Second",
        None,
        31,
        10,
    );
    let before = state.snapshot();

    let duplicate_error = state
        .move_tasks(MoveTasksInput {
            task_ids: vec![first_id.to_string(), first_id.to_string()],
            source: TaskBucket::for_date("2026-08-31"),
            destination: TaskBucket::for_date("2026-08-31"),
        })
        .expect_err("duplicate ids should fail");
    assert_eq!(duplicate_error.code, AppErrorCode::Validation);

    let outside_error = state
        .move_tasks(MoveTasksInput {
            task_ids: vec![second_id.to_string()],
            source: TaskBucket::for_date("2026-08-31"),
            destination: TaskBucket::for_date("2026-08-31"),
        })
        .expect_err("an id outside the source bucket should fail");
    assert_eq!(outside_error.code, AppErrorCode::Conflict);
    assert_eq!(state.snapshot(), before);
}
