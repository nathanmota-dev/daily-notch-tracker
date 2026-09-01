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
#[path = "focus-operations-tests.rs"]
mod tests;
