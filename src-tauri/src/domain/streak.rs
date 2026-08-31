use std::collections::{BTreeMap, BTreeSet};

use chrono::{Duration, NaiveDate};

use super::session::{activity_by_local_date, activity_by_offset, FocusSession};

pub fn calculate_streak<I>(active_dates: I, today: NaiveDate) -> u32
where
    I: IntoIterator<Item = NaiveDate>,
{
    let active_dates = active_dates.into_iter().collect::<BTreeSet<_>>();
    let Some(mut current_date) = streak_start(&active_dates, today) else {
        return 0;
    };

    let mut streak = 0_u32;

    loop {
        if !active_dates.contains(&current_date) {
            break;
        }

        streak = streak.saturating_add(1);
        let Some(previous_date) = current_date.checked_sub_signed(Duration::days(1)) else {
            break;
        };
        current_date = previous_date;
    }

    streak
}

pub fn streak_from_activity(activity: &BTreeMap<NaiveDate, u32>, today: NaiveDate) -> u32 {
    calculate_streak(
        activity
            .iter()
            .filter_map(|(date, count)| (*count > 0).then_some(*date)),
        today,
    )
}

pub fn streak_from_sessions(sessions: &[FocusSession], today: NaiveDate) -> u32 {
    streak_from_activity(&activity_by_local_date(sessions), today)
}

pub fn streak_from_sessions_at_offset(
    sessions: &[FocusSession],
    offset: chrono::FixedOffset,
    today: NaiveDate,
) -> u32 {
    streak_from_activity(&activity_by_offset(sessions, offset), today)
}

fn streak_start(active_dates: &BTreeSet<NaiveDate>, today: NaiveDate) -> Option<NaiveDate> {
    if active_dates.contains(&today) {
        return Some(today);
    }

    let yesterday = today.checked_sub_signed(Duration::days(1))?;
    active_dates.contains(&yesterday).then_some(yesterday)
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use super::*;

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("test date should be valid")
    }

    #[test]
    fn empty_activity_has_no_streak() {
        assert_eq!(
            calculate_streak(Vec::<NaiveDate>::new(), date(2026, 8, 31)),
            0
        );
    }

    #[test]
    fn activity_today_starts_a_one_day_streak() {
        assert_eq!(
            calculate_streak(vec![date(2026, 8, 31)], date(2026, 8, 31)),
            1
        );
    }

    #[test]
    fn activity_yesterday_can_still_end_the_streak() {
        assert_eq!(
            calculate_streak(vec![date(2026, 8, 30)], date(2026, 8, 31)),
            1
        );
    }

    #[test]
    fn consecutive_activity_counts_backwards_from_today() {
        assert_eq!(
            calculate_streak(
                vec![date(2026, 8, 29), date(2026, 8, 30), date(2026, 8, 31)],
                date(2026, 8, 31),
            ),
            3
        );
    }

    #[test]
    fn a_gap_breaks_the_streak() {
        assert_eq!(
            calculate_streak(
                vec![date(2026, 8, 27), date(2026, 8, 29), date(2026, 8, 30)],
                date(2026, 8, 30),
            ),
            2
        );
    }

    #[test]
    fn streak_crosses_month_and_year_boundaries() {
        assert_eq!(
            calculate_streak(
                vec![date(2025, 12, 31), date(2026, 1, 1), date(2026, 1, 2)],
                date(2026, 1, 2),
            ),
            3
        );
    }

    #[test]
    fn activity_counts_only_positive_days() {
        let mut activity = BTreeMap::new();
        activity.insert(date(2026, 8, 30), 0);
        activity.insert(date(2026, 8, 31), 2);

        assert_eq!(streak_from_activity(&activity, date(2026, 8, 31)), 1);
    }
}
