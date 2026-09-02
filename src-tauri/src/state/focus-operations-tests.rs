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
fn stop_focus_records_an_aborted_session_and_returns_to_idle() {
    let mut state = AppState::default();
    state
        .start_focus_at(None, timestamp())
        .expect("standalone focus should start");

    let stopped = state
        .stop_focus_at(timestamp() + Duration::minutes(2))
        .expect("active focus should stop");

    assert_eq!(stopped.focus, FocusSnapshot::default());
    assert_eq!(stopped.revision, 2);
    assert_eq!(stopped.sessions.len(), 1);
    assert_eq!(stopped.sessions[0].focused_seconds, 120);
    assert!(!stopped.sessions[0].completed);
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

#[test]
fn completion_at_the_deadline_records_the_full_completed_session() {
    let mut state = AppState::default();
    state
        .start_focus_at(None, timestamp())
        .expect("focus should start");

    let snapshot = state
        .complete_focus_at(timestamp() + Duration::minutes(25))
        .expect("due focus should complete")
        .expect("current token should produce a completion snapshot");

    assert_eq!(snapshot.focus, FocusSnapshot::default());
    assert_eq!(snapshot.sessions.len(), 1);
    assert_eq!(snapshot.sessions[0].started_at, timestamp());
    assert_eq!(
        snapshot.sessions[0].ended_at,
        timestamp() + Duration::minutes(25)
    );
    assert_eq!(snapshot.sessions[0].focused_seconds, 1_500);
    assert!(snapshot.sessions[0].completed);
}

#[test]
fn delayed_completion_caps_running_time_at_the_deadline() {
    let mut state = AppState::default();
    state
        .start_focus_at(None, timestamp())
        .expect("focus should start");
    let token = state.focus_token;

    let snapshot = state
        .complete_focus_if_due_at(token, timestamp() + Duration::hours(3))
        .expect("delayed focus should complete")
        .expect("current token should produce a completion snapshot");

    assert_eq!(snapshot.sessions[0].focused_seconds, 1_500);
    assert_eq!(
        snapshot.sessions[0].ended_at,
        timestamp() + Duration::minutes(25)
    );
}

#[test]
fn stopping_without_a_full_second_does_not_create_an_empty_session() {
    let mut state = AppState::default();
    state
        .start_focus_at(None, timestamp())
        .expect("focus should start");

    let snapshot = state
        .stop_focus_at(timestamp() + Duration::milliseconds(999))
        .expect("focus should stop");

    assert!(snapshot.sessions.is_empty());
    assert_eq!(snapshot.focus, FocusSnapshot::default());
}

#[test]
fn pause_freezes_elapsed_time_until_resume() {
    let mut state = AppState::default();
    state
        .start_focus_at(None, timestamp())
        .expect("focus should start");

    let paused = state
        .pause_focus_at(timestamp() + Duration::minutes(5) + Duration::seconds(2))
        .expect("focus should pause");
    assert_eq!(paused.focus.paused_remaining_ms, Some(1_198_000));

    let stopped = state
        .stop_focus_at(timestamp() + Duration::hours(2))
        .expect("paused focus should stop");

    assert_eq!(stopped.sessions[0].focused_seconds, 302);
    assert!(!stopped.sessions[0].completed);
}

#[test]
fn multiple_pause_resume_segments_only_count_running_time() {
    let mut state = AppState::default();
    state
        .start_focus_at(None, timestamp())
        .expect("focus should start");
    state
        .pause_focus_at(timestamp() + Duration::minutes(5))
        .expect("first pause should succeed");
    state
        .resume_focus_at(timestamp() + Duration::minutes(10))
        .expect("first resume should succeed");
    state
        .pause_focus_at(timestamp() + Duration::minutes(12))
        .expect("second pause should succeed");
    state
        .resume_focus_at(timestamp() + Duration::minutes(20))
        .expect("second resume should succeed");

    let stopped = state
        .stop_focus_at(timestamp() + Duration::minutes(23))
        .expect("focus should stop");

    assert_eq!(stopped.sessions[0].focused_seconds, 600);
}

#[test]
fn standalone_focus_creates_a_session_without_a_task() {
    let mut state = AppState::default();
    state
        .start_focus_at(None, timestamp())
        .expect("standalone focus should start");

    let snapshot = state
        .stop_focus_at(timestamp() + Duration::minutes(2))
        .expect("standalone focus should stop");

    assert_eq!(snapshot.sessions[0].task_id, None);
    assert_eq!(snapshot.sessions[0].focused_seconds, 120);
}

#[test]
fn starting_another_task_aborts_the_previous_session_atomically() {
    let first_id = Uuid::new_v4();
    let second_id = Uuid::new_v4();
    let mut state = AppState::default();
    state
        .add_task_at(task_input("First", 25, None), first_id, timestamp())
        .expect("first task should be added");
    state
        .add_task_at(
            task_input("Second", 30, None),
            second_id,
            timestamp() + Duration::minutes(1),
        )
        .expect("second task should be added");
    state
        .start_focus_at(Some(first_id), timestamp())
        .expect("first focus should start");

    let snapshot = state
        .start_focus_at(Some(second_id), timestamp() + Duration::minutes(10))
        .expect("starting another task should replace the focus");

    assert_eq!(snapshot.focus.active_task_id, Some(second_id));
    assert_eq!(snapshot.sessions.len(), 1);
    assert_eq!(snapshot.sessions[0].task_id, Some(first_id));
    assert_eq!(snapshot.sessions[0].focused_seconds, 600);
    assert!(!snapshot.sessions[0].completed);
}

#[test]
fn obsolete_completion_tokens_cannot_finish_a_replaced_focus() {
    let first_id = Uuid::new_v4();
    let second_id = Uuid::new_v4();
    let mut state = AppState::default();
    state
        .add_task_at(task_input("First", 25, None), first_id, timestamp())
        .expect("first task should be added");
    state
        .add_task_at(task_input("Second", 25, None), second_id, timestamp())
        .expect("second task should be added");
    state
        .start_focus_at(Some(first_id), timestamp())
        .expect("first focus should start");
    let stale_token = state.focus_token;
    state
        .start_focus_at(Some(second_id), timestamp() + Duration::minutes(1))
        .expect("second focus should replace the first");

    let result = state
        .complete_focus_if_due_at(stale_token, timestamp() + Duration::hours(1))
        .expect("stale completion should be ignored");

    assert!(result.is_none());
    assert_eq!(state.snapshot().focus.active_task_id, Some(second_id));
    assert_eq!(state.snapshot().sessions.len(), 1);
}

#[test]
fn automatic_completion_does_not_mark_the_task_done() {
    let task_id = Uuid::new_v4();
    let mut state = AppState::default();
    state
        .add_task_at(task_input("Focus task", 25, None), task_id, timestamp())
        .expect("task should be added");
    state
        .start_focus_at(Some(task_id), timestamp())
        .expect("focus should start");
    let token = state.focus_token;

    let snapshot = state
        .complete_focus_if_due_at(token, timestamp() + Duration::minutes(25))
        .expect("focus should complete")
        .expect("completion should apply");

    assert!(!snapshot.tasks[0].is_done);
    assert_eq!(snapshot.tasks[0].focused_seconds, 1_500);
}

#[test]
fn starting_the_same_active_task_is_rejected_without_a_second_session() {
    let task_id = Uuid::new_v4();
    let mut state = AppState::default();
    state
        .add_task_at(task_input("Focus task", 25, None), task_id, timestamp())
        .expect("task should be added");
    state
        .start_focus_at(Some(task_id), timestamp())
        .expect("focus should start");
    let before = state.snapshot();

    let error = state
        .start_focus_at(Some(task_id), timestamp() + Duration::minutes(1))
        .expect_err("the same active task should not restart");

    assert_eq!(error.code, crate::domain::AppErrorCode::Conflict);
    assert_eq!(state.snapshot(), before);
}

#[test]
fn focus_duration_uses_the_clamped_minimum_and_maximum() {
    let minimum_id = Uuid::new_v4();
    let maximum_id = Uuid::new_v4();
    let mut state = AppState::default();
    state
        .add_task_at(task_input("Minimum", 0, None), minimum_id, timestamp())
        .expect("minimum task should be added");
    state
        .start_focus_at(Some(minimum_id), timestamp())
        .expect("minimum focus should start");
    assert_eq!(state.snapshot().focus.total_ms, 60_000);
    state
        .stop_focus_at(timestamp())
        .expect("minimum focus should stop");

    state
        .add_task_at(task_input("Maximum", 999, None), maximum_id, timestamp())
        .expect("maximum task should be added");
    state
        .start_focus_at(Some(maximum_id), timestamp())
        .expect("maximum focus should start");

    assert_eq!(state.snapshot().focus.total_ms, 10_800_000);
}
