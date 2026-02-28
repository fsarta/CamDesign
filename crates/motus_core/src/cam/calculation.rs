use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CamContourPoint {
    pub angle_deg: f64,      // Input angle φ (degrees)
    pub s: f64,              // Follower displacement
    pub x: f64,              // Cam contour X
    pub y: f64,              // Cam contour Y
    pub pressure_angle: f64, // Pressure angle (degrees)
    pub curvature_radius: f64, // Radius of curvature
}

/// Full cam contour result from a motion profile evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CamContourResult {
    pub points: Vec<CamContourPoint>,
    pub max_pressure_angle: f64,
    pub min_curvature_radius: f64,
    pub base_radius: f64,
}

/// Calculates the full disc cam contour for a translating follower.
///
/// # Arguments
/// * `base_radius` - Base circle radius Rb
/// * `roller_radius` - Roller follower radius Rr (0 for knife-edge)
/// * `offset` - Follower eccentricity e
/// * `displacements` - Array of (angle_deg, s, v, a) from the motion profile
///
/// Returns a CamContourResult with the full contour, pressure angles, and curvature radii.
pub fn calculate_cam_contour(
    base_radius: f64,
    roller_radius: f64,
    offset: f64,
    displacements: &[(f64, f64, f64, f64)], // (angle_deg, s, ds/dphi, d2s/dphi2)
) -> CamContourResult {
    let e = offset;
    let rb = base_radius;
    let rr = roller_radius;
    let s0 = (rb * rb - e * e).max(0.0).sqrt();

    let mut points = Vec::with_capacity(displacements.len());
    let mut max_pa = 0.0_f64;
    let mut min_rho_c = f64::INFINITY;

    for &(angle_deg, s, ds_dphi, d2s_dphi2) in displacements {
        let phi = angle_deg.to_radians();

        // Pitch curve coordinates
        let current_s = s0 + s;
        let rho_pitch = (current_s * current_s + e * e).sqrt();

        // Pitch curve angle
        let alpha_0 = if s0.abs() > 1e-12 { (e / s0).atan() } else { 0.0 };
        let alpha = if current_s.abs() > 1e-12 { (e / current_s).atan() } else { 0.0 };
        let theta = phi - alpha + alpha_0;

        // Pitch curve point (before roller offset)
        let xp = rho_pitch * theta.cos();
        let yp = rho_pitch * theta.sin();

        // Pressure angle: tan(μ) = (ds/dφ - e) / (s0 + s)
        let pressure_angle_rad = ((ds_dphi - e) / current_s).atan();
        let pressure_angle_deg = pressure_angle_rad.to_degrees();

        // Radius of curvature of the pitch curve
        // ρ = ((s0+s)² + (ds/dφ)²)^(3/2) / ((s0+s)² + 2(ds/dφ)² - (s0+s)·d²s/dφ²)
        let numerator = (current_s * current_s + ds_dphi * ds_dphi).powf(1.5);
        let denominator = current_s * current_s + 2.0 * ds_dphi * ds_dphi - current_s * d2s_dphi2;
        let rho_curvature = if denominator.abs() > 1e-12 {
            numerator / denominator
        } else {
            f64::INFINITY
        };

        // Cam contour = pitch curve offset by roller radius along the normal
        // For simplicity with roller, the actual cam contour point is:
        // cam_point = pitch_point - rr * normal_direction
        // For a disc cam, the inner (working) contour:
        let (cam_x, cam_y) = if rr > 0.0 && rho_curvature.is_finite() {
            // Normal direction at the pitch point
            let rho_cam = rho_curvature - rr;
            // Approximate: offset along radial direction
            let scale = if rho_pitch > 1e-12 { (rho_pitch - rr) / rho_pitch } else { 1.0 };
            (xp * scale, yp * scale)
        } else {
            (xp, yp)
        };

        max_pa = max_pa.max(pressure_angle_deg.abs());
        if rho_curvature.is_finite() {
            min_rho_c = min_rho_c.min(rho_curvature.abs());
        }

        points.push(CamContourPoint {
            angle_deg,
            s,
            x: cam_x,
            y: cam_y,
            pressure_angle: pressure_angle_deg,
            curvature_radius: rho_curvature,
        });
    }

    CamContourResult {
        points,
        max_pressure_angle: max_pa,
        min_curvature_radius: if min_rho_c.is_finite() { min_rho_c } else { 0.0 },
        base_radius: rb,
    }
}

/// Legacy single-point calculation (kept for backwards compatibility)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CamCoordinates {
    pub angle: f64,
    pub s: f64,
    pub rho: f64,
    pub theta: f64,
    pub x: f64,
    pub y: f64,
}

pub fn calculate_disc_cam_contour(
    base_radius: f64,
    offset: f64,
    phi: f64,
    s: f64,
) -> CamCoordinates {
    let e = offset;
    let rb = base_radius;
    let s0 = (rb * rb - e * e).max(0.0).sqrt();
    let current_s = s0 + s;
    let rho = (current_s * current_s + e * e).sqrt();
    let theta = phi - (e / current_s).atan() + (e / s0).atan();
    let x = rho * theta.cos();
    let y = rho * theta.sin();

    CamCoordinates { angle: phi, s, rho, theta, x, y }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cam_contour_with_zero_displacement() {
        // With zero displacement and no offset, the cam should be a circle
        let displacements: Vec<(f64, f64, f64, f64)> = (0..=360)
            .map(|i| (i as f64, 0.0, 0.0, 0.0))
            .collect();

        let result = calculate_cam_contour(50.0, 0.0, 0.0, &displacements);

        // All points should be on the base circle
        for pt in &result.points {
            let r = (pt.x * pt.x + pt.y * pt.y).sqrt();
            assert!((r - 50.0).abs() < 1e-6, "Expected r=50, got {}", r);
        }
        assert!((result.max_pressure_angle).abs() < 1e-6);
    }

    #[test]
    fn pressure_angle_with_displacement() {
        // Single point with some velocity
        let displacements = vec![(90.0, 10.0, 5.0, 0.0)];
        let result = calculate_cam_contour(50.0, 0.0, 0.0, &displacements);
        assert!(result.points[0].pressure_angle > 0.0, "Should have positive pressure angle with positive velocity");
    }
}
