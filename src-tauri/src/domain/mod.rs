//! Domain models and rules shared by the desktop application.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

pub mod session;
pub mod settings;
pub mod streak;
pub mod task;

pub use session::{
    activity_by_local_date, activity_by_offset, local_date, total_focused_seconds, FocusSession,
};
pub use settings::{FocusSettings, FocusSettingsPatch};
pub use streak::{
    calculate_streak, streak_from_activity, streak_from_sessions, streak_from_sessions_at_offset,
};
pub use task::{
    clamp_minutes, parse_scheduled_date, parse_task_id, CreateTaskInput, MoveTasksInput, Task,
    TaskBucket, UpdateTaskInput,
};

pub type DomainResult<T> = Result<T, AppError>;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AppErrorCode {
    Validation,
    NotFound,
    Conflict,
    Persistence,
    PermissionDenied,
    IntegrationUnavailable,
    InvalidUrl,
    CommandUnavailable,
    Internal,
}

#[derive(Clone, Debug, Eq, Error, PartialEq, Serialize)]
#[error("{message}")]
pub struct AppError {
    pub code: AppErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
}

impl AppError {
    pub fn validation(message: impl Into<String>, field: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::Validation,
            message: message.into(),
            field: Some(field.into()),
        }
    }

    pub fn validation_without_field(message: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::Validation,
            message: message.into(),
            field: None,
        }
    }

    pub fn not_found(message: impl Into<String>, field: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::NotFound,
            message: message.into(),
            field: Some(field.into()),
        }
    }

    pub fn conflict(message: impl Into<String>, field: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::Conflict,
            message: message.into(),
            field: Some(field.into()),
        }
    }

    pub fn persistence(message: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::Persistence,
            message: message.into(),
            field: None,
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::Internal,
            message: message.into(),
            field: None,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FocusState {
    #[default]
    Idle,
    Running,
    Paused,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSnapshot {
    pub state: FocusState,
    pub active_task_id: Option<Uuid>,
    pub active_task_title: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub end_at: Option<DateTime<Utc>>,
    pub paused_remaining_ms: Option<u64>,
    pub total_ms: u64,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ShortcutStatus {
    Registered,
    #[default]
    Unavailable,
    Error,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    /// Monotonic runtime revision used to reject stale cross-window updates.
    pub revision: u64,
    pub tasks: Vec<Task>,
    pub sessions: Vec<FocusSession>,
    pub settings: FocusSettings,
    pub focus: FocusSnapshot,
    pub shortcut_status: ShortcutStatus,
}
