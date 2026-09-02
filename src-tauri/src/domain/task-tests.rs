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
    let error =
        validate_task_fields(" \n\t ", "", None, 25).expect_err("a blank title should be rejected");

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
fn validation_accepts_duration_endpoints() {
    assert_eq!(
        validate_estimate_minutes(MIN_DURATION_MINUTES)
            .expect("the minimum duration should be valid"),
        1
    );
    assert_eq!(
        validate_estimate_minutes(MAX_DURATION_MINUTES)
            .expect("the maximum duration should be valid"),
        180
    );
}

#[test]
fn validation_rejects_duration_outside_the_inclusive_range() {
    for estimate_minutes in [MIN_DURATION_MINUTES - 1, MAX_DURATION_MINUTES + 1] {
        let error = validate_task_fields("Task", "", None, estimate_minutes)
            .expect_err("an out-of-range duration should be rejected");

        assert_eq!(error.code, super::super::AppErrorCode::Validation);
        assert_eq!(error.field.as_deref(), Some("estimateMinutes"));
    }
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
        parse_scheduled_date(Some("2026-08-31"), "scheduledDate").expect("valid date should parse"),
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
        Uuid::parse_str("11111111-1111-4111-8111-111111111111").expect("test UUID should be valid"),
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
