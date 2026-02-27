use super::MotionEvaluation;
use std::f64::consts::PI;

pub fn dwell(_tau: f64) -> MotionEvaluation {
    MotionEvaluation { s: 0.0, v: 0.0, a: 0.0, j: 0.0 }
}

pub fn constant_velocity(tau: f64) -> MotionEvaluation {
    MotionEvaluation { s: tau, v: 1.0, a: 0.0, j: 0.0 }
}

pub fn cycloidal(tau: f64) -> MotionEvaluation {
    let t_pi2 = 2.0 * PI * tau;
    MotionEvaluation {
        s: tau - (t_pi2).sin() / (2.0 * PI),
        v: 1.0 - (t_pi2).cos(),
        a: 2.0 * PI * (t_pi2).sin(),
        j: 4.0 * PI * PI * (t_pi2).cos(),
    }
}

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

pub fn modified_sine(tau: f64) -> MotionEvaluation {
    // VDI 2143 Modified Sine implementation
    let pi = std::f64::consts::PI;
    let pi_4 = pi / 4.0;
    
    if tau <= 0.125 { // 0 to 1/8
        let arg = 4.0 * pi * tau;
        MotionEvaluation {
            s: pi_4 * tau - (1.0 / 16.0) * arg.sin(),
            v: pi_4 * (1.0 - arg.cos()),
            a: pi * pi * arg.sin(),
            j: 4.0 * pi * pi * pi * arg.cos()
        }
    } else if tau <= 0.875 { // 1/8 to 7/8
        let arg = (4.0 * pi / 3.0) * (tau - 0.125);
        MotionEvaluation {
            s: (pi / 4.0 + 2.0 / pi) * tau - (1.0 / (4.0 * pi)) - (9.0 / (4.0 * pi * pi)) * arg.sin(),
            v: (pi / 4.0 + 2.0 / pi) - (3.0 / (pi * pi)) * arg.cos(),
            a: (4.0 / pi) * arg.sin(),
            j: (16.0 / 3.0) * arg.cos()
        } // These are simplified generic implementations. Full VDI math will be added in full scope.
    } else { // 7/8 to 1
        let _arg = 4.0 * pi * (tau - 1.0);
        MotionEvaluation { s: tau, v: 0.0, a: 0.0, j: 0.0 } // simplified placeholder
    }
}

pub fn modified_trapezoid(tau: f64) -> MotionEvaluation {
    MotionEvaluation { s: tau, v: 1.0, a: 0.0, j: 0.0 } // simplified placeholder
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vdi2143_cycloidal_coefficients() {
        // Test theoretically max values (Cv, Ca, Cj)
        let eval_mid = cycloidal(0.5); // Peak velocity
        assert!((eval_mid.v - 2.0).abs() < 1e-6);

        let eval_peak_acc = cycloidal(0.25); // Peak accel
        assert!((eval_peak_acc.a - (2.0 * PI)).abs() < 1e-6);
        
        let eval_peak_jerk = cycloidal(0.0); // Peak jerk
        assert!((eval_peak_jerk.j - (4.0 * PI * PI)).abs() < 1e-6);
    }

    #[test]
    fn vdi2143_poly345_coefficients() {
        let eval_mid = polynomial_345(0.5);
        assert!((eval_mid.v - 1.875).abs() < 1e-6);
        
        // Max acceleration occurs at tau = (3 - sqrt(3))/6 approx 0.21132
        let tau_max_a = (3.0 - 3.0_f64.sqrt()) / 6.0;
        let eval_acc = polynomial_345(tau_max_a);
        assert!((eval_acc.a - 5.773502).abs() < 1e-5);
    }
}
