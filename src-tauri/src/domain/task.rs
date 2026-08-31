use std::cmp::Ordering;

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{AppError, DomainResult};

pub const MAX_TITLE_CHARS: usize = 150;
pub const MAX_NOTES_CHARS: usize = 500;
pub const MIN_DURATION_MINUTES: i64 = 1;
pub const MAX_DURATION_MINUTES: i64 = 180;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: Uuid,
    pub title: String,
    pub notes: String,
    pub scheduled_date: Option<NaiveDate>,
    pub estimate_minutes: u32,
    pub is_done: bool,
    pub created_at: DateTime<Utc>,
    pub focused_seconds: u64,
    pub sort_order: u32,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub scheduled_date: Option<String>,
    pub estimate_minutes: i64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub scheduled_date: Option<String>,
    pub estimate_minutes: i64,
    pub is_done: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TaskBucket {
    #[serde(default)]
    pub scheduled_date: Option<String>,
}

impl TaskBucket {
    pub fn unscheduled() -> Self {
        Self {
            scheduled_date: None,
        }
    }

    pub fn for_date(scheduled_date: impl Into<String>) -> Self {
        Self {
            scheduled_date: Some(scheduled_date.into()),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MoveTasksInput {
    pub task_ids: Vec<String>,
    pub source: TaskBucket,
    pub destination: TaskBucket,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ValidatedTaskFields {
    pub title: String,
    pub notes: String,
    pub scheduled_date: Option<NaiveDate>,
    pub estimate_minutes: u32,
}

impl Task {
    pub fn from_input(
        input: CreateTaskInput,
        id: Uuid,
        created_at: DateTime<Utc>,
        sort_order: u32,
    ) -> DomainResult<Self> {
        let fields = validate_task_fields(
            &input.title,
            &input.notes,
            input.scheduled_date.as_deref(),
            input.estimate_minutes,
        )?;

        Ok(Self {
            id,
            title: fields.title,
            notes: fields.notes,
            scheduled_date: fields.scheduled_date,
            estimate_minutes: fields.estimate_minutes,
            is_done: false,
            created_at,
            focused_seconds: 0,
            sort_order,
        })
    }
}

pub fn validate_task_fields(
    title: &str,
    notes: &str,
    scheduled_date: Option<&str>,
    estimate_minutes: i64,
) -> DomainResult<ValidatedTaskFields> {
    let title = title.trim().to_owned();

    if title.is_empty() {
        return Err(AppError::validation("The title is required.", "title"));
    }

    if title.chars().count() > MAX_TITLE_CHARS {
        return Err(AppError::validation(
            "The title must be 150 characters or fewer.",
            "title",
        ));
    }

    if notes.chars().count() > MAX_NOTES_CHARS {
        return Err(AppError::validation(
            "Notes must be 500 characters or fewer.",
            "notes",
        ));
    }

    Ok(ValidatedTaskFields {
        title,
        notes: notes.to_owned(),
        scheduled_date: parse_scheduled_date(scheduled_date, "scheduledDate")?,
        estimate_minutes: clamp_minutes(estimate_minutes),
    })
}

pub fn clamp_minutes(minutes: i64) -> u32 {
    minutes.clamp(MIN_DURATION_MINUTES, MAX_DURATION_MINUTES) as u32
}

pub fn parse_task_id(value: &str, field: &str) -> DomainResult<Uuid> {
    Uuid::parse_str(value.trim())
        .map_err(|_| AppError::validation("The task id must be a valid UUID.", field))
}

pub fn parse_scheduled_date(value: Option<&str>, field: &str) -> DomainResult<Option<NaiveDate>> {
    let Some(value) = value else {
        return Ok(None);
    };

    let is_iso_date = value.len() == 10
        && value.as_bytes().get(4) == Some(&b'-')
        && value.as_bytes().get(7) == Some(&b'-')
        && value
            .bytes()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit());

    if !is_iso_date {
        return Err(AppError::validation(
            "The scheduled date must use YYYY-MM-DD.",
            field,
        ));
    }

    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(Some)
        .map_err(|_| AppError::validation("The scheduled date is invalid.", field))
}

pub fn sort_tasks(tasks: &mut [Task]) {
    tasks.sort_by(compare_tasks);
}

pub fn compare_tasks(left: &Task, right: &Task) -> Ordering {
    left.is_done
        .cmp(&right.is_done)
        .then_with(|| left.sort_order.cmp(&right.sort_order))
        .then_with(|| left.created_at.cmp(&right.created_at))
        .then_with(|| left.id.cmp(&right.id))
}

pub fn tasks_for_bucket(tasks: &[Task], scheduled_date: Option<NaiveDate>) -> Vec<Task> {
    let mut matching = tasks
        .iter()
        .filter(|task| task.scheduled_date == scheduled_date)
        .cloned()
        .collect::<Vec<_>>();
    sort_tasks(&mut matching);
    matching
}

pub fn reindex_bucket(tasks: &mut [Task], scheduled_date: Option<NaiveDate>) -> DomainResult<()> {
    let mut indices = tasks
        .iter()
        .enumerate()
        .filter_map(|(index, task)| (task.scheduled_date == scheduled_date).then_some(index))
        .collect::<Vec<_>>();

    indices.sort_by(|left, right| compare_tasks(&tasks[*left], &tasks[*right]));

    for (sort_order, index) in indices.into_iter().enumerate() {
        let sort_order = u32::try_from(sort_order)
            .map_err(|_| AppError::internal("The task bucket contains too many tasks."))?;
        tasks[index].sort_order = sort_order;
    }

    Ok(())
}

pub fn next_sort_order(
    tasks: &[Task],
    scheduled_date: Option<NaiveDate>,
    excluded_ids: &[Uuid],
) -> DomainResult<u32> {
    let maximum = tasks
        .iter()
        .filter(|task| task.scheduled_date == scheduled_date && !excluded_ids.contains(&task.id))
        .map(|task| task.sort_order)
        .max();

    match maximum {
        Some(value) => value
            .checked_add(1)
            .ok_or_else(|| AppError::internal("The task bucket sort order is exhausted.")),
        None => Ok(0),
    }
}

#[cfg(test)]
mod tests {
    use chrono::{DateTime, NaiveDate, Utc};

    use super::*;

    fn timestamp() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-08-31T12:34:56Z")
            .expect("test timestamp should be valid")
            .with_timezone(&Utc)
    }

    #[test]
    fn validation_trims_title_and_preserves_notes() {
        let fields = validate_task_fields("  Focus block  ", "  note  ", None, 25)
            .expect("valid task fields should be accepted");

        assert_eq!(fields.title, "Focus block");
        assert_eq!(fields.notes, "  note  ");
    }

    #[test]
    fn validation_counts_unicode_title_characters() {
        let title = "é".repeat(MAX_TITLE_CHARS);
        let fields = validate_task_fields(&title, "", None, 25)
            .expect("a 150-character Unicode title should be accepted");

        assert_eq!(fields.title.chars().count(), MAX_TITLE_CHARS);
    }

    #[test]
    fn validation_rejects_empty_trimmed_title() {
        let error = validate_task_fields(" \n\t ", "", None, 25)
            .expect_err("a blank title should be rejected");

        assert_eq!(error.code, super::super::AppErrorCode::Validation);
        assert_eq!(error.field.as_deref(), Some("title"));
    }

    #[test]
    fn validation_rejects_title_over_150_unicode_characters() {
        let title = "🙂".repeat(MAX_TITLE_CHARS + 1);
        let error = validate_task_fields(&title, "", None, 25)
            .expect_err("a title over the limit should be rejected");

        assert_eq!(error.field.as_deref(), Some("title"));
    }

    #[test]
    fn validation_rejects_notes_over_500_unicode_characters() {
        let notes = "界".repeat(MAX_NOTES_CHARS + 1);
        let error = validate_task_fields("Task", &notes, None, 25)
            .expect_err("notes over the limit should be rejected");

        assert_eq!(error.field.as_deref(), Some("notes"));
    }

    #[test]
    fn durations_are_clamped_to_the_inclusive_range() {
        assert_eq!(clamp_minutes(-10), 1);
        assert_eq!(clamp_minutes(0), 1);
        assert_eq!(clamp_minutes(90), 90);
        assert_eq!(clamp_minutes(999), 180);
    }

    #[test]
    fn scheduled_date_requires_a_real_iso_date() {
        assert_eq!(
            parse_scheduled_date(Some("2026-08-31"), "scheduledDate")
                .expect("valid date should parse"),
            Some(NaiveDate::from_ymd_opt(2026, 8, 31).expect("test date should be valid"))
        );

        let error = parse_scheduled_date(Some("31/08/2026"), "scheduledDate")
            .expect_err("non-ISO date should be rejected");
        assert_eq!(error.field.as_deref(), Some("scheduledDate"));
    }

    #[test]
    fn task_serialization_uses_the_typescript_contract() {
        let task = Task::from_input(
            CreateTaskInput {
                title: "  Plan  ".to_owned(),
                notes: "Notes".to_owned(),
                scheduled_date: Some("2026-08-31".to_owned()),
                estimate_minutes: 25,
            },
            Uuid::parse_str("11111111-1111-4111-8111-111111111111")
                .expect("test UUID should be valid"),
            timestamp(),
            3,
        )
        .expect("valid task should be created");

        let json = serde_json::to_value(task).expect("task should serialize");

        assert_eq!(json["id"], "11111111-1111-4111-8111-111111111111");
        assert_eq!(json["scheduledDate"], "2026-08-31");
        assert_eq!(json["createdAt"], "2026-08-31T12:34:56Z");
        assert_eq!(json["estimateMinutes"], 25);
        assert_eq!(json["isDone"], false);
        assert_eq!(json["focusedSeconds"], 0);
        assert_eq!(json["sortOrder"], 3);
    }
}
