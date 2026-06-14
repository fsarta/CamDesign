import React from 'react';
import { Plus, Trash2, ChevronDown, GitCompare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UnitSystem } from '../units';
import { lengthLabel, angleLabel, DEFAULT_UNITS } from '../units';

export interface SegmentDef {
    id: string;
    name: string;
    law: string;
    phi_start: number;
    phi_end: number;
    stroke: number;
    s_start: number;
    boundary_conditions: {
        start_velocity: { Fixed: number } | string;
        end_velocity: { Fixed: number } | string;
        start_acceleration: { Fixed: number } | string;
        end_acceleration: { Fixed: number } | string;
        start_jerk: string;
        end_jerk: string;
    };
    color: string | null;
    metadata: Record<string, string>;
    // Bezier control points (only used when law === 'Bezier')
    bezier_cx1?: number;
    bezier_cy1?: number;
    bezier_cx2?: number;
    bezier_cy2?: number;
    // Points for Numeric Spline
    numeric_points?: [number, number][];
}

const AVAILABLE_LAWS = [
    { value: 'Dwell', label: 'Dwell (Sosta)' },
    { value: 'Cycloidal', label: 'Cycloidal (VDI 2143)' },
    { value: 'Polynomial345', label: 'Polynomial 3-4-5' },
    { value: 'ModifiedSine', label: 'Modified Sine (VDI 2143)' },
    { value: 'ModifiedTrapezoid', label: 'Modified Trapezoid (VDI 2143)' },
    { value: 'Harmonic', label: 'Simple Harmonic' },
    { value: 'DoubleHarmonic', label: 'Double Harmonic' },
    { value: 'ConstantVelocity', label: 'Constant Velocity' },
    { value: 'Bezier', label: 'Bézier Cubic' },
    { value: 'NumericSpline', label: 'Numeric Spline (CSV)' },
];

const SEGMENT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface SegmentEditorProps {
    segments: SegmentDef[];
    onSegmentsChange: (segments: SegmentDef[]) => void;
    unitSystem?: UnitSystem;
}

export const SegmentEditor: React.FC<SegmentEditorProps> = ({ segments, onSegmentsChange, unitSystem = DEFAULT_UNITS }) => {
    const [expandedId, setExpandedId] = React.useState<string | null>(segments[0]?.id ?? null);
    const [editingNameId, setEditingNameId] = React.useState<string | null>(null);

    const lu = lengthLabel(unitSystem.length);
    const au = angleLabel(unitSystem.angle);

    const sortByPosition = (segs: SegmentDef[]) =>
        [...segs].sort((a, b) => a.phi_start - b.phi_start);

    const handleFieldChange = (segId: string, field: keyof SegmentDef, value: any) => {
        const updated = segments.map(seg => {
            if (seg.id !== segId) return seg;
            return { ...seg, [field]: value };
        });
        onSegmentsChange(sortByPosition(updated));
    };

    const addSegment = () => {
        const lastSeg = segments[segments.length - 1];
        const newStart = lastSeg ? lastSeg.phi_end : 0;
        const newEnd = Math.min(newStart + 60, 360);
        const colorIndex = segments.length % SEGMENT_COLORS.length;

        const newSeg: SegmentDef = {
            id: crypto.randomUUID(),
            name: `Segment ${segments.length + 1}`,
            law: 'Dwell',
            phi_start: newStart,
            phi_end: newEnd,
            stroke: 0,
            s_start: lastSeg ? lastSeg.s_start + lastSeg.stroke : 0,
            boundary_conditions: {
                start_velocity: { Fixed: 0.0 },
                end_velocity: { Fixed: 0.0 },
                start_acceleration: { Fixed: 0.0 },
                end_acceleration: { Fixed: 0.0 },
                start_jerk: "Free",
                end_jerk: "Free",
            },
            color: SEGMENT_COLORS[colorIndex],
            metadata: {},
            bezier_cx1: 0.25,
            bezier_cy1: 0.1,
            bezier_cx2: 0.25,
            bezier_cy2: 1.0,
        };
        const updated = sortByPosition([...segments, newSeg]);
        onSegmentsChange(updated);
        setExpandedId(newSeg.id);
    };

    const removeSegment = (segId: string) => {
        if (segments.length <= 1) return;
        onSegmentsChange(sortByPosition(segments.filter(s => s.id !== segId)));
    };

    return (
        <div className="segment-editor">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                    Segments ({segments.length})
                </h3>
                <button className="glass-button" onClick={addSegment} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                    <Plus size={14} /> Add
                </button>
            </div>

            {/* Timeline Bar */}
            <div className="segment-timeline" style={{
                display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden',
                marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.1)'
            }}>
                {segments.map(seg => {
                    const widthPct = ((seg.phi_end - seg.phi_start) / 360) * 100;
                    return (
                        <div
                            key={seg.id}
                            onClick={() => setExpandedId(seg.id === expandedId ? null : seg.id)}
                            style={{
                                width: `${widthPct}%`, minWidth: '8px',
                                backgroundColor: seg.color || '#3b82f6',
                                opacity: seg.id === expandedId ? 1 : 0.5,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.6rem', color: '#fff', fontWeight: 600,
                                transition: 'opacity 0.2s',
                                borderRight: '1px solid rgba(0,0,0,0.3)',
                            }}
                            title={`${seg.name}: ${seg.phi_start}° → ${seg.phi_end}°`}
                        >
                            {widthPct > 10 ? seg.law.substring(0, 3) : ''}
                        </div>
                    );
                })}
            </div>

            {/* Segments List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {segments.map((seg) => (
                    <div key={seg.id} className="segment-card" style={{
                        border: `1px solid ${seg.id === expandedId ? (seg.color || '#3b82f6') : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        transition: 'border-color 0.2s',
                    }}>
                        {/* Segment Header */}
                        <div
                            style={{
                                display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem',
                                cursor: 'pointer', gap: '0.5rem',
                            }}
                            onClick={() => setExpandedId(seg.id === expandedId ? null : seg.id)}
                        >
                            <div style={{
                                width: '10px', height: '10px', borderRadius: '50%',
                                backgroundColor: seg.color || '#3b82f6', flexShrink: 0,
                            }} />
                            {editingNameId === seg.id ? (
                                <input
                                    value={seg.name}
                                    onChange={e => handleFieldChange(seg.id, 'name', e.target.value)}
                                    className="cad-input"
                                    style={{
                                        flex: 1, padding: '0.1rem 0.2rem', margin: '0 0.5rem',
                                        border: '1px solid transparent', borderRadius: '4px',
                                    }}
                                    autoFocus
                                    onBlur={() => setEditingNameId(null)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === 'Escape') setEditingNameId(null);
                                    }}
                                    onClick={e => e.stopPropagation()}
                                />
                            ) : (
                                <span style={{ fontSize: '0.85rem', fontWeight: 500, flex: 1 }} onDoubleClick={() => setEditingNameId(seg.id)}>
                                    {seg.name}
                                </span>
                            )}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                {seg.phi_start}°–{seg.phi_end}°
                            </span>
                            <ChevronDown size={14} style={{
                                transform: seg.id === expandedId ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s', opacity: 0.5,
                            }} />
                        </div>

                        {/* Expanded Editor */}
                        <AnimatePresence initial={false}>
                            {seg.id === expandedId && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <div style={{ padding: '0 0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {/* Law Selector */}
                                        <div className="param-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Motion Law</label>
                                            <select
                                                value={seg.law}
                                                onChange={e => handleFieldChange(seg.id, 'law', e.target.value)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                                                    borderRadius: '4px', padding: '0.4rem', color: '#e6edf3', fontSize: '0.85rem',
                                                }}
                                            >
                                                {AVAILABLE_LAWS.map(l => (
                                                    <option key={l.value} value={l.value}>{l.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Numeric Params */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                            <NumericField label={`φ Start (${au})`} value={seg.phi_start}
                                                onChange={v => handleFieldChange(seg.id, 'phi_start', v)} min={0} max={unitSystem.angle === 'rad' ? 6.2832 : 360} step={unitSystem.angle === 'rad' ? 0.01 : 1} />
                                            <NumericField label={`φ End (${au})`} value={seg.phi_end}
                                                onChange={v => handleFieldChange(seg.id, 'phi_end', v)} min={0} max={unitSystem.angle === 'rad' ? 6.2832 : 360} step={unitSystem.angle === 'rad' ? 0.01 : 1} />
                                            <NumericField label={`Stroke (${lu})`} value={seg.stroke}
                                                onChange={v => handleFieldChange(seg.id, 'stroke', v)} min={-500} max={500} step={0.5} />
                                            <NumericField label={`S Start (${lu})`} value={seg.s_start}
                                                onChange={v => handleFieldChange(seg.id, 's_start', v)} min={-500} max={500} step={0.5} />
                                        </div>

                                        {/* Bezier Control Points */}
                                        {seg.law === 'Bezier' && (
                                            <div style={{ marginTop: '0.25rem' }}>
                                                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Bézier Control Points</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                    <NumericField label="P1.x" value={seg.bezier_cx1 ?? 0.25}
                                                        onChange={v => handleFieldChange(seg.id, 'bezier_cx1' as keyof SegmentDef, v)} min={0} max={1} step={0.01} />
                                                    <NumericField label="P1.y" value={seg.bezier_cy1 ?? 0.1}
                                                        onChange={v => handleFieldChange(seg.id, 'bezier_cy1' as keyof SegmentDef, v)} min={-0.5} max={1.5} step={0.01} />
                                                    <NumericField label="P2.x" value={seg.bezier_cx2 ?? 0.25}
                                                        onChange={v => handleFieldChange(seg.id, 'bezier_cx2' as keyof SegmentDef, v)} min={0} max={1} step={0.01} />
                                                    <NumericField label="P2.y" value={seg.bezier_cy2 ?? 1.0}
                                                        onChange={v => handleFieldChange(seg.id, 'bezier_cy2' as keyof SegmentDef, v)} min={-0.5} max={1.5} step={0.01} />
                                                </div>
                                            </div>
                                        )}

                                        {/* Numeric Spline CSV Import */}
                                        {seg.law === 'NumericSpline' && (
                                            <div style={{ marginTop: '0.25rem', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                                                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block', textAlign: 'center' }}>
                                                    CSV Points (Normalized 0.0 - 1.0)
                                                </label>
                                                <input type="file" accept=".csv" onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        const text = ev.target?.result as string;
                                                        const lines = text.split('\n').filter(l => l.trim().length > 0);
                                                        const pts: [number, number][] = [];
                                                        for (const line of lines) {
                                                            const sep = line.includes(';') ? ';' : ',';
                                                            const parts = line.split(sep);
                                                            if (parts.length >= 2) {
                                                                const x = parseFloat(parts[0].replace(',', '.'));
                                                                const y = parseFloat(parts[1].replace(',', '.'));
                                                                if (!isNaN(x) && !isNaN(y)) {
                                                                    pts.push([x, y]);
                                                                }
                                                            }
                                                        }
                                                        if (pts.length > 1) {
                                                            handleFieldChange(seg.id, 'numeric_points', pts);
                                                        } else {
                                                            alert('CSV must contain at least 2 valid points (x,y)');
                                                        }
                                                    };
                                                    reader.readAsText(file);
                                                }} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', width: '100%' }} />
                                                {seg.numeric_points ? (
                                                    <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#10b981', textAlign: 'center' }}>
                                                        ✔ Loaded {seg.numeric_points.length} points
                                                    </div>
                                                ) : (
                                                    <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: '#ef4444', textAlign: 'center' }}>
                                                        Please upload a CSV with X, Y columns
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Delete */}
                                        {segments.length > 1 && (
                                            <button
                                                className="glass-button"
                                                onClick={() => removeSegment(seg.id)}
                                                style={{ marginTop: '0.25rem', color: 'var(--danger)', fontSize: '0.8rem', alignSelf: 'flex-end' }}
                                            >
                                                <Trash2 size={14} /> Remove Segment
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Small numeric input field used inside the editor
const NumericField: React.FC<{
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
}> = ({ label, value, onChange, min, max, step = 1 }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{label}</label>
            <input
                type="number"
                value={value}
                onChange={e => onChange(parseFloat(e.target.value) || 0)}
                min={min} max={max} step={step}
                className="cad-input"
                style={{
                    width: '100%',
                }}
            />
        </div>
    );
};
