use std::collections::BTreeMap;

use chrono::{DateTime, FixedOffset, Local, NaiveDate, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{AppError, DomainResult};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSession {
    pub id: Uuid,
    pub task_id: Option<Uuid>,
    pub started_at: DateTime<Utc>,
    pub ended_at: DateTime<Utc>,
    pub focused_seconds: u64,
    /// `true` is a completed block; `false` is an aborted block.
    pub completed: bool,
}

impl FocusSession {
    pub fn new(
        task_id: Option<Uuid>,
        started_at: DateTime<Utc>,
        ended_at: DateTime<Utc>,
        focused_seconds: u64,
        completed: bool,
    ) -> DomainResult<Self> {
        let session = Self {
            id: Uuid::new_v4(),
            task_id,
            started_at,
            ended_at,
            focused_seconds,
            completed,
        };
        session.validate()?;
        Ok(session)
    }

    pub fn validate(&self) -> DomainResult<()> {
        if self.ended_at < self.started_at {
            return Err(AppError::validation(
                "A focus session cannot end before it starts.",
                "endedAt",
            ));
        }

        Ok(())
    }
}

pub fn total_focused_seconds(sessions: &[FocusSession], task_id: Uuid) -> u64 {
    sessions
        .iter()
        .filter(|session| session.task_id == Some(task_id))
        .map(|session| session.focused_seconds)
        .sum()
}

pub fn local_date(started_at: DateTime<Utc>) -> NaiveDate {
    started_at.with_timezone(&Local).date_naive()
}

pub fn activity_by_local_date(sessions: &[FocusSession]) -> BTreeMap<NaiveDate, u32> {
    activity_by_timezone(sessions, &Local)
}

pub fn activity_by_offset(
    sessions: &[FocusSession],
    offset: FixedOffset,
) -> BTreeMap<NaiveDate, u32> {
    activity_by_timezone(sessions, &offset)
}

fn activity_by_timezone<Tz: TimeZone>(
    sessions: &[FocusSession],
    timezone: &Tz,
) -> BTreeMap<NaiveDate, u32> {
    let mut activity = BTreeMap::new();

    for session in sessions {
        let date = session.started_at.with_timezone(timezone).date_naive();
        let count = activity.entry(date).or_insert(0_u32);
        *count = (*count).saturating_add(1);
    }

    activity
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, NaiveDate, TimeZone};

    use super::*;

    fn session(
        task_id: Option<Uuid>,
        started_at: &str,
        focused_seconds: u64,
        completed: bool,
    ) -> FocusSession {
        let started_at = DateTime::parse_from_rfc3339(started_at)
            .expect("test timestamp should be valid")
            .with_timezone(&Utc);
        FocusSession {
            id: Uuid::new_v4(),
            task_id,
            started_at,
            ended_at: started_at + Duration::hours(2),
            focused_seconds,
            completed,
        }
    }

    #[test]
    fn focused_seconds_sum_ignores_wall_clock_duration_and_completion_state() {
        let task_id = Uuid::new_v4();
        let sessions = vec![
            session(Some(task_id), "2026-08-31T10:00:00Z", 25, true),
            session(Some(task_id), "2026-08-31T11:00:00Z", 7, false),
        ];

        assert_eq!(total_focused_seconds(&sessions, task_id), 32);
    }

    #[test]
    fn activity_uses_local_date_of_started_at_for_each_session() {
        let sessions = vec![
            session(None, "2026-08-31T02:30:00Z", 20, true),
            session(None, "2026-08-31T03:30:00Z", 15, false),
            session(None, "2026-08-31T23:30:00Z", 15, true),
        ];
        let offset = FixedOffset::west_opt(3 * 60 * 60).expect("offset should be valid");

        let activity = activity_by_offset(&sessions, offset);

        let previous_date = NaiveDate::from_ymd_opt(2026, 8, 30).expect("test date");
        let current_date = NaiveDate::from_ymd_opt(2026, 8, 31).expect("test date");
        assert_eq!(activity.get(&previous_date), Some(&1));
        assert_eq!(activity.get(&current_date), Some(&2));
    }

    #[test]
    fn session_serialization_preserves_completed_and_aborted_values() {
        let session = session(Some(Uuid::nil()), "2026-08-31T12:00:00Z", 42, false);
        let json = serde_json::to_value(session).expect("session should serialize");

        assert_eq!(json["taskId"], Uuid::nil().to_string());
        assert_eq!(json["startedAt"], "2026-08-31T12:00:00Z");
        assert_eq!(json["focusedSeconds"], 42);
        assert_eq!(json["completed"], false);
    }

    #[test]
    fn session_constructor_rejects_end_before_start() {
        let start = Utc
            .with_ymd_and_hms(2026, 8, 31, 12, 0, 0)
            .single()
            .expect("test date");
        let error = FocusSession::new(
            Some(Uuid::nil()),
            start,
            start - Duration::seconds(1),
            1,
            false,
        )
        .expect_err("invalid session range should be rejected");

        assert_eq!(error.code, super::super::AppErrorCode::Validation);
    }
}
