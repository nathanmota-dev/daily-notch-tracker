use chrono::{DateTime, Duration, NaiveDate, Utc};
use uuid::Uuid;

use super::*;
use crate::domain::{CreateTaskInput, UpdateTaskInput};

fn timestamp() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-08-31T12:00:00Z")
        .expect("test timestamp should be valid")
        .with_timezone(&Utc)
}

fn date() -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 8, 31).expect("test date should be valid")
}

fn task_input(title: &str, estimate_minutes: i64, scheduled_date: Option<&str>) -> CreateTaskInput {
    CreateTaskInput {
        title: title.to_owned(),
        notes: String::new(),
        scheduled_date: scheduled_date.map(str::to_owned),
        estimate_minutes,
    }
}

#[test]
fn start_focus_uses_the_task_estimate_and_increments_revision() {
    let task_id = Uuid::new_v4();
    let mut state = AppState::default();
    state
        .add_task_at(task_input("Focus task", 40, None), task_id, timestamp())
        .expect("test task should be added");

    let snapshot = state
        .start_focus_at(Some(task_id), timestamp())
        .expect("focus should start");

    assert_eq!(snapshot.revision, 2);
    assert_eq!(snapshot.focus.state, FocusState::Running);
    assert_eq!(snapshot.focus.active_task_id, Some(task_id));
    assert_eq!(
        snapshot.focus.active_task_title.as_deref(),
        Some("Focus task")
    );
    assert_eq!(snapshot.focus.total_ms, 40 * 60 * 1_000);
}

#[test]
fn start_focus_rejects_a_completed_task_without_mutating_focus() {
    let task_id = Uuid::new_v4();
    let mut state = AppState::default();
    state
        .add_task_at(task_input("Done task", 25, None), task_id, timestamp())
        .expect("test task should be added");
    state
        .update_task(UpdateTaskInput {
            id: task_id.to_string(),
            title: "Done task".to_owned(),
            notes: String::new(),
            scheduled_date: None,
            estimate_minutes: 25,
            is_done: true,
        })
        .expect("task should be completed");
    let before = state.snapshot();

    let error = state
        .start_focus_at(Some(task_id), timestamp())
        .expect_err("completed task should not start focus");

    assert_eq!(error.code, crate::domain::AppErrorCode::Conflict);
    assert_eq!(state.snapshot(), before);
}

#[test]
fn pause_and_resume_update_remaining_time_and_revision() {
    let mut state = AppState::default();
    state
        .start_focus_at(None, timestamp())
        .expect("standalone focus should start");

    let paused = state
        .pause_focus_at(timestamp() + Duration::minutes(5) + Duration::seconds(2))
        .expect("running focus should pause");
    assert_eq!(paused.focus.state, FocusState::Paused);
    assert_eq!(paused.focus.end_at, None);
    assert_eq!(paused.focus.paused_remaining_ms, Some(1_198_000));

    let resumed = state
        .resume_focus_at(timestamp() + Duration::minutes(10))
        .expect("paused focus should resume");
    assert_eq!(resumed.focus.state, FocusState::Running);
    assert_eq!(resumed.focus.paused_remaining_ms, None);
    assert_eq!(
        resumed.focus.end_at,
        Some(timestamp() + Duration::minutes(29) + Duration::seconds(58))
    );
}

#[test]
fn stop_focus_returns_to_idle_without_persisting_runtime_data() {
    let mut state = AppState::default();
    state
        .start_focus_at(None, timestamp())
        .expect("standalone focus should start");

    let stopped = state.stop_focus().expect("active focus should stop");

    assert_eq!(stopped.focus, FocusSnapshot::default());
    assert_eq!(stopped.revision, 2);
    assert!(stopped.sessions.is_empty());
}

#[test]
fn toggle_focus_selects_the_first_pending_task_for_today() {
    let first_id = Uuid::new_v4();
    let second_id = Uuid::new_v4();
    let mut state = AppState::default();
    state
        .add_task_at(
            task_input("First", 25, Some("2026-08-31")),
            first_id,
            timestamp(),
        )
        .expect("first task should be added");
    state
        .add_task_at(
            task_input("Second", 30, Some("2026-08-31")),
            second_id,
            timestamp() + Duration::minutes(1),
        )
        .expect("second task should be added");

    let snapshot = state
        .toggle_focus_at(date(), timestamp())
        .expect("toggle should start focus");

    assert_eq!(snapshot.focus.active_task_id, Some(first_id));
}

#[test]
fn toggle_focus_starts_a_standalone_block_when_today_has_no_pending_task() {
    let mut state = AppState::default();

    let snapshot = state
        .toggle_focus_at(date(), timestamp())
        .expect("toggle should start standalone focus");

    assert_eq!(snapshot.focus.state, FocusState::Running);
    assert_eq!(snapshot.focus.active_task_id, None);
    assert_eq!(snapshot.focus.active_task_title, None);
}

#[test]
fn invalid_focus_transitions_return_conflicts() {
    let mut state = AppState::default();

    assert_eq!(
        state.pause_focus().unwrap_err().code,
        crate::domain::AppErrorCode::Conflict
    );
    assert_eq!(
        state.resume_focus().unwrap_err().code,
        crate::domain::AppErrorCode::Conflict
    );
    assert_eq!(
        state.stop_focus().unwrap_err().code,
        crate::domain::AppErrorCode::Conflict
    );
}
