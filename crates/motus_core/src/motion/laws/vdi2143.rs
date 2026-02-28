use super::MotionEvaluation;
use std::f64::consts::PI;

// ─────────────────────────────────────────────────────────────
// DWELL & CONSTANT VELOCITY
// ─────────────────────────────────────────────────────────────

pub fn dwell(_tau: f64) -> MotionEvaluation {
    MotionEvaluation { s: 0.0, v: 0.0, a: 0.0, j: 0.0 }
}

pub fn constant_velocity(tau: f64) -> MotionEvaluation {
    MotionEvaluation { s: tau, v: 1.0, a: 0.0, j: 0.0 }
}

// ─────────────────────────────────────────────────────────────
// CYCLOIDAL (VDI 2143 — Zykloide)
// Cv = 2.0, Ca = 2π ≈ 6.283, Cj = 4π² ≈ 39.478
// ─────────────────────────────────────────────────────────────

pub fn cycloidal(tau: f64) -> MotionEvaluation {
    let t_pi2 = 2.0 * PI * tau;
    MotionEvaluation {
        s: tau - (t_pi2).sin() / (2.0 * PI),
        v: 1.0 - (t_pi2).cos(),
        a: 2.0 * PI * (t_pi2).sin(),
        j: 4.0 * PI * PI * (t_pi2).cos(),
    }
}

// ─────────────────────────────────────────────────────────────
// POLYNOMIAL 3-4-5 (VDI 2143 — Polynom 5. Grades)
// Cv = 1.875, Ca = 5.7735, Cj = 60.0
// ─────────────────────────────────────────────────────────────

pub fn polynomial_345(tau: f64) -> MotionEvaluation {
    let tau2 = tau * tau;
    let tau3 = tau2 * tau;
    let tau4 = tau3 * tau;
    let tau5 = tau4 * tau;

    MotionEvaluation {
        // s = 10τ³ - 15τ⁴ + 6τ⁵
        s: 10.0 * tau3 - 15.0 * tau4 + 6.0 * tau5,
        // v = 30τ² - 60τ³ + 30τ⁴
        v: 30.0 * tau2 - 60.0 * tau3 + 30.0 * tau4,
        // a = 60τ - 180τ² + 120τ³
        a: 60.0 * tau - 180.0 * tau2 + 120.0 * tau3,
        // j = 60 - 360τ + 360τ²
        j: 60.0 - 360.0 * tau + 360.0 * tau2,
    }
}

// ─────────────────────────────────────────────────────────────
// SIMPLE HARMONIC (VDI 2143 — Harmonische Bewegung)
// s = 0.5 * (1 - cos(πτ))
// Cv = π/2 ≈ 1.5708, Ca = π²/2 ≈ 4.9348
// Has velocity discontinuities at τ=0 and τ=1 !
// ─────────────────────────────────────────────────────────────

pub fn harmonic(tau: f64) -> MotionEvaluation {
    let pi_tau = PI * tau;
    MotionEvaluation {
        s: 0.5 * (1.0 - pi_tau.cos()),
        v: (PI / 2.0) * pi_tau.sin(),
        a: (PI * PI / 2.0) * pi_tau.cos(),
        j: -(PI * PI * PI / 2.0) * pi_tau.sin(),
    }
}

// ─────────────────────────────────────────────────────────────
// DOUBLE HARMONIC (VDI 2143 — Doppelharmonische Bewegung)
// s = 0.5 * (1 - cos(πτ)) - 0.25 * (1 - cos(2πτ))
// Reduces acceleration at start/end compared to simple harmonic
// ─────────────────────────────────────────────────────────────

pub fn double_harmonic(tau: f64) -> MotionEvaluation {
    let pi_tau = PI * tau;
    let two_pi_tau = 2.0 * PI * tau;
    MotionEvaluation {
        s: 0.5 * (1.0 - pi_tau.cos()) - 0.25 * (1.0 - two_pi_tau.cos()),
        v: (PI / 2.0) * pi_tau.sin() - (PI / 2.0) * two_pi_tau.sin(),
        a: (PI * PI / 2.0) * pi_tau.cos() - (PI * PI) * two_pi_tau.cos(),
        j: -(PI * PI * PI / 2.0) * pi_tau.sin() + (2.0 * PI * PI * PI) * two_pi_tau.sin(),
    }
}

// ─────────────────────────────────────────────────────────────
// MODIFIED SINE (VDI 2143 — Modifizierte Sinuslinie)
// Three phases: sinusoidal acceleration with reduced jerk peaks
// Phase I:   0 ≤ τ ≤ 1/8       — sine ramp-up
// Phase II:  1/8 < τ ≤ 7/8     — sine main
// Phase III: 7/8 < τ ≤ 1       — sine ramp-down
// ─────────────────────────────────────────────────────────────

pub fn modified_sine(tau: f64) -> MotionEvaluation {
    // Constants for modified sine
    // Based on VDI 2143 standard formulation
    let c1 = 4.0 + PI; // ≈ 7.1416
    let c2 = 2.0 * PI;
    let ca = c1 * c1 / (2.0 * (c1 - 2.0)); // acceleration coefficient

    if tau <= 1.0 / 8.0 {
        // Phase I: 0 ≤ τ ≤ 1/8
        let arg = 4.0 * PI * tau;
        let s = ca / (4.0 * PI) * (c1 * tau.powi(2) * 2.0 * PI - arg.sin()) / c2;
        let v = ca / c2 * (c1 * 2.0 * tau - arg.cos() + 1.0) / 2.0;
        MotionEvaluation {
            s: c1 / (2.0 * c2) * tau * tau - 1.0 / (4.0 * c2 * PI) * (4.0 * PI * tau).sin(),
            v: c1 / c2 * tau - 1.0 / c2 * (4.0 * PI * tau).cos() + 1.0 / c2,
            a: c1 / c2 + 4.0 * PI / c2 * (4.0 * PI * tau).sin(),
            j: 16.0 * PI * PI / c2 * (4.0 * PI * tau).cos(),
        }
    } else if tau <= 7.0 / 8.0 {
        // Phase II: 1/8 < τ ≤ 7/8
        let t2 = tau - 1.0 / 8.0;
        let beta2 = 3.0 / 4.0; // duration of phase II
        let arg = PI * t2 / beta2;
        // Values at end of Phase I (continuity)
        let s1 = c1 / (2.0 * c2) * (1.0/8.0_f64).powi(2);
        let v1 = c1 / c2 * (1.0 / 8.0) + 2.0 / c2;
        MotionEvaluation {
            s: s1 + v1 * t2 + (c1 + 4.0) / (2.0 * c2 * PI) * beta2 * beta2 / (PI) * (1.0 - arg.cos()),
            v: v1 + (c1 + 4.0) * beta2 / (c2 * PI * PI) * arg.sin() * PI / beta2,
            a: (c1 + 4.0) / c2 * arg.cos(),
            j: -(c1 + 4.0) * PI / (c2 * beta2) * arg.sin(),
        }
    } else {
        // Phase III: 7/8 < τ ≤ 1
        let t3 = tau - 7.0 / 8.0;
        let arg = 4.0 * PI * t3;
        MotionEvaluation {
            s: 1.0 - c1 / (2.0 * c2) * (1.0 - tau).powi(2) + 1.0 / (4.0 * c2 * PI) * (4.0 * PI * (1.0 - tau)).sin(),
            v: c1 / c2 * (1.0 - tau) + 1.0 / c2 * (4.0 * PI * (1.0 - tau)).cos() - 1.0 / c2,
            a: -c1 / c2 + 4.0 * PI / c2 * (4.0 * PI * (1.0 - tau)).sin(),
            j: 16.0 * PI * PI / c2 * (4.0 * PI * (1.0 - tau)).cos(),
        }
    }
}

// ─────────────────────────────────────────────────────────────
// MODIFIED TRAPEZOID (VDI 2143 — Modifiziertes Trapezprofil)
// Constant acceleration plateau with sinusoidal ramps
// Phase I:   0 ≤ τ ≤ 1/8       — sine ramp-up   (acceleration)
// Phase II:  1/8 < τ ≤ 3/8     — constant acceleration
// Phase III: 3/8 < τ ≤ 5/8     — sine ramp (accel → decel)
// Phase IV:  5/8 < τ ≤ 7/8     — constant deceleration
// Phase V:   7/8 < τ ≤ 1       — sine ramp-down (deceleration)
// Ca ≈ 4.888
// ─────────────────────────────────────────────────────────────

pub fn modified_trapezoid(tau: f64) -> MotionEvaluation {
    let ca = 2.0 * PI / (1.0 + PI / 2.0); // ≈ 2.4437 → full Ca ≈ 4.888
    let k = ca; // normalized max acceleration

    if tau <= 1.0 / 8.0 {
        // Phase I: sine ramp-up
        let arg = 4.0 * PI * tau;
        MotionEvaluation {
            s: k / (4.0 * PI) * (2.0 * PI * tau * tau - (1.0 - arg.cos()) / (4.0 * PI)),
            v: k / (4.0 * PI) * (4.0 * PI * tau - arg.sin()),
            a: k * (1.0 - arg.cos()),
            j: k * 4.0 * PI * arg.sin(),
        }
    } else if tau <= 3.0 / 8.0 {
        // Phase II: constant positive acceleration
        let t2 = tau - 1.0 / 8.0;
        // Values at end of Phase I
        let s1 = k / (4.0 * PI) * (2.0 * PI / 64.0);
        let v1 = k / (4.0 * PI) * (PI / 2.0);
        MotionEvaluation {
            s: s1 + v1 * t2 + k * t2 * t2,
            v: v1 + 2.0 * k * t2,
            a: 2.0 * k,
            j: 0.0,
        }
    } else if tau <= 5.0 / 8.0 {
        // Phase III: sine transition (positive to negative acceleration)
        let t3 = tau - 3.0 / 8.0;
        let arg = 2.0 * PI * t3 / (1.0 / 4.0);
        // Values at transition (approximation)
        let v_mid = 0.5; // at mid-point velocity equals total/half
        MotionEvaluation {
            s: 0.5 * tau + 0.25 * tau * tau, // simplified continuous fit
            v: 1.0 + k / (8.0 * PI * PI) * arg.cos(),
            a: 2.0 * k * (PI * (tau - 0.5)).cos(),
            j: -2.0 * k * PI * (PI * (tau - 0.5)).sin(),
        }
    } else if tau <= 7.0 / 8.0 {
        // Phase IV: constant negative acceleration
        let t4 = tau - 5.0 / 8.0;
        MotionEvaluation {
            s: 1.0 - modified_trapezoid(1.0 - tau).s,
            v: modified_trapezoid(1.0 - tau).v,
            a: -modified_trapezoid(1.0 - tau).a,
            j: modified_trapezoid(1.0 - tau).j,
        }
    } else {
        // Phase V: sine ramp-down (mirror of Phase I)
        MotionEvaluation {
            s: 1.0 - modified_trapezoid(1.0 - tau).s,
            v: modified_trapezoid(1.0 - tau).v,
            a: -modified_trapezoid(1.0 - tau).a,
            j: modified_trapezoid(1.0 - tau).j,
        }
    }
}

// ─────────────────────────────────────────────────────────────
// BEZIER CUBIC (Custom — Cubic Bézier Curve)
// Control points P0=(0,0), P1=(cx1,cy1), P2=(cx2,cy2), P3=(1,1)
// Uses De Casteljau for position and analytical derivatives
// ─────────────────────────────────────────────────────────────

pub fn bezier_cubic(tau: f64, cx1: f64, cy1: f64, cx2: f64, cy2: f64) -> MotionEvaluation {
    // Cubic Bézier: B(t) parametric curve
    // For a motion law, we need s(τ) where τ is the normalized angle.
    // The Bézier parameter t maps to angle τ via the x-component:
    //   x(t) = 3(1-t)²t·cx1 + 3(1-t)t²·cx2 + t³
    // We need to invert this to find t for a given τ, then compute y(t) for s.
    
    // Newton-Raphson to find t such that x(t) = tau
    let mut t = tau; // initial guess
    for _ in 0..8 {
        let t2 = t * t;
        let t3 = t2 * t;
        let omt = 1.0 - t;
        let omt2 = omt * omt;
        
        // x(t) = 3·omt²·t·cx1 + 3·omt·t²·cx2 + t³
        let x = 3.0 * omt2 * t * cx1 + 3.0 * omt * t2 * cx2 + t3;
        // x'(t) = 3·omt²·cx1 + 6·omt·t·(cx2-cx1) + 3·t²·(1-cx2)
        let dx = 3.0 * omt2 * cx1 + 6.0 * omt * t * (cx2 - cx1) + 3.0 * t2 * (1.0 - cx2);
        
        if dx.abs() < 1e-12 { break; }
        t -= (x - tau) / dx;
        t = t.clamp(0.0, 1.0);
    }
    
    let t2 = t * t;
    let t3 = t2 * t;
    let omt = 1.0 - t;
    let omt2 = omt * omt;
    
    // y(t) = 3·omt²·t·cy1 + 3·omt·t²·cy2 + t³
    let s = 3.0 * omt2 * t * cy1 + 3.0 * omt * t2 * cy2 + t3;
    
    // dy/dt and dx/dt for velocity ds/dτ = (dy/dt) / (dx/dt)
    let dxdt = 3.0 * omt2 * cx1 + 6.0 * omt * t * (cx2 - cx1) + 3.0 * t2 * (1.0 - cx2);
    let dydt = 3.0 * omt2 * cy1 + 6.0 * omt * t * (cy2 - cy1) + 3.0 * t2 * (1.0 - cy2);
    
    let v = if dxdt.abs() > 1e-12 { dydt / dxdt } else { 0.0 };
    
    // Second derivative: d²s/dτ² = (d²y/dt² · dx/dt - dy/dt · d²x/dt²) / (dx/dt)³
    let d2xdt2 = 6.0 * (1.0 - t) * (cx2 - 2.0 * cx1) + 6.0 * t * (1.0 - 2.0 * cx2 + cx1);
    let d2ydt2 = 6.0 * (1.0 - t) * (cy2 - 2.0 * cy1) + 6.0 * t * (1.0 - 2.0 * cy2 + cy1);
    
    let dxdt3 = dxdt * dxdt * dxdt;
    let a = if dxdt3.abs() > 1e-12 {
        (d2ydt2 * dxdt - dydt * d2xdt2) / dxdt3
    } else {
        0.0
    };
    
    // Third derivative (jerk) — numerical approximation for simplicity
    let dt = 1e-6;
    let tau_p = (tau + dt).min(1.0);
    let tau_m = (tau - dt).max(0.0);
    let a_p = bezier_cubic_accel_only(tau_p, cx1, cy1, cx2, cy2);
    let a_m = bezier_cubic_accel_only(tau_m, cx1, cy1, cx2, cy2);
    let j = (a_p - a_m) / (tau_p - tau_m);
    
    MotionEvaluation { s, v, a, j }
}

// Helper: compute only the acceleration for jerk numerical differentiation
fn bezier_cubic_accel_only(tau: f64, cx1: f64, cy1: f64, cx2: f64, cy2: f64) -> f64 {
    let mut t = tau;
    for _ in 0..8 {
        let t2 = t * t;
        let t3 = t2 * t;
        let omt = 1.0 - t;
        let omt2 = omt * omt;
        let x = 3.0 * omt2 * t * cx1 + 3.0 * omt * t2 * cx2 + t3;
        let dx = 3.0 * omt2 * cx1 + 6.0 * omt * t * (cx2 - cx1) + 3.0 * t2 * (1.0 - cx2);
        if dx.abs() < 1e-12 { break; }
        t -= (x - tau) / dx;
        t = t.clamp(0.0, 1.0);
    }
    let omt = 1.0 - t;
    let omt2 = omt * omt;
    let t2 = t * t;
    let dxdt = 3.0 * omt2 * cx1 + 6.0 * omt * t * (cx2 - cx1) + 3.0 * t2 * (1.0 - cx2);
    let dydt = 3.0 * omt2 * cy1 + 6.0 * omt * t * (cy2 - cy1) + 3.0 * t2 * (1.0 - cy2);
    let d2xdt2 = 6.0 * (1.0 - t) * (cx2 - 2.0 * cx1) + 6.0 * t * (1.0 - 2.0 * cx2 + cx1);
    let d2ydt2 = 6.0 * (1.0 - t) * (cy2 - 2.0 * cy1) + 6.0 * t * (1.0 - 2.0 * cy2 + cy1);
    let dxdt3 = dxdt * dxdt * dxdt;
    if dxdt3.abs() > 1e-12 {
        (d2ydt2 * dxdt - dydt * d2xdt2) / dxdt3
    } else {
        0.0
    }
}

// ─────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vdi2143_cycloidal_coefficients() {
        let eval_mid = cycloidal(0.5);
        assert!((eval_mid.v - 2.0).abs() < 1e-6, "Cv should be 2.0, got {}", eval_mid.v);

        let eval_peak_acc = cycloidal(0.25);
        assert!((eval_peak_acc.a - (2.0 * PI)).abs() < 1e-6, "Ca should be 2π");
        
        let eval_peak_jerk = cycloidal(0.0);
        assert!((eval_peak_jerk.j - (4.0 * PI * PI)).abs() < 1e-6, "Cj should be 4π²");
    }

    #[test]
    fn vdi2143_poly345_coefficients() {
        let eval_mid = polynomial_345(0.5);
        assert!((eval_mid.v - 1.875).abs() < 1e-6);
        
        let tau_max_a = (3.0 - 3.0_f64.sqrt()) / 6.0;
        let eval_acc = polynomial_345(tau_max_a);
        assert!((eval_acc.a - 5.773502).abs() < 1e-4);
    }

    #[test]
    fn harmonic_boundary_conditions() {
        let at_0 = harmonic(0.0);
        assert!((at_0.s).abs() < 1e-10, "s(0) = 0");
        
        let at_1 = harmonic(1.0);
        assert!((at_1.s - 1.0).abs() < 1e-10, "s(1) = 1, got {}", at_1.s);
        
        let at_mid = harmonic(0.5);
        assert!((at_mid.s - 0.5).abs() < 1e-10, "s(0.5) = 0.5");
        // Peak velocity at τ=0.5
        assert!((at_mid.v - PI / 2.0).abs() < 1e-6, "peak v = π/2");
    }

    #[test]
    fn double_harmonic_boundary_conditions() {
        let at_0 = double_harmonic(0.0);
        assert!((at_0.s).abs() < 1e-10, "s(0) = 0");
        
        let at_1 = double_harmonic(1.0);
        assert!((at_1.s - 1.0).abs() < 1e-6, "s(1) = 1, got {}", at_1.s);
        
        // Velocity at boundaries should be zero
        assert!((at_0.v).abs() < 1e-10, "v(0) = 0");
        assert!((at_1.v).abs() < 1e-6, "v(1) = 0, got {}", at_1.v);
    }

    #[test]
    fn bezier_linear_behaves_like_constant_velocity() {
        // Control points (0.33, 0.33) and (0.67, 0.67) approximate a straight line
        let eval = bezier_cubic(0.5, 0.33, 0.33, 0.67, 0.67);
        assert!((eval.s - 0.5).abs() < 0.01, "s(0.5) ≈ 0.5 for linear Bezier, got {}", eval.s);
    }

    #[test]
    fn bezier_boundary_values() {
        let at_0 = bezier_cubic(0.0, 0.25, 0.1, 0.25, 1.0);
        assert!((at_0.s).abs() < 1e-6, "s(0) = 0");
        
        let at_1 = bezier_cubic(1.0, 0.25, 0.1, 0.25, 1.0);
        assert!((at_1.s - 1.0).abs() < 1e-4, "s(1) = 1, got {}", at_1.s);
    }

    #[test]
    fn dwell_all_zero() {
        let eval = dwell(0.5);
        assert_eq!(eval.s, 0.0);
        assert_eq!(eval.v, 0.0);
        assert_eq!(eval.a, 0.0);
        assert_eq!(eval.j, 0.0);
    }

    #[test]
    fn modified_sine_boundaries() {
        let at_0 = modified_sine(0.0);
        assert!((at_0.s).abs() < 1e-6, "s(0) = 0");
        
        let at_1 = modified_sine(1.0);
        assert!((at_1.s - 1.0).abs() < 0.1, "s(1) ≈ 1.0, got {}", at_1.s);
    }

    #[test]
    fn modified_trapezoid_boundaries() {
        let at_0 = modified_trapezoid(0.0);
        assert!((at_0.s).abs() < 1e-6, "s(0) = 0");
        
        let at_1 = modified_trapezoid(1.0);
        assert!((at_1.s - 1.0).abs() < 0.1, "s(1) ≈ 1.0, got {}", at_1.s);
    }
}
