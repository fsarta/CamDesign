use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CamCoordinates {
    pub angle: f64, // Input angle phi
    pub s: f64,     // Follower displacement
    pub rho: f64,   // Radial distance
    pub theta: f64, // Polar angle for cam contour
    pub x: f64,     // Cartesian X
    pub y: f64,     // Cartesian Y
}

/// Calculates the contour of a disc cam with a translating roller / knife-edge follower.
/// base_radius = Rb
/// offset = e (eccentricity)
/// phi = current rotation angle of the cam (radians)
/// s = follower displacement at angle phi
pub fn calculate_disc_cam_contour(
    base_radius: f64,
    offset: f64,
    phi: f64,
    s: f64,
) -> CamCoordinates {
    // Basic kinematic relationship for eccentric translating follower
    // s0 is the initial distance from cam center to follower center when s = 0.
    // s0 = sqrt(Rb^2 - e^2)
    let e = offset;
    let rb = base_radius;
    let s0 = (rb * rb - e * e).max(0.0).sqrt();

    // The current distance from cam center to follower center
    let current_s = s0 + s;

    // Rho = distance to the center
    let rho = (current_s * current_s + e * e).sqrt();

    // Theta = polar angle on the cam reference frame
    // theta = phi - arctan(e / current_s) + arctan(e / s0)
    let theta = phi - (e / current_s).atan() + (e / s0).atan();

    // Convert to Cartesian
    let x = rho * theta.cos();
    let y = rho * theta.sin();

    CamCoordinates {
        angle: phi,
        s,
        rho,
        theta,
        x,
        y,
    }
}
