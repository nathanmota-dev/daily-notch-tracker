use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Duration, NaiveDate, Utc};
use uuid::Uuid;

use super::*;
use crate::domain::session::FocusSession;
use crate::domain::{
    AppErrorCode, CreateTaskInput, FocusSettingsPatch, MoveTasksInput, TaskBucket, UpdateTaskInput,
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

#[test]
fn empty_state_matches_the_typescript_snapshot_contract() {
    let snapshot = AppState::default().snapshot();
    let json = serde_json::to_value(snapshot).expect("snapshot should serialize");

    assert_eq!(json["revision"], 0);
    assert_eq!(json["tasks"], serde_json::json!([]));
    assert_eq!(json["sessions"], serde_json::json!([]));
    assert_eq!(json["settings"]["focusMinutes"], 25);
    assert_eq!(json["focus"]["state"], "idle");
    assert_eq!(json["focus"]["activeTaskId"], serde_json::Value::Null);
    assert_eq!(json["shortcutStatus"], "unavailable");
}

#[test]
fn diagnostics_expose_the_data_path_without_persistence_details() {
    let test_directory = TestDirectory::new();
    let state = AppState::load(Repository::new(test_directory.path()))
        .expect("empty repository should load");

    let diagnostics = state.diagnostics("0.1.0".to_owned());

    assert_eq!(diagnostics.app_version, "0.1.0");
    assert!(diagnostics.data_file_path.ends_with("dailynotch.json"));
    assert_eq!(diagnostics.shortcut.status, ShortcutStatus::Unavailable);
    assert_eq!(
        diagnostics.autostart.status,
        crate::domain::IntegrationStatus::Unavailable
    );
    assert!(!diagnostics.autostart.enabled);
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
            200,
            true,
        ))
        .expect("existing task should update");
    assert_eq!(state.snapshot().revision, 2);
    assert_eq!(
        state.snapshot().tasks[0].scheduled_date,
        Some(date(2026, 9, 1))
    );
    assert_eq!(state.snapshot().tasks[0].estimate_minutes, 180);

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
fn task_durations_are_clamped_on_create_and_settings_update() {
    let mut state = AppState::default();
    let task_id = add_task(
        &mut state,
        "22222222-2222-4222-8222-222222222222",
        "Clamped task",
        None,
        31,
        9,
    );
    let snapshot = state
        .update_task(update_input(task_id, "Clamped task", None, -20, false))
        .expect("negative estimate should be clamped");
    assert_eq!(snapshot.tasks[0].estimate_minutes, 1);

    let snapshot = state
        .update_settings(FocusSettingsPatch {
            focus_minutes: Some(0),
            ..FocusSettingsPatch::default()
        })
        .expect("settings patch should succeed");
    assert_eq!(snapshot.settings.focus_minutes, 1);
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
    let tasks = snapshot
        .tasks
        .iter()
        .filter(|task| task.scheduled_date == Some(date(2026, 8, 31)))
        .collect::<Vec<_>>();
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

    let source_tasks = snapshot
        .tasks
        .iter()
        .filter(|task| task.scheduled_date == Some(date(2026, 8, 31)))
        .collect::<Vec<_>>();
    let destination_tasks = snapshot
        .tasks
        .iter()
        .filter(|task| task.scheduled_date == Some(date(2026, 9, 1)))
        .collect::<Vec<_>>();

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
    let test_directory = TestDirectory::new();
    let mut state = AppState::load(Repository::new(test_directory.path()))
        .expect("empty repository should load");
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
            minimal_mode: Some(true),
            ..FocusSettingsPatch::default()
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
    assert!(snapshot.settings.minimal_mode);
    assert_eq!(snapshot.focus, FocusSnapshot::default());
}

#[test]
fn persistence_write_failure_restores_state_without_revision_increment() {
    let test_directory = TestDirectory::new();
    let mut state = AppState::load(Repository::new(test_directory.path()))
        .expect("empty repository should load");
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
    let test_directory = TestDirectory::new();
    let mut state = AppState::load(Repository::new(test_directory.path()))
        .expect("empty repository should load");
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
