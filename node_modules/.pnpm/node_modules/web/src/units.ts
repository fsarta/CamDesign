// ─── Unit System for MOTUS NOVA ──────────────────────────────
// All internal calculations (WASM) use mm + radians.
// This module handles display/input conversion only.

// ─── Types ───────────────────────────────────────────────────

export type LengthUnit = 'mm' | 'cm' | 'm' | 'in';
export type AngleUnit = 'deg' | 'rad';

export interface UnitSystem {
    length: LengthUnit;
    angle: AngleUnit;
}

export const DEFAULT_UNITS: UnitSystem = { length: 'mm', angle: 'deg' };

// ─── Conversion factors (to internal: mm, rad) ──────────────

const LENGTH_TO_MM: Record<LengthUnit, number> = {
    mm: 1,
    cm: 10,
    m: 1000,
    in: 25.4,
};

const ANGLE_TO_RAD: Record<AngleUnit, number> = {
    deg: Math.PI / 180,
    rad: 1,
};

// ─── Conversion functions ────────────────────────────────────

/** Convert a length value from one unit to another */
export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
    if (from === to) return value;
    const mm = value * LENGTH_TO_MM[from];
    return mm / LENGTH_TO_MM[to];
}

/** Convert an angle value from one unit to another */
export function convertAngle(value: number, from: AngleUnit, to: AngleUnit): number {
    if (from === to) return value;
    const rad = value * ANGLE_TO_RAD[from];
    return rad / ANGLE_TO_RAD[to];
}

/** Convert a length value from display unit to internal (mm) */
export function lengthToInternal(value: number, unit: LengthUnit): number {
    return value * LENGTH_TO_MM[unit];
}

/** Convert a length value from internal (mm) to display unit */
export function lengthFromInternal(value: number, unit: LengthUnit): number {
    return value / LENGTH_TO_MM[unit];
}

/** Convert an angle value from display unit to internal (rad) */
export function angleToInternal(value: number, unit: AngleUnit): number {
    return value * ANGLE_TO_RAD[unit];
}

/** Convert an angle value from internal (rad) to display unit */
export function angleFromInternal(value: number, unit: AngleUnit): number {
    return value / ANGLE_TO_RAD[unit];
}

// ─── Labels ──────────────────────────────────────────────────

export function lengthLabel(unit: LengthUnit): string {
    return unit;
}

export function angleLabel(unit: AngleUnit): string {
    return unit === 'deg' ? '°' : 'rad';
}

/** Velocity unit label: length/angle */
export function velocityLabel(units: UnitSystem): string {
    return `${units.length}/${units.angle === 'deg' ? '°' : 'rad'}`;
}

/** Acceleration unit label: length/angle² */
export function accelerationLabel(units: UnitSystem): string {
    return `${units.length}/${units.angle === 'deg' ? '°' : 'rad'}²`;
}

/** Jerk unit label: length/angle³ */
export function jerkLabel(units: UnitSystem): string {
    return `${units.length}/${units.angle === 'deg' ? '°' : 'rad'}³`;
}

// ─── Display conversion of kinematic results ─────────────────
// WASM outputs s in mm, v in mm/rad, a in mm/rad², j in mm/rad³.
// We need to convert to the user's chosen units.

/** Factor to convert WASM displacement (mm) to display length */
export function displacementFactor(units: UnitSystem): number {
    return 1 / LENGTH_TO_MM[units.length]; // mm → display
}

/** Factor to convert WASM velocity (mm/rad) to display velocity (length/angle) */
export function velocityFactor(units: UnitSystem): number {
    // mm/rad → length/angle = (1/LENGTH_TO_MM) / (1/ANGLE_TO_RAD) = ANGLE_TO_RAD / LENGTH_TO_MM
    return ANGLE_TO_RAD[units.angle] / LENGTH_TO_MM[units.length];
}

/** Factor to convert WASM acceleration (mm/rad²) to display */
export function accelerationFactor(units: UnitSystem): number {
    return (ANGLE_TO_RAD[units.angle] ** 2) / LENGTH_TO_MM[units.length];
}

/** Factor to convert WASM jerk (mm/rad³) to display */
export function jerkFactor(units: UnitSystem): number {
    return (ANGLE_TO_RAD[units.angle] ** 3) / LENGTH_TO_MM[units.length];
}

// ─── Available options ───────────────────────────────────────

export const LENGTH_OPTIONS: { value: LengthUnit; label: string }[] = [
    { value: 'mm', label: 'mm' },
    { value: 'cm', label: 'cm' },
    { value: 'm', label: 'm' },
    { value: 'in', label: 'in (inch)' },
];

export const ANGLE_OPTIONS: { value: AngleUnit; label: string }[] = [
    { value: 'deg', label: 'Degrees (°)' },
    { value: 'rad', label: 'Radians' },
];
