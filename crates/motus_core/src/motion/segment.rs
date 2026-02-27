use serde::{Serialize, Deserialize};
use uuid::Uuid;
use std::collections::HashMap;
use super::laws::MotionLaw;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BCValue {
    Free,
    Fixed(f64),
    Continuous,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentBCs {
    pub start_velocity: BCValue,
    pub end_velocity: BCValue,
    pub start_acceleration: BCValue,
    pub end_acceleration: BCValue,
    pub start_jerk: BCValue,
    pub end_jerk: BCValue,
}

impl Default for SegmentBCs {
    fn default() -> Self {
        Self {
            start_velocity: BCValue::Fixed(0.0),
            end_velocity: BCValue::Fixed(0.0),
            start_acceleration: BCValue::Fixed(0.0),
            end_acceleration: BCValue::Fixed(0.0),
            start_jerk: BCValue::Free,
            end_jerk: BCValue::Free,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MotionSegment {
    pub id: Uuid,
    pub name: Option<String>,
    pub law: MotionLaw,
    pub phi_start: f64,
    pub phi_end: f64,
    pub stroke: f64,
    pub s_start: f64,
    pub boundary_conditions: SegmentBCs,
    // constraints: Vec<MotionConstraint>,
    pub color: Option<[u8; 3]>,
    pub metadata: HashMap<String, String>,
}

impl MotionSegment {
    pub fn duration(&self) -> f64 {
        self.phi_end - self.phi_start
    }
}
