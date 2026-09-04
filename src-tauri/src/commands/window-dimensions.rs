#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct WindowSize {
    pub(super) width: f64,
    pub(super) height: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct WindowDimensionContract {
    pub(super) preferred: WindowSize,
    pub(super) minimum: WindowSize,
    pub(super) maximum: WindowSize,
}

pub(super) const CONTENT_WINDOW_DIMENSIONS: WindowDimensionContract = WindowDimensionContract {
    preferred: WindowSize {
        width: 800.0,
        height: 550.0,
    },
    minimum: WindowSize {
        width: 760.0,
        height: 480.0,
    },
    maximum: WindowSize {
        width: 800.0,
        height: 550.0,
    },
};

pub(super) const TASKS_WINDOW_DIMENSIONS: WindowDimensionContract = CONTENT_WINDOW_DIMENSIONS;
pub(super) const SETTINGS_WINDOW_DIMENSIONS: WindowDimensionContract = CONTENT_WINDOW_DIMENSIONS;

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_dimensions_fit_limits(dimensions: WindowDimensionContract) {
        assert!(dimensions.minimum.width <= dimensions.preferred.width);
        assert!(dimensions.minimum.height <= dimensions.preferred.height);
        assert!(dimensions.preferred.width <= dimensions.maximum.width);
        assert!(dimensions.preferred.height <= dimensions.maximum.height);
    }

    #[test]
    fn tasks_dimensions_fit_inside_their_limits() {
        assert_dimensions_fit_limits(std::hint::black_box(TASKS_WINDOW_DIMENSIONS));
    }

    #[test]
    fn tasks_dimensions_match_the_frontend_contract() {
        let dimensions = std::hint::black_box(TASKS_WINDOW_DIMENSIONS);
        assert_eq!(
            dimensions,
            WindowDimensionContract {
                preferred: WindowSize {
                    width: 800.0,
                    height: 550.0,
                },
                minimum: WindowSize {
                    width: 760.0,
                    height: 480.0,
                },
                maximum: WindowSize {
                    width: 800.0,
                    height: 550.0,
                },
            }
        );
    }

    #[test]
    fn settings_dimensions_fit_inside_their_limits() {
        assert_dimensions_fit_limits(std::hint::black_box(SETTINGS_WINDOW_DIMENSIONS));
    }

    #[test]
    fn settings_dimensions_match_the_tasks_contract() {
        assert_eq!(
            std::hint::black_box(SETTINGS_WINDOW_DIMENSIONS),
            std::hint::black_box(TASKS_WINDOW_DIMENSIONS)
        );
    }
}
