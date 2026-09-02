use chrono::{DateTime, Duration, Local, NaiveDate, Utc};
use uuid::Uuid;

use super::AppState;
use crate::domain::task::parse_task_id;
use crate::domain::{
    clamp_minutes, AppError, AppSnapshot, DomainResult, FocusSession, FocusSnapshot, FocusState,
};

const MILLIS_PER_MINUTE: u64 = 60_000;
const MILLIS_PER_SECOND: u64 = 1_000;

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
        self.stop_focus_at(Utc::now())
    }

    pub fn toggle_focus(&mut self) -> DomainResult<AppSnapshot> {
        self.toggle_focus_at(Local::now().date_naive(), Utc::now())
    }

    pub(crate) fn start_focus_at(
        &mut self,
        task_id: Option<Uuid>,
        started_at: DateTime<Utc>,
    ) -> DomainResult<AppSnapshot> {
        self.mutate(|state| {
            if state.focus.state != FocusState::Idle {
                if state.focus.active_task_id == task_id {
                    return Err(AppError::conflict_without_field(
                        "A focus is already active for this task.",
                    ));
                }

                state.finish_focus(started_at, false)?;
            }

            state.begin_focus(task_id, started_at)
        })
    }

    pub(crate) fn pause_focus_at(&mut self, now: DateTime<Utc>) -> DomainResult<AppSnapshot> {
        self.mutate(|state| {
            if state.focus.state != FocusState::Running {
                return Err(AppError::conflict_without_field(
                    "Only a running focus can be paused.",
                ));
            }

            let end_at = state
                .focus
                .end_at
                .ok_or_else(|| AppError::internal("The running focus is missing an end time."))?;
            if state.running_since.is_none() {
                return Err(AppError::internal(
                    "The running focus is missing its start time.",
                ));
            }

            if now >= end_at {
                state.finish_focus(now, true)?;
                return Ok(());
            }

            let accumulated_focus_ms = state.focused_millis_at(now)?;
            let remaining_ms = state.focus.total_ms.saturating_sub(accumulated_focus_ms);

            state.accumulated_focus_ms = accumulated_focus_ms;
            state.running_since = None;
            state.focus.state = FocusState::Paused;
            state.focus.end_at = None;
            state.focus.paused_remaining_ms = Some(remaining_ms);
            state.bump_focus_token()
        })
    }

    pub(crate) fn resume_focus_at(&mut self, now: DateTime<Utc>) -> DomainResult<AppSnapshot> {
        self.mutate(|state| {
            if state.focus.state != FocusState::Paused {
                return Err(AppError::conflict_without_field(
                    "Only a paused focus can be resumed.",
                ));
            }

            let remaining_ms = state.focus.paused_remaining_ms.ok_or_else(|| {
                AppError::internal("The paused focus is missing its remaining time.")
            })?;
            if remaining_ms == 0 {
                return Err(AppError::internal(
                    "The paused focus has no remaining time.",
                ));
            }

            let end_at = add_millis(now, remaining_ms)?;
            state.focus.state = FocusState::Running;
            state.focus.end_at = Some(end_at);
            state.focus.paused_remaining_ms = None;
            state.running_since = Some(now);
            state.bump_focus_token()
        })
    }

    pub(crate) fn stop_focus_at(&mut self, now: DateTime<Utc>) -> DomainResult<AppSnapshot> {
        self.mutate(|state| {
            if state.focus.state == FocusState::Idle {
                return Err(AppError::conflict_without_field(
                    "There is no active focus to stop.",
                ));
            }

            let completed = state.focus_is_due(now);
            state.finish_focus(now, completed)
        })
    }

    pub(crate) fn toggle_focus_at(
        &mut self,
        today: NaiveDate,
        now: DateTime<Utc>,
    ) -> DomainResult<AppSnapshot> {
        self.mutate(|state| {
            if state.focus.state != FocusState::Idle {
                let completed = state.focus_is_due(now);
                state.finish_focus(now, completed)
            } else {
                let task_id = state
                    .tasks_for_date(today)
                    .into_iter()
                    .find(|task| !task.is_done)
                    .map(|task| task.id);
                state.begin_focus(task_id, now)
            }
        })
    }

    pub(crate) fn complete_focus_if_due_at(
        &mut self,
        token: u64,
        now: DateTime<Utc>,
    ) -> DomainResult<Option<AppSnapshot>> {
        if self.focus_token != token || self.focus.state != FocusState::Running {
            return Ok(None);
        }

        let end_at = self
            .focus
            .end_at
            .ok_or_else(|| AppError::internal("The running focus is missing an end time."))?;
        if now < end_at {
            return Ok(None);
        }

        self.mutate(|state| state.finish_focus(now, true)).map(Some)
    }

    #[cfg(test)]
    pub(crate) fn complete_focus_at(
        &mut self,
        now: DateTime<Utc>,
    ) -> DomainResult<Option<AppSnapshot>> {
        self.complete_focus_if_due_at(self.focus_token, now)
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
        self.running_since = Some(started_at);
        self.accumulated_focus_ms = 0;
        self.bump_focus_token()
    }

    pub(super) fn finish_focus(&mut self, now: DateTime<Utc>, completed: bool) -> DomainResult<()> {
        let started_at = self
            .focus
            .started_at
            .ok_or_else(|| AppError::internal("The active focus is missing a start time."))?;
        let focused_ms = self.focused_millis_at(now)?;
        let focused_seconds = focused_ms / MILLIS_PER_SECOND;
        let ended_at = self
            .focus
            .end_at
            .map_or(now, |end_at| std::cmp::min(now, end_at))
            .max(started_at);
        let task_id = self
            .focus
            .active_task_id
            .filter(|task_id| self.tasks.iter().any(|task| task.id == *task_id));

        if focused_seconds > 0 {
            let session =
                FocusSession::new(task_id, started_at, ended_at, focused_seconds, completed)?;
            self.insert_session(session)?;
        }

        self.focus = FocusSnapshot::default();
        self.running_since = None;
        self.accumulated_focus_ms = 0;
        self.bump_focus_token()
    }

    fn focused_millis_at(&self, now: DateTime<Utc>) -> DomainResult<u64> {
        match self.focus.state {
            FocusState::Idle => Ok(0),
            FocusState::Paused => Ok(self.accumulated_focus_ms),
            FocusState::Running => {
                let running_since = self.running_since.ok_or_else(|| {
                    AppError::internal("The running focus is missing its start time.")
                })?;
                let effective_end = self
                    .focus
                    .end_at
                    .map_or(now, |end_at| std::cmp::min(now, end_at));
                let segment_ms = elapsed_millis(running_since, effective_end);
                self.accumulated_focus_ms
                    .checked_add(segment_ms)
                    .ok_or_else(|| AppError::internal("The focused time is out of range."))
            }
        }
    }

    fn focus_is_due(&self, now: DateTime<Utc>) -> bool {
        self.focus.state == FocusState::Running
            && self.focus.end_at.is_some_and(|end_at| now >= end_at)
    }

    fn bump_focus_token(&mut self) -> DomainResult<()> {
        self.focus_token = self
            .focus_token
            .checked_add(1)
            .ok_or_else(|| AppError::internal("The focus session token is exhausted."))?;
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

fn elapsed_millis(start: DateTime<Utc>, end: DateTime<Utc>) -> u64 {
    end.signed_duration_since(start).num_milliseconds().max(0) as u64
}

#[cfg(test)]
#[path = "focus-operations-tests.rs"]
mod tests;
