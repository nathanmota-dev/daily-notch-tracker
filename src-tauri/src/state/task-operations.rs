use std::collections::HashSet;

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use super::AppState;
use crate::domain::task::{
    next_sort_order, parse_scheduled_date, parse_task_id, reindex_bucket, validate_task_fields,
};
use crate::domain::{
    AppError, AppSnapshot, CreateTaskInput, DomainResult, FocusSession, FocusSettingsPatch,
    MoveTasksInput, Task, TaskBucket, UpdateTaskInput,
};

impl AppState {
    pub fn add_task(&mut self, input: CreateTaskInput) -> DomainResult<AppSnapshot> {
        self.add_task_at(input, Uuid::new_v4(), Utc::now())
    }

    pub fn add_task_at(
        &mut self,
        input: CreateTaskInput,
        id: Uuid,
        created_at: DateTime<Utc>,
    ) -> DomainResult<AppSnapshot> {
        self.mutate(|state| {
            if state.tasks.iter().any(|task| task.id == id) {
                return Err(AppError::conflict(
                    "A task with this id already exists.",
                    "id",
                ));
            }
            let scheduled_date =
                parse_scheduled_date(input.scheduled_date.as_deref(), "scheduledDate")?;
            let sort_order = next_sort_order(&state.tasks, scheduled_date, &[])?;
            let task = Task::from_input(input, id, created_at, sort_order)?;

            state.tasks.push(task);
            reindex_bucket(&mut state.tasks, scheduled_date)?;
            Ok(())
        })
    }

    pub fn update_task(&mut self, input: UpdateTaskInput) -> DomainResult<AppSnapshot> {
        self.update_task_at(input, Utc::now())
    }

    pub(crate) fn update_task_at(
        &mut self,
        input: UpdateTaskInput,
        now: DateTime<Utc>,
    ) -> DomainResult<AppSnapshot> {
        self.mutate(|state| {
            let task_id = parse_task_id(&input.id, "id")?;
            let task_index = state.find_task_index(task_id)?;
            let fields = validate_task_fields(
                &input.title,
                &input.notes,
                input.scheduled_date.as_deref(),
                input.estimate_minutes,
            )?;
            let source_bucket = state.tasks[task_index].scheduled_date;
            let destination_bucket = fields.scheduled_date;
            let previous_is_done = state.tasks[task_index].is_done;

            let destination_sort_order = if source_bucket != destination_bucket {
                Some(next_sort_order(
                    &state.tasks,
                    destination_bucket,
                    &[task_id],
                )?)
            } else {
                None
            };

            let completes_active_task =
                input.is_done && state.focus.active_task_id == Some(task_id);
            if completes_active_task {
                state.finish_focus(now, true)?;
            }

            let task = &mut state.tasks[task_index];
            task.title = fields.title;
            task.notes = fields.notes;
            task.scheduled_date = fields.scheduled_date;
            task.estimate_minutes = fields.estimate_minutes;
            task.is_done = input.is_done;
            if let Some(sort_order) = destination_sort_order {
                task.sort_order = sort_order;
            }

            if source_bucket != destination_bucket {
                reindex_bucket(&mut state.tasks, source_bucket)?;
                reindex_bucket(&mut state.tasks, destination_bucket)?;
            } else if previous_is_done != input.is_done {
                reindex_bucket(&mut state.tasks, source_bucket)?;
            }

            if state.focus.active_task_id == Some(task_id) {
                state.focus.active_task_title = Some(state.tasks[task_index].title.clone());
            }

            Ok(())
        })
    }

    pub fn delete_task(&mut self, task_id: &str) -> DomainResult<AppSnapshot> {
        self.delete_task_at(task_id, Utc::now())
    }

    pub(crate) fn delete_task_at(
        &mut self,
        task_id: &str,
        now: DateTime<Utc>,
    ) -> DomainResult<AppSnapshot> {
        self.mutate_task(task_id, |state, task_id, task_index, source_bucket| {
            state.tasks.remove(task_index);
            reindex_bucket(&mut state.tasks, source_bucket)?;
            if state.focus.active_task_id == Some(task_id) {
                state.finish_focus(now, false)?;
            }
            Ok(())
        })
    }

    pub fn toggle_task(&mut self, task_id: &str) -> DomainResult<AppSnapshot> {
        self.toggle_task_at(task_id, Utc::now())
    }

    pub(crate) fn toggle_task_at(
        &mut self,
        task_id: &str,
        now: DateTime<Utc>,
    ) -> DomainResult<AppSnapshot> {
        self.mutate_task(task_id, |state, task_id, task_index, source_bucket| {
            let completes_active_task =
                !state.tasks[task_index].is_done && state.focus.active_task_id == Some(task_id);
            if completes_active_task {
                state.finish_focus(now, true)?;
            }

            state.tasks[task_index].is_done = !state.tasks[task_index].is_done;
            reindex_bucket(&mut state.tasks, source_bucket)?;
            Ok(())
        })
    }

    pub fn move_tasks(&mut self, input: MoveTasksInput) -> DomainResult<AppSnapshot> {
        self.mutate(|state| {
            let source_bucket = parse_bucket(&input.source, "source.scheduledDate")?;
            let destination_bucket = parse_bucket(&input.destination, "destination.scheduledDate")?;
            let task_ids = parse_move_task_ids(&input.task_ids)?;

            if source_bucket == destination_bucket {
                state.reorder_same_bucket(&task_ids, source_bucket)?;
            } else {
                state.move_between_buckets(&task_ids, source_bucket, destination_bucket)?;
            }

            Ok(())
        })
    }

    pub fn update_settings(&mut self, patch: FocusSettingsPatch) -> DomainResult<AppSnapshot> {
        self.mutate(|state| {
            state.settings.apply_patch(patch);
            Ok(())
        })
    }

    pub fn record_session(&mut self, session: FocusSession) -> DomainResult<AppSnapshot> {
        self.mutate(|state| state.insert_session(session))
    }

    pub(super) fn insert_session(&mut self, session: FocusSession) -> DomainResult<()> {
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
        Ok(())
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

    fn task_for_mutation(
        &self,
        task_id: &str,
        field: &str,
    ) -> DomainResult<(Uuid, usize, Option<NaiveDate>)> {
        let task_id = parse_task_id(task_id, field)?;
        let task_index = self.find_task_index(task_id)?;
        let source_bucket = self.tasks[task_index].scheduled_date;
        Ok((task_id, task_index, source_bucket))
    }

    fn mutate_task<F>(&mut self, task_id: &str, operation: F) -> DomainResult<AppSnapshot>
    where
        F: FnOnce(&mut Self, Uuid, usize, Option<NaiveDate>) -> DomainResult<()>,
    {
        self.mutate(|state| {
            let (task_id, task_index, source_bucket) =
                state.task_for_mutation(task_id, "taskId")?;
            operation(state, task_id, task_index, source_bucket)
        })
    }
}

fn parse_bucket(bucket: &TaskBucket, field: &str) -> DomainResult<Option<NaiveDate>> {
    parse_scheduled_date(bucket.scheduled_date.as_deref(), field)
}

fn parse_move_task_ids(values: &[String]) -> DomainResult<Vec<Uuid>> {
    if values.is_empty() {
        return Err(AppError::validation(
            "At least one task must be moved.",
            "taskIds",
        ));
    }

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
