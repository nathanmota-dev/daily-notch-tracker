use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration as StdDuration;

use chrono::{DateTime, Utc};

#[derive(Debug, Default)]
struct SchedulerState {
    next_generation: u64,
    current: Option<ScheduledFocus>,
}

#[derive(Debug)]
struct ScheduledFocus {
    generation: u64,
    cancel_sender: mpsc::Sender<()>,
}

/// Runs at most one callback, cancelling the previous deadline when replaced.
#[derive(Debug)]
pub struct FocusScheduler {
    state: Arc<Mutex<SchedulerState>>,
}

impl Default for FocusScheduler {
    fn default() -> Self {
        Self::new()
    }
}

impl FocusScheduler {
    /// Creates an idle scheduler.
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(SchedulerState::default())),
        }
    }

    /// Replaces the current deadline with one callback for `end_at`.
    pub fn schedule<F>(&self, end_at: DateTime<Utc>, callback: F)
    where
        F: FnOnce() + Send + 'static,
    {
        let (cancel_sender, cancel_receiver) = mpsc::channel();
        let (generation, state) = {
            let mut scheduler_state = lock_state(&self.state);
            if let Some(previous) = scheduler_state.current.take() {
                let _ = previous.cancel_sender.send(());
            }

            let generation = scheduler_state.next_generation;
            scheduler_state.next_generation = scheduler_state.next_generation.wrapping_add(1);
            scheduler_state.current = Some(ScheduledFocus {
                generation,
                cancel_sender,
            });
            (generation, Arc::clone(&self.state))
        };

        thread::spawn(move || {
            if !wait_until_deadline(&cancel_receiver, end_at) {
                return;
            }

            let should_run = {
                let mut scheduler_state = lock_state(&state);
                let is_current = scheduler_state
                    .current
                    .as_ref()
                    .is_some_and(|scheduled| scheduled.generation == generation);
                if is_current {
                    scheduler_state.current.take();
                }
                is_current
            };

            if should_run {
                callback();
            }
        });
    }

    /// Cancels the current callback, if any.
    pub fn cancel(&self) {
        let mut scheduler_state = lock_state(&self.state);
        if let Some(current) = scheduler_state.current.take() {
            let _ = current.cancel_sender.send(());
        }
    }

    /// Returns whether a callback is currently waiting for a deadline.
    pub fn is_scheduled(&self) -> bool {
        lock_state(&self.state).current.is_some()
    }
}

impl Drop for FocusScheduler {
    fn drop(&mut self) {
        self.cancel();
    }
}

fn lock_state(state: &Mutex<SchedulerState>) -> std::sync::MutexGuard<'_, SchedulerState> {
    state
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn wait_until_deadline(receiver: &mpsc::Receiver<()>, end_at: DateTime<Utc>) -> bool {
    loop {
        let now = Utc::now();
        if now >= end_at {
            return true;
        }

        let wait_for = end_at
            .signed_duration_since(now)
            .to_std()
            .unwrap_or(StdDuration::ZERO);
        match receiver.recv_timeout(wait_for) {
            Ok(()) | Err(mpsc::RecvTimeoutError::Disconnected) => return false,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }
    }
}

#[cfg(test)]
#[path = "focus-scheduler-tests.rs"]
mod tests;
