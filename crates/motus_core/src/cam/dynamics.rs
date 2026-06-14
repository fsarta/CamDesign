use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicPoint {
    pub angle_deg: f64,
    
    // Forces
    pub inertia_force: f64,    // N
    pub spring_force: f64,     // N
    pub damping_force: f64,    // N
    pub external_force: f64,   // N
    pub total_axial_force: f64,// N (along the follower axis)
    pub normal_force: f64,     // N (perpendicular to contact surface)
    
    // Torque
    pub cam_torque: f64,       // Nm
    
    // Contact Pressure
    pub hertz_pressure: f64,   // MPa
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicResult {
    pub points: Vec<DynamicPoint>,
    pub max_normal_force: f64,
    pub max_cam_torque: f64,
    pub max_hertz_pressure: f64,
}

/// Evaluates the dynamic forces, torque, and Hertz pressure for a translating roller follower.
///
/// # Arguments
/// * `mass` - Equivalent translating mass (kg)
/// * `rpm` - Cam rotational speed (rev/min)
/// * `preload` - Initial spring preload force at s=0 (N)
/// * `stiffness` - Spring stiffness (N/mm)
/// * `cam_thickness` - Cam axial width for Hertz pressure (mm)
/// * `roller_radius` - Roller radius (mm)
/// * `kinematics` - Array of `(angle_deg, s_mm, v_mm_rad, a_mm_rad2)`
/// * `geometry` - Array of `(pressure_angle_deg, curvature_radius_mm)` matching the kinematics
pub fn calculate_dynamics(
    mass: f64,
    rpm: f64,
    preload: f64,
    stiffness: f64,
    damping: f64,
    external_force: f64,
    cam_thickness: f64,
    roller_radius: f64,
    e_eq: f64, // Equivalent Young's Modulus
    kinematics: &[(f64, f64, f64, f64)],
    geometry: &[(f64, f64)],
) -> DynamicResult {
    // Angular velocity omega (rad/s)
    let omega = rpm * std::f64::consts::PI / 30.0;
    let omega2 = omega * omega;

    let mut points = Vec::with_capacity(kinematics.len());
    let mut max_fn = 0.0_f64;
    let mut max_torque = 0.0_f64;
    let mut max_hertz = 0.0_f64;

    for (i, &(angle_deg, s, v, a)) in kinematics.iter().enumerate() {
        let (pa_deg, rho_cam) = geometry[i];
        let alpha = pa_deg.to_radians();

        // 1. Acceleration in time domain (mm/s^2) -> convert to m/s^2 for force calculation
        // a_time = a_theta * omega^2
        let a_time_m_s2 = (a * omega2) / 1000.0;

        // 2. Inertial Force F = m * a
        let f_inertia = mass * a_time_m_s2;

        // 3. Spring Force F_k = F0 + k * s
        let f_spring = preload + stiffness * s;

        // 3.1 Damping Force F_c = c * v_time
        // v_time = v_theta * omega (mm/rad * rad/s = mm/s) -> convert to m/s
        let v_time_m_s = (v * omega) / 1000.0;
        let f_damping = damping * v_time_m_s;

        // 3.2 External Force (Constant)
        let f_ext = external_force;

        // 4. Total Axial Force
        // Spring, damping and external force push down (positive). Inertia opposes acceleration.
        let f_axial = f_inertia + f_spring + f_damping + f_ext;

        // 5. Normal Force on the cam profile
        // F_n = F_axial / cos(alpha)
        let cos_alpha = alpha.cos();
        let f_normal = if cos_alpha.abs() > 1e-6 {
            f_axial / cos_alpha
        } else {
            f_axial
        };

        // 6. Cam Torque
        // T = F_axial * v_theta (where v_theta is mm/rad)
        // Convert to Nm: F(N) * v(m/rad)
        let torque_nm = f_axial * (v / 1000.0);

        // 7. Hertzian Contact Pressure
        // Cylinder on Cylinder (Cam on Roller)
        // 1/rho_eq = 1/rho_cam + 1/rho_roller
        // If rho_cam is negative (concave), it subtracts.
        let mut p_hertz = 0.0;
        
        // We only calculate Hertz if the normal force is positive (contact maintained)
        if f_normal > 0.0 && cam_thickness > 0.0 {
            // Equivalent radius
            let rho_eq = if rho_cam.abs() > 1e-6 {
                1.0 / (1.0 / roller_radius + 1.0 / rho_cam)
            } else {
                roller_radius
            };

            if rho_eq > 0.0 {
                // b_half_width = sqrt(4 * F * rho_eq / (pi * b * E_eq))
                // p_max = sqrt(F * E_eq / (pi * b * rho_eq))
                
                // Watch units:
                // F is in N
                // b is cam_thickness in mm
                // rho_eq is in mm
                // E_eq is in MPa (N/mm^2)
                // Result p_max is in N/mm^2 = MPa
                
                let val = (f_normal * e_eq) / (std::f64::consts::PI * cam_thickness * rho_eq);
                if val > 0.0 {
                    p_hertz = val.sqrt();
                }
            }
        }

        if f_normal.abs() > max_fn { max_fn = f_normal.abs(); }
        if torque_nm.abs() > max_torque { max_torque = torque_nm.abs(); }
        if p_hertz > max_hertz { max_hertz = p_hertz; }

        points.push(DynamicPoint {
            angle_deg,
            inertia_force: f_inertia,
            spring_force: f_spring,
            damping_force: f_damping,
            external_force: f_ext,
            total_axial_force: f_axial,
            normal_force: f_normal,
            cam_torque: torque_nm,
            hertz_pressure: p_hertz,
        });
    }

    DynamicResult {
        points,
        max_normal_force: max_fn,
        max_cam_torque: max_torque,
        max_hertz_pressure: max_hertz,
    }
}
