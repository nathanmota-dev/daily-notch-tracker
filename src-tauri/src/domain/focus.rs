use serde::{Deserialize, Serialize};

use super::{AppError, DomainResult};

pub const MIN_FOCUS_DURATION_SECONDS: u64 = 1;
pub const MAX_FOCUS_DURATION_SECONDS: u64 = 10_800;

/// Runtime-only input used to start a focus session.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartFocusInput {
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub duration_seconds: Option<u64>,
}

impl StartFocusInput {
    pub fn without_custom_duration(task_id: Option<String>) -> Self {
        Self {
            task_id,
            duration_seconds: None,
        }
    }
}

pub fn validate_duration_seconds(duration_seconds: u64) -> DomainResult<u64> {
    if !(MIN_FOCUS_DURATION_SECONDS..=MAX_FOCUS_DURATION_SECONDS).contains(&duration_seconds) {
        return Err(AppError::validation(
            "The focus duration must be between 1 and 10,800 seconds.",
            "durationSeconds",
        ));
    }

    Ok(duration_seconds)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn custom_duration_accepts_the_inclusive_bounds() {
        assert_eq!(validate_duration_seconds(1), Ok(1));
        assert_eq!(validate_duration_seconds(10_800), Ok(10_800));
    }

    #[test]
    fn custom_duration_rejects_zero_and_values_above_three_hours() {
        assert_eq!(
            validate_duration_seconds(0).unwrap_err().field,
            Some("durationSeconds".to_owned())
        );
        assert_eq!(
            validate_duration_seconds(10_801).unwrap_err().field,
            Some("durationSeconds".to_owned())
        );
    }

    #[test]
    fn input_serializes_with_the_frontend_field_names() {
        let input = StartFocusInput {
            task_id: Some("task-1".to_owned()),
            duration_seconds: Some(1_530),
        };

        let value = serde_json::to_value(input).expect("focus input should serialize");

        assert_eq!(value["taskId"], "task-1");
        assert_eq!(value["durationSeconds"], 1_530);
    }
}
