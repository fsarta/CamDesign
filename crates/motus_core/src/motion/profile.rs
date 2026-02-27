use serde::{Serialize, Deserialize};
use uuid::Uuid;
use super::segment::MotionSegment;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MotionType {
    Rise,
    Fall,
    ReturnRise,
    Oscillating,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MotionProfile {
    pub id: Uuid,
    pub name: String,
    pub segments: Vec<MotionSegment>,
    pub total_stroke: f64,
    pub motion_type: MotionType,
    pub cycle_angle: f64,
    pub resolution: usize,
}

impl Default for MotionProfile {
    fn default() -> Self {
        Self {
            id: Uuid::now_v7(),
            name: "New Profile".into(),
            segments: vec![],
            total_stroke: 0.0,
            motion_type: MotionType::Rise,
            cycle_angle: std::f64::consts::TAU, // 2PI
            resolution: 3600,
        }
    }
}
