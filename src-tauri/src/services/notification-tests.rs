use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

use super::*;
use crate::domain::{
    AppSnapshot, FocusSession, FocusSettings, FocusSnapshot, FocusState, ShortcutStatus, Task,
};
use crate::services::{
    MockNotificationBackend, NotificationBackendError, NotificationPermissionState,
};

fn timestamp() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-08-31T12:00:00Z")
        .expect("test timestamp should be valid")
        .with_timezone(&Utc)
}

fn snapshot() -> AppSnapshot {
    AppSnapshot {
        revision: 0,
        tasks: Vec::new(),
        sessions: Vec::new(),
        settings: FocusSettings::default(),
        focus: FocusSnapshot::default(),
        shortcut_status: ShortcutStatus::Unavailable,
    }
}

fn task(task_id: Uuid, title: &str) -> Task {
    Task {
        id: task_id,
        title: title.to_owned(),
        notes: "private notes".to_owned(),
        scheduled_date: None,
        estimate_minutes: 25,
        is_done: false,
        created_at: timestamp(),
        focused_seconds: 0,
        sort_order: 0,
    }
}

fn active_snapshot(task_id: Option<Uuid>, title: Option<&str>) -> AppSnapshot {
    let mut snapshot = snapshot();
    snapshot.focus = FocusSnapshot {
        state: FocusState::Running,
        active_task_id: task_id,
        active_task_title: title.map(str::to_owned),
        started_at: Some(timestamp()),
        end_at: Some(timestamp() + Duration::minutes(25)),
        paused_remaining_ms: None,
        total_ms: 25 * 60 * 1_000,
    };
    snapshot
}

fn completed_session(task_id: Option<Uuid>, completed: bool, focused_seconds: u64) -> FocusSession {
    FocusSession {
        id: Uuid::new_v4(),
        task_id,
        started_at: timestamp(),
        ended_at: timestamp() + Duration::minutes(25),
        focused_seconds,
        completed,
    }
}

fn after_completion(before: &AppSnapshot, session: FocusSession) -> AppSnapshot {
    let mut after = before.clone();
    after.revision += 1;
    after.focus = FocusSnapshot::default();
    after.sessions.push(session);
    after
}

#[test]
fn completed_task_request_contains_only_the_fixed_title_and_task_title() {
    let task_id = Uuid::new_v4();
    let mut before = active_snapshot(Some(task_id), Some("Focus the release"));
    before.tasks.push(task(task_id, "Focus the release"));
    let after = after_completion(&before, completed_session(Some(task_id), true, 1_500));

    let request = focus_completion_request(&before, &after)
        .expect("a completed focus session should create a request");

    assert_eq!(request.title, FOCUS_COMPLETION_NOTIFICATION_TITLE);
    assert_eq!(request.body.as_deref(), Some("Focus the release"));
}

#[test]
fn task_free_completion_request_omits_the_body() {
    let before = active_snapshot(None, None);
    let after = after_completion(&before, completed_session(None, true, 1_500));

    let request = focus_completion_request(&before, &after)
        .expect("a task-free completed session should create a request");

    assert_eq!(request.title, FOCUS_COMPLETION_NOTIFICATION_TITLE);
    assert_eq!(request.body, None);
}

#[test]
fn aborted_empty_duplicate_and_invalid_sessions_do_not_create_requests() {
    let before = active_snapshot(None, None);

    let aborted = after_completion(&before, completed_session(None, false, 1_500));
    assert!(focus_completion_request(&before, &aborted).is_none());

    let empty = after_completion(&before, completed_session(None, true, 0));
    assert!(focus_completion_request(&before, &empty).is_none());

    let mut invalid = after_completion(&before, completed_session(None, true, 1_500));
    invalid.sessions[0].ended_at = invalid.sessions[0].started_at - Duration::seconds(1);
    assert!(focus_completion_request(&before, &invalid).is_none());

    let session = completed_session(None, true, 1_500);
    let mut duplicate_before = before.clone();
    duplicate_before.sessions.push(session.clone());
    let duplicate_after = after_completion(&duplicate_before, session);
    assert!(focus_completion_request(&duplicate_before, &duplicate_after).is_none());
}

#[test]
fn service_sends_immediately_when_permission_is_granted() {
    let backend = Arc::new(MockNotificationBackend::default());
    let service = NotificationService::new(backend.clone());
    let before = active_snapshot(None, None);
    let after = after_completion(&before, completed_session(None, true, 1_500));

    service.notify_focus_completion(&before, &after);

    assert_eq!(backend.permission_state_calls(), 1);
    assert_eq!(backend.request_permission_calls(), 0);
    assert_eq!(backend.sent_requests().len(), 1);
}

#[test]
fn service_requests_pending_permission_before_sending() {
    let backend = Arc::new(MockNotificationBackend::default());
    backend.set_permission_state(NotificationPermissionState::Prompt);
    backend.set_requested_permission_state(NotificationPermissionState::Granted);
    let service = NotificationService::new(backend.clone());
    let before = active_snapshot(None, None);
    let after = after_completion(&before, completed_session(None, true, 1_500));

    service.notify_focus_completion(&before, &after);

    assert_eq!(backend.permission_state_calls(), 1);
    assert_eq!(backend.request_permission_calls(), 1);
    assert_eq!(backend.sent_requests().len(), 1);
}

#[test]
fn denied_permission_prevents_sending_without_requesting_again() {
    let backend = Arc::new(MockNotificationBackend::default());
    backend.set_permission_state(NotificationPermissionState::Denied);
    let service = NotificationService::new(backend.clone());
    let before = active_snapshot(None, None);
    let after = after_completion(&before, completed_session(None, true, 1_500));

    service.notify_focus_completion(&before, &after);

    assert_eq!(backend.request_permission_calls(), 0);
    assert!(backend.sent_requests().is_empty());
}

#[test]
fn pending_permission_that_remains_pending_prevents_sending() {
    let backend = Arc::new(MockNotificationBackend::default());
    backend.set_permission_state(NotificationPermissionState::Prompt);
    backend.set_requested_permission_state(NotificationPermissionState::Prompt);
    let service = NotificationService::new(backend.clone());
    let before = active_snapshot(None, None);
    let after = after_completion(&before, completed_session(None, true, 1_500));

    service.notify_focus_completion(&before, &after);

    assert_eq!(backend.request_permission_calls(), 1);
    assert!(backend.sent_requests().is_empty());
}

#[test]
fn disabled_notifications_skip_permission_checks() {
    let backend = Arc::new(MockNotificationBackend::default());
    let service = NotificationService::new(backend.clone());
    let before = active_snapshot(None, None);
    let mut after = after_completion(&before, completed_session(None, true, 1_500));
    after.settings.notifications_enabled = false;

    service.notify_focus_completion(&before, &after);

    assert_eq!(backend.permission_state_calls(), 0);
    assert!(backend.sent_requests().is_empty());
}

#[test]
fn permission_backend_failures_are_ignored() {
    let backend = Arc::new(MockNotificationBackend::default());
    backend.set_permission_state_error(Some(NotificationBackendError::Unavailable));
    let service = NotificationService::new(backend.clone());
    let before = active_snapshot(None, None);
    let after = after_completion(&before, completed_session(None, true, 1_500));

    service.notify_focus_completion(&before, &after);

    assert!(backend.sent_requests().is_empty());
}

#[test]
fn permission_request_and_send_failures_are_ignored() {
    let backend = Arc::new(MockNotificationBackend::default());
    backend.set_permission_state(NotificationPermissionState::Prompt);
    backend.set_request_permission_error(Some(NotificationBackendError::Failed));
    let service = NotificationService::new(backend.clone());
    let before = active_snapshot(None, None);
    let after = after_completion(&before, completed_session(None, true, 1_500));

    service.notify_focus_completion(&before, &after);
    assert!(backend.sent_requests().is_empty());

    backend.set_permission_state(NotificationPermissionState::Granted);
    backend.set_request_permission_error(None);
    backend.set_send_error(Some(NotificationBackendError::Failed));

    service.notify_focus_completion(&before, &after);
    assert!(backend.sent_requests().is_empty());
}

#[test]
fn a_task_title_can_be_recovered_from_the_persisted_snapshot() {
    let task_id = Uuid::new_v4();
    let before = active_snapshot(Some(task_id), None);
    let mut after = after_completion(&before, completed_session(Some(task_id), true, 1_500));
    after.tasks.push(task(task_id, "Recovered task title"));

    let request = focus_completion_request(&before, &after)
        .expect("a completed focus session should create a request");

    assert_eq!(request.body.as_deref(), Some("Recovered task title"));
}
