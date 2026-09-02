use tauri::{PhysicalPosition, PhysicalRect, PhysicalSize};

pub const TASKS_WINDOW_GAP: i32 = 8;

fn clamp_position(value: i64, minimum: i64, maximum: i64) -> i64 {
    if maximum < minimum {
        return minimum;
    }

    value.clamp(minimum, maximum)
}

/// Calculates a Tasks window position centered below the expanded overlay.
pub fn calculate_tasks_window_position(
    overlay_position: PhysicalPosition<i32>,
    overlay_size: PhysicalSize<u32>,
    tasks_size: PhysicalSize<u32>,
    work_area: Option<PhysicalRect<i32, u32>>,
) -> PhysicalPosition<i32> {
    let overlay_center_x = i64::from(overlay_position.x) + i64::from(overlay_size.width) / 2;
    let centered_x = overlay_center_x - i64::from(tasks_size.width) / 2;
    let below_y = i64::from(overlay_position.y)
        + i64::from(overlay_size.height)
        + i64::from(TASKS_WINDOW_GAP);

    let (x, y) = match work_area {
        Some(area) => {
            let area_x = i64::from(area.position.x);
            let area_y = i64::from(area.position.y);
            let max_x = area_x + i64::from(area.size.width) - i64::from(tasks_size.width);
            let max_y = area_y + i64::from(area.size.height) - i64::from(tasks_size.height);
            (
                clamp_position(centered_x, area_x, max_x),
                clamp_position(below_y, area_y, max_y),
            )
        }
        None => (centered_x, below_y),
    };

    PhysicalPosition::new(x as i32, y as i32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn centers_tasks_below_the_overlay() {
        let position = calculate_tasks_window_position(
            PhysicalPosition::new(100, 48),
            PhysicalSize::new(620, 206),
            PhysicalSize::new(800, 550),
            None,
        );

        assert_eq!(position, PhysicalPosition::new(10, 262));
    }

    #[test]
    fn keeps_tasks_inside_a_work_area() {
        let work_area = PhysicalRect {
            position: PhysicalPosition::new(-1920, 0),
            size: PhysicalSize::new(1920, 1080),
        };
        let position = calculate_tasks_window_position(
            PhysicalPosition::new(-1800, 850),
            PhysicalSize::new(620, 206),
            PhysicalSize::new(800, 550),
            Some(work_area),
        );

        assert_eq!(position, PhysicalPosition::new(-1890, 530));
    }

    #[test]
    fn anchors_an_oversized_tasks_window_to_the_work_area_origin() {
        let work_area = PhysicalRect {
            position: PhysicalPosition::new(40, 20),
            size: PhysicalSize::new(400, 300),
        };
        let position = calculate_tasks_window_position(
            PhysicalPosition::new(80, 80),
            PhysicalSize::new(200, 200),
            PhysicalSize::new(800, 550),
            Some(work_area),
        );

        assert_eq!(position, PhysicalPosition::new(40, 20));
    }
}
