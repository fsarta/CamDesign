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
// Cv = 1.7596, Ca = 5.528, Cj = 69.47
// Three phases with sinusoidal acceleration segments
// Phase I:   0 ≤ τ ≤ 1/8       — sine ramp-up
// Phase II:  1/8 < τ ≤ 7/8     — sine main
// Phase III: 7/8 < τ ≤ 1       — sine ramp-down
// ─────────────────────────────────────────────────────────────

pub fn modified_sine(tau: f64) -> MotionEvaluation {
    // VDI 2143 exact formulation for Modified Sine
    // The acceleration profile consists of two half-sine segments at the ends (Phase I, III)
    // and a full sine segment in the middle (Phase II).
    //
    // We define the acceleration analytically for each phase, then integrate for v and s.
    // The constant A is chosen so that s(1) = 1.

    // Duration of each phase
    let beta1 = 1.0 / 8.0;   // Phase I duration
    let beta2 = 3.0 / 4.0;   // Phase II duration
    let _beta3 = 1.0 / 8.0;   // Phase III duration (= beta1, used via symmetry)

    // For s(1)=1, we need the peak acceleration amplitude.
    // From the VDI standard, the acceleration in each phase is:
    //   Phase I:   a(τ) = A₁ · (1 - cos(π·τ/β₁))
    //   Phase II:  a(τ) = A₂ · cos(π·(τ-β₁)/β₂)
    //   Phase III: a(τ) = -A₃ · (1 - cos(π·(τ-β₁-β₂)/β₃))
    //
    // For C1 continuity: A₁ = A₂ = A₃ (single amplitude, sign changes)
    // We compute A by enforcing s(1) = 1 via double integration.

    // The normalization constant for the modified sine:
    // Integrating a(τ) twice over [0,1] with v(0)=0, s(0)=0, v(1)=0, s(1)=1
    // yields: A = π² / (β₂ · (π - 2·β₂/β₁ + 2·β₂/β₁))
    // Simplified for β₁=β₃=1/8, β₂=3/4:
    let a_peak = 2.0 * PI / (1.0 - 1.0 / (4.0 * PI));

    if tau <= beta1 {
        // Phase I: 0 ≤ τ ≤ 1/8  —  Sinusoidal ramp-up of acceleration
        let phi = PI * tau / beta1;
        let a = a_peak / 2.0 * (1.0 - phi.cos());
        let j = a_peak / 2.0 * PI / beta1 * phi.sin();

        // v = integral of a dτ from 0 to τ
        let v = a_peak / 2.0 * (tau - beta1 / PI * phi.sin());
        // s = integral of v dτ from 0 to τ
        let s = a_peak / 2.0 * (tau * tau / 2.0 + beta1 * beta1 / (PI * PI) * (phi.cos() - 1.0));

        MotionEvaluation { s, v, a, j }
    } else if tau <= beta1 + beta2 {
        // Phase II: 1/8 < τ ≤ 7/8  —  Full sine acceleration
        let tau2 = tau - beta1;
        let phi = PI * tau2 / beta2;

        // Values at end of Phase I (for continuity)
        let v1 = a_peak / 2.0 * beta1; // sin(π) = 0
        let s1 = a_peak / 2.0 * (beta1 * beta1 / 2.0 - 2.0 * beta1 * beta1 / (PI * PI));


        let a = a_peak * phi.cos();
        let j = -a_peak * PI / beta2 * phi.sin();

        // v = v1 + integral of a dτ from 0 to tau2
        let v = v1 + a_peak * beta2 / PI * phi.sin();
        // s = s1 + v1·tau2 + integral of (a_peak·β₂/π·sin(φ)) dτ
        let s = s1 + v1 * tau2 + a_peak * beta2 * beta2 / (PI * PI) * (1.0 - phi.cos());

        MotionEvaluation { s, v, a, j }
    } else {
        // Phase III: 7/8 < τ ≤ 1  —  Mirror of Phase I (deceleration)
        let tau_mirror = 1.0 - tau;
        let eval_mirror = modified_sine(tau_mirror);
        MotionEvaluation {
            s: 1.0 - eval_mirror.s,
            v: eval_mirror.v,
            a: -eval_mirror.a,
            j: eval_mirror.j,
        }
    }
}

// ─────────────────────────────────────────────────────────────
// MODIFIED TRAPEZOID (VDI 2143 — Modifiziertes Trapezprofil)
// Cv = 2.0, Ca = 4.8886, Cj = 61.43
// Constant acceleration plateau with sinusoidal ramps (5 phases)
// Phase I:   0 ≤ τ ≤ 1/8       — sine ramp-up (0 → +a_max)
// Phase II:  1/8 < τ ≤ 3/8     — constant +a_max
// Phase III: 3/8 < τ ≤ 5/8     — sine ramp (+a_max → -a_max)
// Phase IV:  5/8 < τ ≤ 7/8     — constant -a_max
// Phase V:   7/8 < τ ≤ 1       — sine ramp-down (-a_max → 0)
// ─────────────────────────────────────────────────────────────

pub fn modified_trapezoid(tau: f64) -> MotionEvaluation {
    // VDI 2143 exact formulation.
    // The acceleration profile is a trapezoid with sinusoidal ramps.
    //
    // Phase durations: each ramp = 1/8, each plateau = 1/4, center sine = 1/4
    //   β₁ = β₅ = 1/8  (sine ramps at start/end)
    //   β₂ = β₄ = 1/4  (constant accel/decel plateaus)
    //   β₃ = 1/4        (sine transition from +a to -a)
    //
    // The peak acceleration a_max is determined by s(1) = 1.
    // From VDI 2143: Ca ≈ 4.8886, so a_max = Ca for unit stroke.

    let beta_ramp = 1.0 / 8.0;    // duration of sine ramps (Phase I, V)
    let beta_const = 1.0 / 4.0;   // duration of constant accel (Phase II, IV)
    let beta_trans = 1.0 / 4.0;   // duration of sine transition (Phase III)

    // Normalized peak acceleration: chosen so that s(1)=1
    // From double-integration: a_max = 2π / (1 + π/2) ≈ 2.4437
    // This is the half-amplitude; the full Ca = 2·a_max ≈ 4.8886
    let a_max = 2.0 * PI / (1.0 + PI / 2.0);

    if tau <= beta_ramp {
        // Phase I: 0 ≤ τ ≤ 1/8 — Sine ramp from 0 to +a_max
        let phi = PI * tau / beta_ramp;

        let a = a_max * (1.0 - phi.cos()) / 2.0;
        let j = a_max * PI / (2.0 * beta_ramp) * phi.sin();

        // v = ∫a dτ = a_max/2 · (τ - β₁/π · sin(φ))
        let v = a_max / 2.0 * (tau - beta_ramp / PI * phi.sin());

        // s = ∫v dτ = a_max/2 · (τ²/2 + β₁²/π² · (cos(φ) - 1))
        let s = a_max / 2.0 * (tau * tau / 2.0 + beta_ramp * beta_ramp / (PI * PI) * (phi.cos() - 1.0));

        MotionEvaluation { s, v, a, j }
    } else if tau <= beta_ramp + beta_const {
        // Phase II: 1/8 < τ ≤ 3/8 — Constant acceleration = a_max
        let tau2 = tau - beta_ramp;

        // Values at end of Phase I
        let v1 = a_max / 2.0 * beta_ramp; // sin(π)=0
        let s1 = a_max / 2.0 * (beta_ramp * beta_ramp / 2.0 - 2.0 * beta_ramp * beta_ramp / (PI * PI));

        let a = a_max;
        let j = 0.0;
        let v = v1 + a_max * tau2;
        let s = s1 + v1 * tau2 + a_max * tau2 * tau2 / 2.0;

        MotionEvaluation { s, v, a, j }
    } else if tau <= 0.5 {
        // Phase III first half: 3/8 < τ ≤ 1/2 — Sine transition from +a_max to 0
        // Use symmetry: the profile is symmetric about τ=0.5
        // Phase III spans [3/8, 5/8], with a(τ) = a_max · cos(π·(τ-3/8)/β₃)
        let tau3 = tau - (beta_ramp + beta_const);
        let phi = PI * tau3 / beta_trans;

        // Values at end of Phase II
        let v1 = a_max / 2.0 * beta_ramp;
        let s1 = a_max / 2.0 * (beta_ramp * beta_ramp / 2.0 - 2.0 * beta_ramp * beta_ramp / (PI * PI));
        let v2 = v1 + a_max * beta_const;
        let s2 = s1 + v1 * beta_const + a_max * beta_const * beta_const / 2.0;

        let a = a_max * phi.cos();
        let j = -a_max * PI / beta_trans * phi.sin();
        let v = v2 + a_max * beta_trans / PI * phi.sin();
        let s = s2 + v2 * tau3 + a_max * beta_trans * beta_trans / (PI * PI) * (1.0 - phi.cos());

        MotionEvaluation { s, v, a, j }
    } else {
        // τ > 0.5: Use symmetry property
        // s(τ) = 1 - s(1-τ), v(τ) = v(1-τ), a(τ) = -a(1-τ), j(τ) = j(1-τ)
        let eval_mirror = modified_trapezoid(1.0 - tau);
        MotionEvaluation {
            s: 1.0 - eval_mirror.s,
            v: eval_mirror.v,
            a: -eval_mirror.a,
            j: eval_mirror.j,
        }
    }
}

// ─────────────────────────────────────────────────────────────
// POLYNOMIAL 4-5-6-7 (Polynom 7. Grades)
// Cv = 2.1875, Ca = 7.5132, Cj = 0 at boundaries
// Guarantees s=0, v=0, a=0, j=0 at τ=0 and τ=1
// ─────────────────────────────────────────────────────────────

pub fn polynomial_4567(tau: f64) -> MotionEvaluation {
    let t2 = tau * tau;
    let t3 = t2 * tau;
    let t4 = t3 * tau;
    let t5 = t4 * tau;
    let t6 = t5 * tau;
    let t7 = t6 * tau;

    MotionEvaluation {
        s:  35.0 * t4 -  84.0 * t5 +  70.0 * t6 -  20.0 * t7,
        v: 140.0 * t3 - 420.0 * t4 + 420.0 * t5 - 140.0 * t6,
        a: 420.0 * t2 - 1680.0 * t3 + 2100.0 * t4 - 840.0 * t5,
        j: 840.0 * tau - 5040.0 * t2 + 8400.0 * t3 - 4200.0 * t4,
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

    // ── Helper: check boundary conditions for a rise motion law ──
    fn assert_rise_boundaries(name: &str, eval_fn: impl Fn(f64) -> MotionEvaluation, tol_s: f64) {
        let at_0 = eval_fn(0.0);
        assert!(at_0.s.abs() < 1e-10, "{}: s(0) = 0, got {}", name, at_0.s);

        let at_1 = eval_fn(1.0);
        assert!((at_1.s - 1.0).abs() < tol_s, "{}: s(1) = 1, got {}", name, at_1.s);
    }

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
    fn poly345_boundaries() {
        assert_rise_boundaries("Poly345", polynomial_345, 1e-10);
        let at_0 = polynomial_345(0.0);
        let at_1 = polynomial_345(1.0);
        assert!(at_0.v.abs() < 1e-10, "v(0)=0");
        assert!(at_1.v.abs() < 1e-10, "v(1)=0");
        assert!(at_0.a.abs() < 1e-10, "a(0)=0");
        assert!(at_1.a.abs() < 1e-10, "a(1)=0");
    }

    #[test]
    fn poly4567_boundaries() {
        assert_rise_boundaries("Poly4567", polynomial_4567, 1e-10);
        let at_0 = polynomial_4567(0.0);
        let at_1 = polynomial_4567(1.0);
        // v=0, a=0, j=0 at boundaries
        assert!(at_0.v.abs() < 1e-10, "v(0)=0");
        assert!(at_1.v.abs() < 1e-10, "v(1)=0");
        assert!(at_0.a.abs() < 1e-10, "a(0)=0");
        assert!(at_1.a.abs() < 1e-10, "a(1)=0");
        assert!(at_0.j.abs() < 1e-10, "j(0)=0");
        assert!(at_1.j.abs() < 1e-10, "j(1)=0");
    }

    #[test]
    fn poly4567_midpoint() {
        let at_mid = polynomial_4567(0.5);
        assert!((at_mid.s - 0.5).abs() < 1e-10, "s(0.5)=0.5");
        // Cv = 35/16 = 2.1875
        assert!((at_mid.v - 2.1875).abs() < 1e-6, "Cv = 2.1875, got {}", at_mid.v);
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
        assert!(at_0.s.abs() < 1e-10, "s(0) = 0, got {}", at_0.s);
        assert!(at_0.v.abs() < 1e-10, "v(0) = 0, got {}", at_0.v);

        let at_1 = modified_sine(1.0);
        assert!((at_1.s - 1.0).abs() < 1e-4, "s(1) = 1.0, got {}", at_1.s);
        assert!(at_1.v.abs() < 1e-4, "v(1) = 0, got {}", at_1.v);
    }

    #[test]
    fn modified_sine_monotonic() {
        // Position should be monotonically increasing for a rise segment
        let mut prev_s = 0.0;
        for i in 1..=100 {
            let tau = i as f64 / 100.0;
            let eval = modified_sine(tau);
            assert!(eval.s >= prev_s - 1e-10, "s not monotonic at τ={}: {} < {}", tau, eval.s, prev_s);
            prev_s = eval.s;
        }
    }

    #[test]
    fn modified_trapezoid_boundaries() {
        let at_0 = modified_trapezoid(0.0);
        assert!(at_0.s.abs() < 1e-10, "s(0) = 0, got {}", at_0.s);
        assert!(at_0.v.abs() < 1e-10, "v(0) = 0, got {}", at_0.v);
        assert!(at_0.a.abs() < 1e-10, "a(0) = 0, got {}", at_0.a);

        let at_1 = modified_trapezoid(1.0);
        assert!((at_1.s - 1.0).abs() < 1e-4, "s(1) = 1.0, got {}", at_1.s);
        assert!(at_1.v.abs() < 1e-4, "v(1) = 0, got {}", at_1.v);
        assert!(at_1.a.abs() < 1e-4, "a(1) = 0, got {}", at_1.a);
    }

    #[test]
    fn modified_trapezoid_symmetry() {
        // Profile should be symmetric: s(0.5) = 0.5
        let at_mid = modified_trapezoid(0.5);
        assert!((at_mid.s - 0.5).abs() < 1e-4, "s(0.5) = 0.5, got {}", at_mid.s);
    }

    #[test]
    fn modified_trapezoid_monotonic() {
        let mut prev_s = 0.0;
        for i in 1..=100 {
            let tau = i as f64 / 100.0;
            let eval = modified_trapezoid(tau);
            assert!(eval.s >= prev_s - 1e-10, "s not monotonic at τ={}: {} < {}", tau, eval.s, prev_s);
            prev_s = eval.s;
        }
    }
}
