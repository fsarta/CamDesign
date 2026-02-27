use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum LengthUnit {
    Millimeter,
    Inch,
    Meter,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum AngleUnit {
    Degree,
    Radian,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ForceUnit {
    Newton,
    KiloNewton,
    PoundForce,
}
