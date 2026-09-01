use std::collections::{BTreeMap, HashSet};

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::domain::session::{activity_by_local_date, total_focused_seconds};
use crate::domain::streak::streak_from_activity;
use crate::domain::task::{
    next_sort_order, parse_scheduled_date, parse_task_id, reindex_bucket, sort_tasks,
    tasks_for_bucket, validate_task_fields,
};
use crate::domain::{
    AppError, AppSnapshot, CreateTaskInput, DomainResult, FocusSession, FocusSettings,
    FocusSettingsPatch, FocusSnapshot, MoveTasksInput, ShortcutStatus, Task, UpdateTaskInput,
};
use crate::storage::{PersistedPayload, RecoveryDiagnostic, Repository};

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
        let loaded = repository.load().map_err(|error| {
            AppError::persistence(format!("Unable to load local data: {error}"))
        })?;

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

    pub fn add_task(&mut self, input: CreateTaskInput) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;
        let scheduled_date =
            parse_scheduled_date(input.scheduled_date.as_deref(), "scheduledDate")?;
        let sort_order = next_sort_order(&self.tasks, scheduled_date, &[])?;
        let task = Task::from_input(input, Uuid::new_v4(), Utc::now(), sort_order)?;

        self.tasks.push(task);
        self.commit()
    }

    pub fn add_task_at(
        &mut self,
        input: CreateTaskInput,
        id: Uuid,
        created_at: DateTime<Utc>,
    ) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;
        if self.tasks.iter().any(|task| task.id == id) {
            return Err(AppError::conflict(
                "A task with this id already exists.",
                "id",
            ));
        }
        let scheduled_date =
            parse_scheduled_date(input.scheduled_date.as_deref(), "scheduledDate")?;
        let sort_order = next_sort_order(&self.tasks, scheduled_date, &[])?;
        let task = Task::from_input(input, id, created_at, sort_order)?;

        self.tasks.push(task);
        self.commit()
    }

    pub fn update_task(&mut self, input: UpdateTaskInput) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;
        let task_id = parse_task_id(&input.id, "id")?;
        let task_index = self.find_task_index(task_id)?;
        let fields = validate_task_fields(
            &input.title,
            &input.notes,
            input.scheduled_date.as_deref(),
            input.estimate_minutes,
        )?;
        let source_bucket = self.tasks[task_index].scheduled_date;
        let destination_bucket = fields.scheduled_date;

        if source_bucket != destination_bucket {
            let destination_sort_order =
                next_sort_order(&self.tasks, destination_bucket, &[task_id])?;
            self.tasks[task_index].sort_order = destination_sort_order;
        }

        let task = &mut self.tasks[task_index];
        task.title = fields.title;
        task.notes = fields.notes;
        task.scheduled_date = fields.scheduled_date;
        task.estimate_minutes = fields.estimate_minutes;
        task.is_done = input.is_done;

        if source_bucket != destination_bucket {
            reindex_bucket(&mut self.tasks, source_bucket)?;
            reindex_bucket(&mut self.tasks, destination_bucket)?;
        }

        self.commit()
    }

    pub fn delete_task(&mut self, task_id: &str) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;
        let task_id = parse_task_id(task_id, "taskId")?;
        let task_index = self.find_task_index(task_id)?;
        let source_bucket = self.tasks[task_index].scheduled_date;

        self.tasks.remove(task_index);
        reindex_bucket(&mut self.tasks, source_bucket)?;
        self.commit()
    }

    pub fn toggle_task(&mut self, task_id: &str) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;
        let task_id = parse_task_id(task_id, "taskId")?;
        let task_index = self.find_task_index(task_id)?;
        self.tasks[task_index].is_done = !self.tasks[task_index].is_done;
        self.commit()
    }

    pub fn move_tasks(&mut self, input: MoveTasksInput) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;
        let source_bucket = parse_bucket(&input.source, "source.scheduledDate")?;
        let destination_bucket = parse_bucket(&input.destination, "destination.scheduledDate")?;
        let task_ids = parse_move_task_ids(&input.task_ids)?;

        if source_bucket == destination_bucket {
            self.reorder_same_bucket(&task_ids, source_bucket)?;
        } else {
            if task_ids.is_empty() {
                return Err(AppError::validation(
                    "At least one task must be moved.",
                    "taskIds",
                ));
            }
            self.move_between_buckets(&task_ids, source_bucket, destination_bucket)?;
        }

        self.commit()
    }

    pub fn update_settings(&mut self, patch: FocusSettingsPatch) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;
        self.settings.apply_patch(patch);
        self.commit()
    }

    pub fn record_session(&mut self, session: FocusSession) -> DomainResult<AppSnapshot> {
        self.ensure_revision_available()?;
        session.validate()?;

        if self.sessions.iter().any(|item| item.id == session.id) {
            return Err(AppError::conflict(
                "A focus session with this id already exists.",
                "id",
            ));
        }

        if let Some(task_id) = session.task_id {
            let task_index = self.find_task_index(task_id)?;
            self.tasks[task_index].focused_seconds = self.tasks[task_index]
                .focused_seconds
                .saturating_add(session.focused_seconds);
        }

        self.sessions.push(session);
        self.commit()
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

    fn with_payload(
        payload: PersistedPayload,
        repository: Option<Repository>,
        recovery_diagnostic: Option<RecoveryDiagnostic>,
    ) -> Self {
        let confirmed_payload = payload.clone();

        Self {
            revision: 0,
            tasks: payload.tasks,
            sessions: payload.sessions,
            settings: payload.settings,
            focus: FocusSnapshot::default(),
            shortcut_status: ShortcutStatus::default(),
            repository,
            confirmed_payload,
            recovery_diagnostic,
        }
    }

    fn reorder_same_bucket(
        &mut self,
        task_ids: &[Uuid],
        scheduled_date: Option<NaiveDate>,
    ) -> DomainResult<()> {
        let bucket_ids = self
            .tasks
            .iter()
            .filter(|task| task.scheduled_date == scheduled_date)
            .map(|task| task.id)
            .collect::<Vec<_>>();

        let mut seen = HashSet::with_capacity(task_ids.len());
        for task_id in task_ids {
            if !seen.insert(*task_id) {
                return Err(AppError::conflict(
                    "A reorder must not contain duplicate task ids.",
                    "taskIds",
                ));
            }
        }

        if task_ids
            .iter()
            .any(|task_id| !self.tasks.iter().any(|task| task.id == *task_id))
        {
            return Err(AppError::not_found("The task was not found.", "taskIds"));
        }

        if task_ids.len() != bucket_ids.len()
            || task_ids.iter().any(|task_id| !bucket_ids.contains(task_id))
        {
            return Err(AppError::conflict(
                "A reorder must include every task in the bucket exactly once.",
                "taskIds",
            ));
        }

        for (sort_order, task_id) in task_ids.iter().enumerate() {
            let sort_order = u32::try_from(sort_order)
                .map_err(|_| AppError::internal("The task bucket contains too many tasks."))?;
            let task = self
                .tasks
                .iter_mut()
                .find(|task| task.id == *task_id)
                .ok_or_else(|| AppError::not_found("The task was not found.", "taskIds"))?;
            task.sort_order = sort_order;
        }

        Ok(())
    }

    fn move_between_buckets(
        &mut self,
        task_ids: &[Uuid],
        source_bucket: Option<NaiveDate>,
        destination_bucket: Option<NaiveDate>,
    ) -> DomainResult<()> {
        let mut indices = Vec::with_capacity(task_ids.len());

        for task_id in task_ids {
            let Some((index, task)) = self
                .tasks
                .iter()
                .enumerate()
                .find(|(_, task)| task.id == *task_id)
            else {
                return Err(AppError::not_found("The task was not found.", "taskIds"));
            };

            if task.scheduled_date != source_bucket {
                return Err(AppError::conflict(
                    "All moved tasks must belong to the source bucket.",
                    "taskIds",
                ));
            }

            indices.push(index);
        }

        let destination_sort_order = next_sort_order(&self.tasks, destination_bucket, task_ids)?;
        for (offset, index) in indices.iter().enumerate() {
            let sort_order = destination_sort_order
                .checked_add(
                    u32::try_from(offset).map_err(|_| {
                        AppError::internal("The task bucket contains too many tasks.")
                    })?,
                )
                .ok_or_else(|| AppError::internal("The task bucket sort order is exhausted."))?;
            self.tasks[*index].scheduled_date = destination_bucket;
            self.tasks[*index].sort_order = sort_order;
        }

        reindex_bucket(&mut self.tasks, source_bucket)?;
        reindex_bucket(&mut self.tasks, destination_bucket)?;
        Ok(())
    }

    fn find_task_index(&self, task_id: Uuid) -> DomainResult<usize> {
        self.tasks
            .iter()
            .position(|task| task.id == task_id)
            .ok_or_else(|| AppError::not_found("The task was not found.", "taskId"))
    }

    fn ensure_revision_available(&self) -> DomainResult<()> {
        if self.revision == u64::MAX {
            return Err(AppError::internal("The application revision is exhausted."));
        }

        Ok(())
    }

    fn commit(&mut self) -> DomainResult<AppSnapshot> {
        let payload = self.current_payload();
        let persistence_error = match self.repository.as_mut() {
            Some(repository) => repository.save(&payload).err(),
            None => None,
        };

        if let Some(error) = persistence_error {
            self.restore_confirmed_payload();
            return Err(AppError::persistence(format!(
                "Unable to persist local data: {error}"
            )));
        }

        self.confirmed_payload = payload;
        self.revision += 1;
        Ok(self.snapshot())
    }

    fn current_payload(&self) -> PersistedPayload {
        PersistedPayload::from_parts(
            self.tasks.clone(),
            self.sessions.clone(),
            self.settings.clone(),
        )
    }

    fn restore_confirmed_payload(&mut self) {
        self.tasks = self.confirmed_payload.tasks.clone();
        self.sessions = self.confirmed_payload.sessions.clone();
        self.settings = self.confirmed_payload.settings.clone();
    }

    #[cfg(test)]
    pub(crate) fn fail_next_persistence_write(&mut self) {
        if let Some(repository) = self.repository.as_mut() {
            repository.fail_next_write();
        }
    }

    #[cfg(test)]
    pub(crate) fn fail_next_persistence_rename(&mut self) {
        if let Some(repository) = self.repository.as_mut() {
            repository.fail_next_rename();
        }
    }
}

fn parse_bucket(
    bucket: &crate::domain::TaskBucket,
    field: &str,
) -> DomainResult<Option<NaiveDate>> {
    parse_scheduled_date(bucket.scheduled_date.as_deref(), field)
}

fn parse_move_task_ids(values: &[String]) -> DomainResult<Vec<Uuid>> {
    let mut seen = HashSet::with_capacity(values.len());
    let mut ids = Vec::with_capacity(values.len());

    for value in values {
        let task_id = parse_task_id(value, "taskIds")?;
        if !seen.insert(task_id) {
            return Err(AppError::validation("Task ids must be unique.", "taskIds"));
        }
        ids.push(task_id);
    }

    Ok(ids)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use chrono::{DateTime, Duration, NaiveDate, Utc};

    use super::*;
    use crate::domain::session::FocusSession;
    use crate::domain::{AppErrorCode, FocusSettingsPatch, MoveTasksInput, TaskBucket};
    use crate::storage::Repository;

    struct TestDirectory {
        path: PathBuf,
    }

    impl TestDirectory {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("dailynotch-state-{}", Uuid::new_v4()));
            fs::create_dir_all(&path).expect("test directory should be created");
            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("test date should be valid")
    }

    fn timestamp(day: u32, hour: u32) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&format!("2026-08-{day:02}T{hour:02}:00:00Z"))
            .expect("test timestamp should be valid")
            .with_timezone(&Utc)
    }

    fn create_input(
        title: &str,
        scheduled_date: Option<&str>,
        estimate_minutes: i64,
    ) -> CreateTaskInput {
        CreateTaskInput {
            title: title.to_owned(),
            notes: String::new(),
            scheduled_date: scheduled_date.map(str::to_owned),
            estimate_minutes,
        }
    }

    fn update_input(
        id: Uuid,
        title: &str,
        scheduled_date: Option<&str>,
        estimate_minutes: i64,
        is_done: bool,
    ) -> UpdateTaskInput {
        UpdateTaskInput {
            id: id.to_string(),
            title: title.to_owned(),
            notes: String::new(),
            scheduled_date: scheduled_date.map(str::to_owned),
            estimate_minutes,
            is_done,
        }
    }

    fn add_task(
        state: &mut AppState,
        id: &str,
        title: &str,
        scheduled_date: Option<&str>,
        created_day: u32,
        created_hour: u32,
    ) -> Uuid {
        let id = Uuid::parse_str(id).expect("test UUID should be valid");
        state
            .add_task_at(
                create_input(title, scheduled_date, 25),
                id,
                timestamp(created_day, created_hour),
            )
            .expect("test task should be added");
        id
    }

    #[test]
    fn empty_state_matches_the_typescript_snapshot_contract() {
        let snapshot = AppState::default().snapshot();
        let json = serde_json::to_value(snapshot).expect("snapshot should serialize");

        assert_eq!(json["revision"], 0);
        assert_eq!(json["tasks"], serde_json::json!([]));
        assert_eq!(json["sessions"], serde_json::json!([]));
        assert_eq!(json["settings"]["focusMinutes"], 25);
        assert_eq!(json["focus"]["state"], "idle");
        assert_eq!(json["focus"]["activeTaskId"], serde_json::Value::Null);
        assert_eq!(json["shortcutStatus"], "unavailable");
    }

    #[test]
    fn task_crud_increments_revision_only_after_success() {
        let mut state = AppState::default();
        let task_id = add_task(
            &mut state,
            "11111111-1111-4111-8111-111111111111",
            "  First task  ",
            Some("2026-08-31"),
            31,
            8,
        );

        assert_eq!(state.snapshot().revision, 1);
        assert_eq!(state.snapshot().tasks[0].title, "First task");

        state
            .update_task(update_input(
                task_id,
                "Updated task",
                Some("2026-09-01"),
                200,
                true,
            ))
            .expect("existing task should update");
        assert_eq!(state.snapshot().revision, 2);
        assert_eq!(
            state.snapshot().tasks[0].scheduled_date,
            Some(date(2026, 9, 1))
        );
        assert_eq!(state.snapshot().tasks[0].estimate_minutes, 180);

        state
            .toggle_task(&task_id.to_string())
            .expect("existing task should toggle");
        assert!(!state.snapshot().tasks[0].is_done);

        let before_missing_delete = state.snapshot();
        let error = state
            .delete_task("not-a-uuid")
            .expect_err("invalid task id should fail");
        assert_eq!(error.code, AppErrorCode::Validation);
        assert_eq!(state.snapshot(), before_missing_delete);

        state
            .delete_task(&task_id.to_string())
            .expect("existing task should delete");
        assert!(state.snapshot().tasks.is_empty());

        let error = state
            .delete_task(&task_id.to_string())
            .expect_err("deleted task should not be found");
        assert_eq!(error.code, AppErrorCode::NotFound);
        assert_eq!(state.revision(), 4);
    }

    #[test]
    fn task_validation_rejects_invalid_text_and_dates_without_mutating_state() {
        let mut state = AppState::default();
        let before = state.snapshot();

        let error = state
            .add_task(create_input("   ", None, 25))
            .expect_err("blank title should fail");
        assert_eq!(error.field.as_deref(), Some("title"));
        assert_eq!(state.snapshot(), before);

        let error = state
            .add_task(create_input("Task", Some("2026-02-30"), 25))
            .expect_err("invalid date should fail");
        assert_eq!(error.field.as_deref(), Some("scheduledDate"));
        assert_eq!(state.snapshot(), before);

        let error = state
            .add_task(create_input(&"x".repeat(151), None, 25))
            .expect_err("long title should fail");
        assert_eq!(error.code, AppErrorCode::Validation);
        assert_eq!(state.snapshot(), before);
    }

    #[test]
    fn task_durations_are_clamped_on_create_and_settings_update() {
        let mut state = AppState::default();
        let task_id = add_task(
            &mut state,
            "22222222-2222-4222-8222-222222222222",
            "Clamped task",
            None,
            31,
            9,
        );
        let snapshot = state
            .update_task(update_input(task_id, "Clamped task", None, -20, false))
            .expect("negative estimate should be clamped");
        assert_eq!(snapshot.tasks[0].estimate_minutes, 1);

        let snapshot = state
            .update_settings(FocusSettingsPatch {
                focus_minutes: Some(0),
                ..FocusSettingsPatch::default()
            })
            .expect("settings patch should succeed");
        assert_eq!(snapshot.settings.focus_minutes, 1);
    }

    #[test]
    fn task_queries_keep_day_and_unscheduled_buckets_separate() {
        let mut state = AppState::default();
        let day_id = add_task(
            &mut state,
            "33333333-3333-4333-8333-333333333333",
            "Day task",
            Some("2026-08-31"),
            31,
            10,
        );
        let unscheduled_id = add_task(
            &mut state,
            "44444444-4444-4444-8444-444444444444",
            "Unscheduled task",
            None,
            31,
            11,
        );

        assert_eq!(
            state
                .tasks_for_date_string("2026-08-31")
                .expect("valid day should query")
                .iter()
                .map(|task| task.id)
                .collect::<Vec<_>>(),
            vec![day_id]
        );
        assert_eq!(
            state
                .tasks_without_date()
                .iter()
                .map(|task| task.id)
                .collect::<Vec<_>>(),
            vec![unscheduled_id]
        );
    }

    #[test]
    fn sorting_puts_incomplete_tasks_first_then_uses_sort_order_and_creation_time() {
        let mut state = AppState::default();
        let first_id = add_task(
            &mut state,
            "55555555-5555-4555-8555-555555555555",
            "First",
            Some("2026-08-31"),
            31,
            12,
        );
        let second_id = add_task(
            &mut state,
            "66666666-6666-4666-8666-666666666666",
            "Second",
            Some("2026-08-31"),
            31,
            13,
        );
        let third_id = add_task(
            &mut state,
            "77777777-7777-4777-8777-777777777777",
            "Third",
            Some("2026-08-31"),
            31,
            14,
        );
        state
            .update_task(update_input(
                second_id,
                "Second",
                Some("2026-08-31"),
                25,
                true,
            ))
            .expect("task should be completable");

        let ids = state
            .tasks_for_date(date(2026, 8, 31))
            .iter()
            .map(|task| task.id)
            .collect::<Vec<_>>();
        assert_eq!(ids, vec![first_id, third_id, second_id]);
    }

    #[test]
    fn reorder_same_bucket_requires_a_complete_permutation_and_is_atomic() {
        let mut state = AppState::default();
        let first_id = add_task(
            &mut state,
            "88888888-8888-4888-8888-888888888888",
            "First",
            Some("2026-08-31"),
            31,
            15,
        );
        let second_id = add_task(
            &mut state,
            "99999999-9999-4999-8999-999999999999",
            "Second",
            Some("2026-08-31"),
            31,
            16,
        );
        let before_invalid = state.snapshot();

        let error = state
            .move_tasks(MoveTasksInput {
                task_ids: vec![first_id.to_string()],
                source: TaskBucket::for_date("2026-08-31"),
                destination: TaskBucket::for_date("2026-08-31"),
            })
            .expect_err("partial same-bucket reorder should fail");
        assert_eq!(error.code, AppErrorCode::Conflict);
        assert_eq!(state.snapshot(), before_invalid);

        let snapshot = state
            .move_tasks(MoveTasksInput {
                task_ids: vec![second_id.to_string(), first_id.to_string()],
                source: TaskBucket::for_date("2026-08-31"),
                destination: TaskBucket::for_date("2026-08-31"),
            })
            .expect("complete permutation should reorder");
        let tasks = snapshot
            .tasks
            .iter()
            .filter(|task| task.scheduled_date == Some(date(2026, 8, 31)))
            .collect::<Vec<_>>();
        assert_eq!(tasks[0].id, second_id);
        assert_eq!(tasks[0].sort_order, 0);
        assert_eq!(tasks[1].id, first_id);
        assert_eq!(tasks[1].sort_order, 1);
    }

    #[test]
    fn moving_between_buckets_updates_only_source_and_destination_orders() {
        let mut state = AppState::default();
        let source_first = add_task(
            &mut state,
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "Source first",
            Some("2026-08-31"),
            31,
            17,
        );
        let source_second = add_task(
            &mut state,
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            "Source second",
            Some("2026-08-31"),
            31,
            18,
        );
        let destination = add_task(
            &mut state,
            "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            "Destination",
            Some("2026-09-01"),
            31,
            19,
        );

        let snapshot = state
            .move_tasks(MoveTasksInput {
                task_ids: vec![source_second.to_string()],
                source: TaskBucket::for_date("2026-08-31"),
                destination: TaskBucket::for_date("2026-09-01"),
            })
            .expect("cross-bucket move should succeed");

        let source_tasks = snapshot
            .tasks
            .iter()
            .filter(|task| task.scheduled_date == Some(date(2026, 8, 31)))
            .collect::<Vec<_>>();
        let destination_tasks = snapshot
            .tasks
            .iter()
            .filter(|task| task.scheduled_date == Some(date(2026, 9, 1)))
            .collect::<Vec<_>>();

        assert_eq!(source_tasks.len(), 1);
        assert_eq!(source_tasks[0].id, source_first);
        assert_eq!(source_tasks[0].sort_order, 0);
        assert_eq!(destination_tasks[0].id, destination);
        assert_eq!(destination_tasks[0].sort_order, 0);
        assert_eq!(destination_tasks[1].id, source_second);
        assert_eq!(destination_tasks[1].sort_order, 1);
    }

    #[test]
    fn recording_completed_and_aborted_sessions_adds_focused_seconds_directly() {
        let mut state = AppState::default();
        let task_id = add_task(
            &mut state,
            "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            "Focus task",
            None,
            31,
            20,
        );
        let started_at = timestamp(31, 21);

        state
            .record_session(FocusSession {
                id: Uuid::new_v4(),
                task_id: Some(task_id),
                started_at,
                ended_at: started_at + Duration::hours(3),
                focused_seconds: 25,
                completed: true,
            })
            .expect("completed session should record");
        state
            .record_session(FocusSession {
                id: Uuid::new_v4(),
                task_id: Some(task_id),
                started_at: started_at + Duration::hours(4),
                ended_at: started_at + Duration::hours(7),
                focused_seconds: 7,
                completed: false,
            })
            .expect("aborted session should record");

        assert_eq!(state.focused_seconds_for_task(task_id), 32);
        assert_eq!(state.snapshot().tasks[0].focused_seconds, 32);
    }

    #[test]
    fn structured_errors_serialize_with_code_message_and_optional_field() {
        let error = AppError::validation("The title is required.", "title");
        let json = serde_json::to_value(error).expect("error should serialize");

        assert_eq!(json["code"], "validation");
        assert_eq!(json["message"], "The title is required.");
        assert_eq!(json["field"], "title");
    }

    #[test]
    fn persisted_state_recovers_tasks_sessions_and_settings_after_reloading() {
        let test_directory = TestDirectory::new();
        let mut state = AppState::load(Repository::new(test_directory.path()))
            .expect("empty repository should load");
        let task_id = add_task(
            &mut state,
            "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            "Persisted task",
            Some("2026-08-31"),
            31,
            22,
        );
        state
            .update_settings(FocusSettingsPatch {
                focus_minutes: Some(50),
                minimal_mode: Some(true),
                ..FocusSettingsPatch::default()
            })
            .expect("settings should persist");
        let started_at = timestamp(31, 23);
        state
            .record_session(FocusSession {
                id: Uuid::parse_str("ffffffff-ffff-4fff-8fff-ffffffffffff")
                    .expect("test UUID should be valid"),
                task_id: Some(task_id),
                started_at,
                ended_at: started_at + Duration::minutes(25),
                focused_seconds: 1_500,
                completed: true,
            })
            .expect("session should persist");

        let reloaded = AppState::load(Repository::new(test_directory.path()))
            .expect("persisted repository should reload");
        let snapshot = reloaded.snapshot();

        assert_eq!(snapshot.revision, 0);
        assert_eq!(snapshot.tasks.len(), 1);
        assert_eq!(snapshot.tasks[0].id, task_id);
        assert_eq!(snapshot.tasks[0].focused_seconds, 1_500);
        assert_eq!(snapshot.sessions.len(), 1);
        assert_eq!(snapshot.sessions[0].focused_seconds, 1_500);
        assert_eq!(snapshot.settings.focus_minutes, 50);
        assert!(snapshot.settings.minimal_mode);
        assert_eq!(snapshot.focus, FocusSnapshot::default());
    }

    #[test]
    fn persistence_write_failure_restores_state_without_revision_increment() {
        let test_directory = TestDirectory::new();
        let mut state = AppState::load(Repository::new(test_directory.path()))
            .expect("empty repository should load");
        add_task(
            &mut state,
            "12121212-1212-4121-8121-121212121212",
            "Confirmed task",
            None,
            31,
            8,
        );
        let before = state.snapshot();
        let original_bytes = fs::read(test_directory.path().join("dailynotch.json"))
            .expect("confirmed JSON should be readable");
        state.fail_next_persistence_write();

        let error = state
            .update_settings(FocusSettingsPatch {
                focus_minutes: Some(50),
                ..FocusSettingsPatch::default()
            })
            .expect_err("simulated persistence failure should be returned");

        assert_eq!(error.code, AppErrorCode::Persistence);
        assert_eq!(state.snapshot(), before);
        assert_eq!(state.revision(), before.revision);
        assert_eq!(
            fs::read(test_directory.path().join("dailynotch.json"))
                .expect("confirmed JSON should remain readable"),
            original_bytes
        );
    }

    #[test]
    fn persistence_rename_failure_restores_state_without_revision_increment() {
        let test_directory = TestDirectory::new();
        let mut state = AppState::load(Repository::new(test_directory.path()))
            .expect("empty repository should load");
        add_task(
            &mut state,
            "13131313-1313-4131-8131-131313131313",
            "Confirmed task",
            None,
            31,
            8,
        );
        let before = state.snapshot();
        state.fail_next_persistence_rename();

        let error = state
            .update_settings(FocusSettingsPatch {
                minimal_mode: Some(true),
                ..FocusSettingsPatch::default()
            })
            .expect_err("simulated rename failure should be returned");

        assert_eq!(error.code, AppErrorCode::Persistence);
        assert_eq!(state.snapshot(), before);
        assert_eq!(state.revision(), before.revision);
    }
}
