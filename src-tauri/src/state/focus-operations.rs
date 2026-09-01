use chrono::{DateTime, Duration, Local, NaiveDate, Utc};
use uuid::Uuid;

use super::AppState;
use crate::domain::task::parse_task_id;
use crate::domain::{
    clamp_minutes, AppError, AppSnapshot, DomainResult, FocusSnapshot, FocusState,
};

const MILLIS_PER_MINUTE: u64 = 60_000;

impl AppState {
    pub fn start_focus(&mut self, task_id: Option<String>) -> DomainResult<AppSnapshot> {
        let task_id = task_id
            .as_deref()
            .map(|value| parse_task_id(value, "taskId"))
            .transpose()?;

        self.start_focus_at(task_id, Utc::now())
    }

    pub fn pause_focus(&mut self) -> DomainResult<AppSnapshot> {
        self.pause_focus_at(Utc::now())
    }

    pub fn resume_focus(&mut self) -> DomainResult<AppSnapshot> {
        self.resume_focus_at(Utc::now())
    }

    pub fn stop_focus(&mut self) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;

        if self.focus.state == FocusState::Idle {
            return Err(AppError::conflict_without_field(
                "There is no active focus to stop.",
            ));
        }

        self.focus = FocusSnapshot::default();
        self.revision += 1;
        Ok(self.snapshot())
    }

    pub fn toggle_focus(&mut self) -> DomainResult<AppSnapshot> {
        self.toggle_focus_at(Local::now().date_naive(), Utc::now())
    }

    pub(crate) fn start_focus_at(
        &mut self,
        task_id: Option<Uuid>,
        started_at: DateTime<Utc>,
    ) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;

        if self.focus.state != FocusState::Idle {
            return Err(AppError::conflict_without_field(
                "A focus is already active.",
            ));
        }

        self.begin_focus(task_id, started_at)?;
        self.revision += 1;
        Ok(self.snapshot())
    }

    pub(crate) fn pause_focus_at(&mut self, now: DateTime<Utc>) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;

        if self.focus.state != FocusState::Running {
            return Err(AppError::conflict_without_field(
                "Only a running focus can be paused.",
            ));
        }

        let Some(end_at) = self.focus.end_at else {
            return Err(AppError::internal(
                "The running focus is missing an end time.",
            ));
        };

        let remaining_ms = end_at.signed_duration_since(now).num_milliseconds().max(0) as u64;
        self.focus.state = FocusState::Paused;
        self.focus.end_at = None;
        self.focus.paused_remaining_ms = Some(remaining_ms);
        self.revision += 1;
        Ok(self.snapshot())
    }

    pub(crate) fn resume_focus_at(&mut self, now: DateTime<Utc>) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;

        if self.focus.state != FocusState::Paused {
            return Err(AppError::conflict_without_field(
                "Only a paused focus can be resumed.",
            ));
        }

        let Some(remaining_ms) = self.focus.paused_remaining_ms else {
            return Err(AppError::internal(
                "The paused focus is missing its remaining time.",
            ));
        };

        let end_at = add_millis(now, remaining_ms)?;
        self.focus.state = FocusState::Running;
        self.focus.end_at = Some(end_at);
        self.focus.paused_remaining_ms = None;
        self.revision += 1;
        Ok(self.snapshot())
    }

    pub(crate) fn toggle_focus_at(
        &mut self,
        today: NaiveDate,
        now: DateTime<Utc>,
    ) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;

        if self.focus.state != FocusState::Idle {
            self.focus = FocusSnapshot::default();
        } else {
            let task_id = self
                .tasks_for_date(today)
                .into_iter()
                .find(|task| !task.is_done)
                .map(|task| task.id);
            self.begin_focus(task_id, now)?;
        }

        self.revision += 1;
        Ok(self.snapshot())
    }

    fn begin_focus(
        &mut self,
        task_id: Option<Uuid>,
        started_at: DateTime<Utc>,
    ) -> DomainResult<()> {
        let (active_task_title, duration_minutes) = match task_id {
            Some(task_id) => {
                let task = self
                    .tasks
                    .iter()
                    .find(|task| task.id == task_id)
                    .ok_or_else(|| AppError::not_found("The task was not found.", "taskId"))?;

                if task.is_done {
                    return Err(AppError::conflict(
                        "Completed tasks cannot be focused.",
                        "taskId",
                    ));
                }

                (Some(task.title.clone()), task.estimate_minutes)
            }
            None => (None, self.settings.focus_minutes),
        };

        let total_ms = duration_ms(duration_minutes)?;
        let end_at = add_millis(started_at, total_ms)?;
        self.focus = FocusSnapshot {
            state: FocusState::Running,
            active_task_id: task_id,
            active_task_title,
            started_at: Some(started_at),
            end_at: Some(end_at),
            paused_remaining_ms: None,
            total_ms,
        };
        Ok(())
    }
}

fn duration_ms(minutes: u32) -> DomainResult<u64> {
    let minutes = u64::from(clamp_minutes(i64::from(minutes)));
    minutes
        .checked_mul(MILLIS_PER_MINUTE)
        .ok_or_else(|| AppError::internal("The focus duration is out of range."))
}

fn add_millis(timestamp: DateTime<Utc>, milliseconds: u64) -> DomainResult<DateTime<Utc>> {
    let milliseconds = i64::try_from(milliseconds)
        .map_err(|_| AppError::internal("The focus duration is out of range."))?;
    timestamp
        .checked_add_signed(Duration::milliseconds(milliseconds))
        .ok_or_else(|| AppError::internal("The focus end time is out of range."))
}

#[cfg(test)]
mod tests {
    use chrono::{DateTime, NaiveDate, Utc};
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

    fn task_input(
        title: &str,
        estimate_minutes: i64,
        scheduled_date: Option<&str>,
    ) -> CreateTaskInput {
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
}
