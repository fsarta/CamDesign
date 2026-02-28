use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;
use motus_core::motion::profile::MotionProfile;
use motus_core::motion::laws::MotionEvaluator;
use motus_core::motion::segment::MotionSegment;
use motus_core::cam::calculation::{calculate_cam_contour, CamContourResult};


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

    let mut global_results = Vec::with_capacity(degrees_resolution + 1);

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
        
        global_results.push(found_eval);
    }

    let res = serde_wasm_bindgen::to_value(&global_results)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    Ok(res)
}

/// Evaluate cam contour from a motion profile and cam parameters.
/// Returns CamContourResult with (x, y, pressure_angle, curvature_radius) per angle step.
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

    // First, evaluate the motion profile to get s, v, a at each angle step
    let mut displacements = Vec::with_capacity(degrees_resolution + 1);

    for i in 0..=degrees_resolution {
        let current_angle_deg = (i as f64 / degrees_resolution as f64) * profile.cycle_angle.to_degrees();
        
        let mut s = 0.0_f64;
        let mut ds_dphi = 0.0_f64;
        let mut d2s_dphi2 = 0.0_f64;

        for seg in &profile.segments {
            if current_angle_deg >= seg.phi_start && current_angle_deg <= seg.phi_end {
                let angle_duration = seg.phi_end - seg.phi_start;
                let tau = if angle_duration > 0.0 {
                    (current_angle_deg - seg.phi_start) / angle_duration
                } else {
                    0.0
                };

                let norm_eval = seg.law.evaluate_normalized(tau);
                let beta_rad = angle_duration.to_radians();

                s = seg.s_start + seg.stroke * norm_eval.s;

                if beta_rad > 0.0 {
                    // ds/dφ (in radians)
                    ds_dphi = (seg.stroke / beta_rad) * norm_eval.v;
                    // d²s/dφ² (in radians)
                    d2s_dphi2 = (seg.stroke / (beta_rad * beta_rad)) * norm_eval.a;
                }

                break;
            }
        }

        displacements.push((current_angle_deg, s, ds_dphi, d2s_dphi2));
    }

    let cam_result: CamContourResult = calculate_cam_contour(
        base_radius, roller_radius, offset, &displacements
    );

    let res = serde_wasm_bindgen::to_value(&cam_result)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    Ok(res)
}
