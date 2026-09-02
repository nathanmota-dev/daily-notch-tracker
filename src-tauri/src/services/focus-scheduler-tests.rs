use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use std::time::{Duration as StdDuration, Instant};

use chrono::{Duration, Utc};

use super::*;

fn wait_for_callbacks(callbacks: &AtomicUsize, expected: usize) {
    let deadline = Instant::now() + StdDuration::from_secs(1);
    while callbacks.load(Ordering::Acquire) < expected && Instant::now() < deadline {
        std::thread::sleep(StdDuration::from_millis(5));
    }
}

#[test]
fn cancel_prevents_a_deadline_callback() {
    let scheduler = FocusScheduler::new();
    let callbacks = Arc::new(AtomicUsize::new(0));
    let callback_counter = Arc::clone(&callbacks);

    scheduler.schedule(Utc::now() + Duration::milliseconds(80), move || {
        callback_counter.fetch_add(1, Ordering::Release);
    });
    scheduler.cancel();
    std::thread::sleep(StdDuration::from_millis(140));

    assert_eq!(callbacks.load(Ordering::Acquire), 0);
}

#[test]
fn replacing_a_deadline_discards_the_previous_callback() {
    let scheduler = FocusScheduler::new();
    let callbacks = Arc::new(AtomicUsize::new(0));
    let first_callbacks = Arc::clone(&callbacks);
    scheduler.schedule(Utc::now() + Duration::milliseconds(80), move || {
        first_callbacks.fetch_add(1, Ordering::Release);
    });

    let second_callbacks = Arc::clone(&callbacks);
    scheduler.schedule(Utc::now() + Duration::milliseconds(180), move || {
        second_callbacks.fetch_add(1, Ordering::Release);
    });
    std::thread::sleep(StdDuration::from_millis(120));

    assert_eq!(callbacks.load(Ordering::Acquire), 0);
    wait_for_callbacks(&callbacks, 1);
    assert_eq!(callbacks.load(Ordering::Acquire), 1);
}

#[test]
fn scheduler_has_at_most_one_current_deadline() {
    let scheduler = FocusScheduler::new();

    scheduler.schedule(Utc::now() + Duration::milliseconds(120), || {});
    assert!(scheduler.is_scheduled());
    scheduler.schedule(Utc::now() + Duration::milliseconds(120), || {});
    assert!(scheduler.is_scheduled());
    scheduler.cancel();

    assert!(!scheduler.is_scheduled());
}
