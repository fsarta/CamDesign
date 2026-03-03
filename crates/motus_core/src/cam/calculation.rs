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

// ─────────────────────────────────────────────────────────────
// LINEAR CAM
// ─────────────────────────────────────────────────────────────

/// Result from a linear cam contour calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinearCamContourResult {
    /// Contour points: (x_position, y_upper, y_lower) for the cam plate
    pub points: Vec<LinearCamContourPoint>,
    pub max_pressure_angle: f64,
    pub min_curvature_radius: f64,
    pub cam_length: f64,       // Total length of the cam plate (mm)
    pub max_displacement: f64, // Maximum follower displacement
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinearCamContourPoint {
    pub x: f64,                // Linear position along the cam plate (mm)
    pub angle_deg: f64,        // Corresponding angle in the motion profile (°)
    pub s: f64,                // Follower displacement at this position (mm)
    pub y_upper: f64,          // Upper contour surface Y (mm)
    pub y_lower: f64,          // Lower contour surface Y (mm) — for groove cams
    pub pressure_angle: f64,   // Pressure angle (degrees)
    pub curvature_radius: f64, // Radius of curvature (mm)
}

/// Calculates the contour of a linear (plate) cam.
///
/// A linear cam is a flat plate that translates linearly. The follower rides
/// on the cam surface, and the contour shape determines the follower displacement.
///
/// # Arguments
/// * `cam_length` — Total length of the cam plate (mm)
/// * `roller_radius` — Roller follower radius Rr (0 for knife-edge) (mm)
/// * `groove_depth` — If > 0, generates a groove cam with upper/lower surfaces
/// * `displacements` — Array of (angle_deg, s, ds/dphi, d2s/dphi2) from the motion profile
///
/// The cam plate X-axis maps linearly to the profile angle (0° → x=0, 360° → x=cam_length).
pub fn calculate_linear_cam_contour(
    cam_length: f64,
    roller_radius: f64,
    groove_depth: f64,
    displacements: &[(f64, f64, f64, f64)],
) -> LinearCamContourResult {
    let rr = roller_radius;
    let n = displacements.len();

    let mut points = Vec::with_capacity(n);
    let mut max_pa = 0.0_f64;
    let mut min_rho_c = f64::INFINITY;
    let mut max_disp = 0.0_f64;

    for &(angle_deg, s, ds_dphi, d2s_dphi2) in displacements {
        // Map angle to linear position: x = (angle / 360) * cam_length
        let x = (angle_deg / 360.0) * cam_length;

        // ds/dx = ds/dphi * dphi/dx = ds/dphi * (360 / cam_length) * (π / 180)
        // But since ds/dphi is already in mm/rad from the profile evaluator,
        // we need: ds/dx = ds/dphi * (2π / cam_length)  [phi in radians, x in mm]
        let dphi_dx = std::f64::consts::TAU / cam_length; // rad/mm
        let ds_dx = ds_dphi * dphi_dx;
        let d2s_dx2 = d2s_dphi2 * dphi_dx * dphi_dx;

        // Pressure angle for a linear cam: μ = atan(ds/dx)
        let pressure_angle_rad = ds_dx.atan();
        let pressure_angle_deg = pressure_angle_rad.to_degrees();

        // Radius of curvature of the contour surface
        // ρ = (1 + (ds/dx)²)^(3/2) / |d²s/dx²|
        let rho_curvature = if d2s_dx2.abs() > 1e-12 {
            (1.0 + ds_dx * ds_dx).powf(1.5) / d2s_dx2.abs()
        } else {
            f64::INFINITY
        };

        // Upper contour surface: the pitch surface offset by roller radius
        // For a translating roller follower on a linear cam:
        // y_upper = s + rr (the roller rides on top)
        // y_lower = s - groove_depth (for groove cams, the lower rail)
        let y_upper = s + rr;
        let y_lower = if groove_depth > 0.0 { s - groove_depth } else { 0.0 };

        max_pa = max_pa.max(pressure_angle_deg.abs());
        max_disp = max_disp.max(s.abs());
        if rho_curvature.is_finite() {
            min_rho_c = min_rho_c.min(rho_curvature.abs());
        }

        points.push(LinearCamContourPoint {
            x,
            angle_deg,
            s,
            y_upper,
            y_lower,
            pressure_angle: pressure_angle_deg,
            curvature_radius: rho_curvature,
        });
    }

    LinearCamContourResult {
        points,
        max_pressure_angle: max_pa,
        min_curvature_radius: if min_rho_c.is_finite() { min_rho_c } else { 0.0 },
        cam_length,
        max_displacement: max_disp,
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

    #[test]
    fn linear_cam_zero_displacement() {
        // Zero displacement: contour should be flat (y_upper = roller_radius)
        let displacements: Vec<(f64, f64, f64, f64)> = (0..=360)
            .map(|i| (i as f64, 0.0, 0.0, 0.0))
            .collect();

        let result = calculate_linear_cam_contour(200.0, 5.0, 0.0, &displacements);

        assert_eq!(result.cam_length, 200.0);
        assert!((result.max_pressure_angle).abs() < 1e-6, "Should have zero pressure angle with no movement");

        // All points should have y_upper = roller_radius
        for pt in &result.points {
            assert!((pt.y_upper - 5.0).abs() < 1e-6, "y_upper should equal roller radius when s=0");
        }

        // x should range from 0 to cam_length
        assert!((result.points.first().unwrap().x).abs() < 1e-6);
        assert!((result.points.last().unwrap().x - 200.0).abs() < 1e-6);
    }

    #[test]
    fn linear_cam_with_displacement() {
        let displacements = vec![(90.0, 10.0, 5.0, 0.0)];
        let result = calculate_linear_cam_contour(200.0, 0.0, 0.0, &displacements);

        assert!(result.points[0].pressure_angle > 0.0, "Linear cam should have positive pressure angle with velocity");
        assert!((result.points[0].x - 50.0).abs() < 1e-6, "At 90°, x should be cam_length/4 = 50mm");
        assert!((result.points[0].y_upper - 10.0).abs() < 1e-6, "y_upper should equal s when rr=0");
    }

    #[test]
    fn linear_cam_groove() {
        let displacements = vec![(180.0, 25.0, 0.0, 0.0)];
        let result = calculate_linear_cam_contour(300.0, 5.0, 10.0, &displacements);

        // y_upper = s + rr = 25 + 5 = 30
        assert!((result.points[0].y_upper - 30.0).abs() < 1e-6);
        // y_lower = s - groove_depth = 25 - 10 = 15
        assert!((result.points[0].y_lower - 15.0).abs() < 1e-6);
    }
}
