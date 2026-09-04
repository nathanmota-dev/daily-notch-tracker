use std::collections::BTreeMap;

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::domain::session::{activity_by_local_date, total_focused_seconds};
use crate::domain::streak::streak_from_activity;
use crate::domain::task::{parse_scheduled_date, sort_tasks, tasks_for_bucket};
use crate::domain::{
    AppError, AppSnapshot, DomainResult, FocusSession, FocusSettings, FocusSnapshot,
    ShortcutStatus, Task,
};
use crate::storage::{PersistedPayload, RecoveryDiagnostic, Repository};

#[path = "focus-operations.rs"]
mod focus_operations;
mod persistence;
#[path = "task-operations.rs"]
mod task_operations;

/// Application state and its last successfully persisted payload.
#[derive(Debug)]
pub struct AppState {
    revision: u64,
    tasks: Vec<Task>,
    sessions: Vec<FocusSession>,
    settings: FocusSettings,
    focus: FocusSnapshot,
    shortcut_status: ShortcutStatus,
    repository: Option<Repository>,
    confirmed_payload: PersistedPayload,
    recovery_diagnostic: Option<RecoveryDiagnostic>,
    running_since: Option<DateTime<Utc>>,
    accumulated_focus_ms: u64,
    focus_token: u64,
}

#[derive(Clone, Debug)]
struct MutableStateCheckpoint {
    revision: u64,
    tasks: Vec<Task>,
    sessions: Vec<FocusSession>,
    settings: FocusSettings,
    focus: FocusSnapshot,
    confirmed_payload: PersistedPayload,
    running_since: Option<DateTime<Utc>>,
    accumulated_focus_ms: u64,
    focus_token: u64,
}

impl Default for AppState {
    fn default() -> Self {
        Self::from_persisted_payload(PersistedPayload::empty())
    }
}

impl AppState {
    pub fn from_persisted_payload(payload: PersistedPayload) -> Self {
        Self::with_payload(payload, None, None)
    }

    pub fn load(mut repository: Repository) -> DomainResult<Self> {
        let loaded = repository
            .load()
            .map_err(|_| AppError::persistence("Unable to load local data."))?;

        Ok(Self::with_payload(
            loaded.payload,
            Some(repository),
            loaded.recovery_diagnostic,
        ))
    }

    pub fn new() -> Self {
        Self::default()
    }

    pub fn revision(&self) -> u64 {
        self.revision
    }

    pub fn recovery_diagnostic(&self) -> Option<&RecoveryDiagnostic> {
        self.recovery_diagnostic.as_ref()
    }

    pub fn snapshot(&self) -> AppSnapshot {
        let mut tasks = self.tasks.clone();
        sort_tasks(&mut tasks);

        AppSnapshot {
            revision: self.revision,
            tasks,
            sessions: self.sessions.clone(),
            settings: self.settings.clone(),
            focus: self.focus.clone(),
            shortcut_status: self.shortcut_status,
        }
    }

    pub fn tasks_for_date(&self, scheduled_date: NaiveDate) -> Vec<Task> {
        tasks_for_bucket(&self.tasks, Some(scheduled_date))
    }

    pub fn tasks_without_date(&self) -> Vec<Task> {
        tasks_for_bucket(&self.tasks, None)
    }

    pub fn tasks_for_date_string(&self, scheduled_date: &str) -> DomainResult<Vec<Task>> {
        let date =
            parse_scheduled_date(Some(scheduled_date), "scheduledDate")?.ok_or_else(|| {
                AppError::validation("A scheduled date is required.", "scheduledDate")
            })?;
        Ok(self.tasks_for_date(date))
    }

    pub fn activity_by_local_date(&self) -> BTreeMap<NaiveDate, u32> {
        activity_by_local_date(&self.sessions)
    }

    pub fn streak(&self, today: NaiveDate) -> u32 {
        streak_from_activity(&self.activity_by_local_date(), today)
    }

    pub fn focused_seconds_for_task(&self, task_id: Uuid) -> u64 {
        total_focused_seconds(&self.sessions, task_id)
    }

    pub(crate) fn focus_schedule(&self) -> Option<(DateTime<Utc>, u64)> {
        if self.focus.state != crate::domain::FocusState::Running {
            return None;
        }

        self.focus.end_at.map(|end_at| (end_at, self.focus_token))
    }

    pub(crate) fn set_shortcut_status(
        &mut self,
        shortcut_status: ShortcutStatus,
    ) -> DomainResult<Option<AppSnapshot>> {
        if self.shortcut_status == shortcut_status {
            return Ok(None);
        }

        self.ensure_revision_available()?;
        self.shortcut_status = shortcut_status;
        self.revision += 1;
        Ok(Some(self.snapshot()))
    }

    fn mutate<F>(&mut self, operation: F) -> DomainResult<AppSnapshot>
    where
        F: FnOnce(&mut Self) -> DomainResult<()>,
    {
        let checkpoint = MutableStateCheckpoint {
            revision: self.revision,
            tasks: self.tasks.clone(),
            sessions: self.sessions.clone(),
            settings: self.settings.clone(),
            focus: self.focus.clone(),
            confirmed_payload: self.confirmed_payload.clone(),
            running_since: self.running_since,
            accumulated_focus_ms: self.accumulated_focus_ms,
            focus_token: self.focus_token,
        };

        let result = (|| {
            self.ensure_revision_available()?;
            operation(self)?;
            self.commit()
        })();

        if result.is_err() {
            self.revision = checkpoint.revision;
            self.tasks = checkpoint.tasks;
            self.sessions = checkpoint.sessions;
            self.settings = checkpoint.settings;
            self.focus = checkpoint.focus;
            self.confirmed_payload = checkpoint.confirmed_payload;
            self.running_since = checkpoint.running_since;
            self.accumulated_focus_ms = checkpoint.accumulated_focus_ms;
            self.focus_token = checkpoint.focus_token;
        }

        result
    }
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
