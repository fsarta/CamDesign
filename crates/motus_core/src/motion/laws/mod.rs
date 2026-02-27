pub mod vdi2143;

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MotionLaw {
    Dwell,
    ConstantVelocity,
    UniformAcceleration { a: f64 },
    ModifiedSine,
    ModifiedTrapezoid,
    Cycloidal,
    Polynomial345,
    // Add other laws here later
}

pub struct MotionEvaluation {
    pub s: f64,
    pub v: f64,
    pub a: f64,
    pub j: f64,
}

pub trait MotionEvaluator {
    /// Evaluates the motion law at a normalized time tau [0, 1]
    /// Returns (s, v, a, j) normalized.
    /// To get actual values, use:
    /// s_actual = s * h
    /// v_actual = v * (h / beta)
    /// a_actual = a * (h / beta^2)
    /// j_actual = j * (h / beta^3)
    fn evaluate_normalized(&self, tau: f64) -> MotionEvaluation;
}

impl MotionEvaluator for MotionLaw {
    fn evaluate_normalized(&self, tau: f64) -> MotionEvaluation {
        // clamp tau just in case
        let tau = tau.clamp(0.0, 1.0);
        
        match self {
            MotionLaw::Dwell => vdi2143::dwell(tau),
            MotionLaw::ConstantVelocity => vdi2143::constant_velocity(tau),
            MotionLaw::Cycloidal => vdi2143::cycloidal(tau),
            MotionLaw::Polynomial345 => vdi2143::polynomial_345(tau),
            MotionLaw::ModifiedSine => vdi2143::modified_sine(tau),
            MotionLaw::ModifiedTrapezoid => vdi2143::modified_trapezoid(tau),
            MotionLaw::UniformAcceleration { a } => {
                // uniform acc is not a standard VDI basic rise, but useful.
                // Simple placeholder return
                MotionEvaluation { s: 0.0, v: 0.0, a: *a, j: 0.0 }
            }
        }
    }
}
