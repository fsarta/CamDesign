use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;
use motus_core::motion::profile::MotionProfile;
use motus_core::motion::laws::MotionEvaluator;
use motus_core::motion::segment::MotionSegment;
use motus_core::cam::calculation::{
    calculate_cam_contour, CamContourResult,
    calculate_linear_cam_contour, LinearCamContourResult,
};

/// Internal helper: evaluates the profile at `degrees_resolution` steps.
/// Returns a vector of tuples: (angle_deg, evaluation_struct)
fn evaluate_profile_internal(profile: &MotionProfile, degrees_resolution: usize) -> Vec<(f64, motus_core::motion::laws::MotionEvaluation)> {
    let mut results = Vec::with_capacity(degrees_resolution + 1);

    for i in 0..=degrees_resolution {
        let current_angle = (i as f64 / degrees_resolution as f64) * profile.cycle_angle.to_degrees();
        let mut found_eval = motus_core::motion::laws::MotionEvaluation { s: 0.0, v: 0.0, a: 0.0, j: 0.0 };

        for seg in &profile.segments {
            if current_angle >= seg.phi_start && current_angle <= seg.phi_end {
                let angle_duration = seg.phi_end - seg.phi_start;
                let tau = if angle_duration > 0.0 {
                    (current_angle - seg.phi_start) / angle_duration
                } else {
                    0.0
                };
                
                let norm_eval = seg.law.evaluate_normalized(tau);
                let beta_rad = angle_duration.to_radians();
                
                found_eval.s = seg.s_start + seg.stroke * norm_eval.s;
                
                if beta_rad > 0.0 {
                     found_eval.v = (seg.stroke / beta_rad) * norm_eval.v;
                     found_eval.a = (seg.stroke / (beta_rad * beta_rad)) * norm_eval.a;
                     found_eval.j = (seg.stroke / (beta_rad * beta_rad * beta_rad)) * norm_eval.j;
                }
                break;
            }
        }
        results.push((current_angle, found_eval));
    }
    results
}

#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    Ok(())
}

#[wasm_bindgen]
pub fn process_motion_profile(val: JsValue) -> Result<JsValue, JsValue> {
    let profile: MotionProfile = serde_wasm_bindgen::from_value(val)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    let res = serde_wasm_bindgen::to_value(&profile)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    Ok(res)
}

#[wasm_bindgen]
pub fn evaluate_segment(val: JsValue, tau_steps: usize) -> Result<JsValue, JsValue> {
    let segment: MotionSegment = serde_wasm_bindgen::from_value(val)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))?;
        
    let mut results = Vec::with_capacity(tau_steps + 1);
    for i in 0..=tau_steps {
        let tau = (i as f64) / (tau_steps as f64);
        let eval = segment.law.evaluate_normalized(tau);
        results.push(eval);
    }
    
    let res = serde_wasm_bindgen::to_value(&results)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(res)
}

#[wasm_bindgen]
pub fn evaluate_profile(val: JsValue, degrees_resolution: usize) -> Result<JsValue, JsValue> {
    let profile: MotionProfile = serde_wasm_bindgen::from_value(val)
        .map_err(|e| JsValue::from_str(&format!("Profile Deserialization error: {}", e)))?;

    let internal_results = evaluate_profile_internal(&profile, degrees_resolution);
    let global_results: Vec<_> = internal_results.into_iter().map(|(_, eval)| eval).collect();

    let res = serde_wasm_bindgen::to_value(&global_results)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(res)
}

/// Evaluate ROTARY (disc) cam contour
#[wasm_bindgen]
pub fn evaluate_cam_contour(
    profile_val: JsValue,
    base_radius: f64,
    roller_radius: f64,
    offset: f64,
    degrees_resolution: usize,
) -> Result<JsValue, JsValue> {
    let profile: MotionProfile = serde_wasm_bindgen::from_value(profile_val)
        .map_err(|e| JsValue::from_str(&format!("Profile Deserialization error: {}", e)))?;

    let internal_results = evaluate_profile_internal(&profile, degrees_resolution);
    let displacements: Vec<(f64, f64, f64, f64)> = internal_results
        .into_iter()
        .map(|(angle, eval)| (angle, eval.s, eval.v, eval.a))
        .collect();

    let cam_result = calculate_cam_contour(base_radius, roller_radius, offset, &displacements);

    let res = serde_wasm_bindgen::to_value(&cam_result)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    Ok(res)
}

#[wasm_bindgen]
pub fn evaluate_dynamics(
    profile_val: JsValue,
    mass: f64,
    rpm: f64,
    preload: f64,
    stiffness: f64,
    damping: f64,
    external_force: f64,
    cam_thickness: f64,
    roller_radius: f64,
    base_radius: f64,
    offset: f64,
    e_eq: f64,
    degrees_resolution: usize,
) -> Result<JsValue, JsValue> {
    let profile: motus_core::motion::profile::MotionProfile = serde_wasm_bindgen::from_value(profile_val)
        .map_err(|e| JsValue::from_str(&format!("Profile Deserialization error: {}", e)))?;

    let internal_results = evaluate_profile_internal(&profile, degrees_resolution);
    let displacements: Vec<(f64, f64, f64, f64)> = internal_results
        .iter()
        .map(|(angle, eval)| (*angle, eval.s, eval.v, eval.a))
        .collect();

    let geometry = calculate_cam_contour(base_radius, roller_radius, offset, &displacements);
    let geom_data: Vec<(f64, f64)> = geometry.points.iter()
        .map(|p| (p.pressure_angle, p.curvature_radius))
        .collect();

    let dyn_result = motus_core::cam::dynamics::calculate_dynamics(
        mass, rpm, preload, stiffness, damping, external_force, cam_thickness, roller_radius, e_eq, &displacements, &geom_data
    );

    let res = serde_wasm_bindgen::to_value(&dyn_result)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    Ok(res)
}

/// Evaluate LINEAR (plate) cam contour
#[wasm_bindgen]
pub fn evaluate_linear_cam_contour(
    profile_val: JsValue,
    cam_length: f64,
    roller_radius: f64,
    groove_depth: f64,
    degrees_resolution: usize,
) -> Result<JsValue, JsValue> {
    let profile: MotionProfile = serde_wasm_bindgen::from_value(profile_val)
        .map_err(|e| JsValue::from_str(&format!("Profile Deserialization error: {}", e)))?;

    let internal_results = evaluate_profile_internal(&profile, degrees_resolution);
    let displacements: Vec<(f64, f64, f64, f64)> = internal_results
        .into_iter()
        .map(|(angle, eval)| (angle, eval.s, eval.v, eval.a))
        .collect();

    let cam_result = calculate_linear_cam_contour(cam_length, roller_radius, groove_depth, &displacements);

    let res = serde_wasm_bindgen::to_value(&cam_result)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    Ok(res)
}
