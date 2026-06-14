pub mod vdi2143;
pub mod spline;

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
    /// Polynomial 4-5-6-7 (7th degree): guarantees j=0 at boundaries
    Polynomial4567,
    Harmonic,
    DoubleHarmonic,
    /// Cubic Bézier: control points P0=(0,0), P1=(cx1,cy1), P2=(cx2,cy2), P3=(1,1)
    Bezier { cx1: f64, cy1: f64, cx2: f64, cy2: f64 },
    /// Custom Numeric Spline from points (x, y)
    NumericSpline { points: Vec<(f64, f64)> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
            MotionLaw::Polynomial4567 => vdi2143::polynomial_4567(tau),
            MotionLaw::ModifiedSine => vdi2143::modified_sine(tau),
            MotionLaw::ModifiedTrapezoid => vdi2143::modified_trapezoid(tau),
            MotionLaw::Harmonic => vdi2143::harmonic(tau),
            MotionLaw::DoubleHarmonic => vdi2143::double_harmonic(tau),
            MotionLaw::Bezier { cx1, cy1, cx2, cy2 } => {
                vdi2143::bezier_cubic(tau, *cx1, *cy1, *cx2, *cy2)
            }
            MotionLaw::NumericSpline { points } => {
                // In production, caching the spline avoids recomputing the tridiagonal matrix on every tau.
                // But since evaluating points is generally fast, we'll build it here. 
                // For a heavily optimized version, MotionLaw could hold the compiled Spline.
                let spline = spline::CubicSpline::new(points.clone());
                spline.evaluate(tau)
            }
            MotionLaw::UniformAcceleration { a } => {
                // Uniform acceleration: s = ½·a·τ², v = a·τ
                MotionEvaluation {
                    s: 0.5 * a * tau * tau,
                    v: a * tau,
                    a: *a,
                    j: 0.0,
                }
            }
        }
    }
}
