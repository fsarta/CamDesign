use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;
use motus_core::motion::profile::MotionProfile;
use motus_core::motion::laws::MotionEvaluator;
use motus_core::motion::segment::MotionSegment;


#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    Ok(())
}

#[wasm_bindgen]
pub fn process_motion_profile(val: JsValue) -> Result<JsValue, JsValue> {
    // Deserialize JS object into Motus Core MotionProfile
    let profile: MotionProfile = serde_wasm_bindgen::from_value(val)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    // Test that we can read it and serialize it back
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

    // We calculate 360 degrees (or specified resolution) globally.
    // For each degree degree step, we check which segment it belongs to.
    let mut global_results = Vec::with_capacity(degrees_resolution + 1);

    for i in 0..=degrees_resolution {
        let current_angle = (i as f64 / degrees_resolution as f64) * profile.cycle_angle.to_degrees(); // typically 360.0 degrees
        
        let mut found_eval = motus_core::motion::laws::MotionEvaluation { s: 0.0, v: 0.0, a: 0.0, j: 0.0 };
        
        // Find active segment
        for seg in &profile.segments {
            if current_angle >= seg.phi_start && current_angle <= seg.phi_end {
                // Calculate local tau
                let angle_duration = seg.phi_end - seg.phi_start;
                let tau = if angle_duration > 0.0 {
                    (current_angle - seg.phi_start) / angle_duration
                } else {
                    0.0
                };
                
                let norm_eval = seg.law.evaluate_normalized(tau);
                
                // Denormalize (Simplified generic model, actual VDI requires exact boundaries merging)
                // s = s_start + stroke * norm_s
                let beta_rad = angle_duration.to_radians(); // Denominator for V/A/J
                found_eval.s = seg.s_start + seg.stroke * norm_eval.s;
                
                if beta_rad > 0.0 {
                     // We map back the velocity by formula V = stroke / beta * Cv
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
