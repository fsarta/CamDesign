use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub mod calculation;
pub mod dynamics;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RotationDirection {
    Clockwise,
    CounterClockwise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CamType {
    Disc { thickness: f64 },
    Cylindrical { length: f64, groove_width: f64 },
    Linear { length: f64, thickness: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FollowerGeometry {
    Roller { radius: f64, length: f64 },
    FlatFace { width: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CamMaterial {
    pub name: String,
    pub modulus_of_elasticity: f64,
    pub poisson_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CamDefinition {
    pub id: Uuid,
    pub cam_type: CamType,
    pub follower: FollowerGeometry,
    pub base_radius: f64,
    pub follower_offset: f64,
    pub rotation_direction: RotationDirection,
    pub motion_profile_id: Uuid,
    pub material: CamMaterial,
}
