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
}

fn parse_bucket(bucket: &TaskBucket, field: &str) -> DomainResult<Option<NaiveDate>> {
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
