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
