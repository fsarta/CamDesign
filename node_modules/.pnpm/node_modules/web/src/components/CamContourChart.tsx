import React, { useMemo, useState } from 'react';
import type { UnitSystem } from '../units';
import { lengthLabel, lengthFromInternal, angleLabel, convertAngle, DEFAULT_UNITS } from '../units';

// ─── Types ─────────────────────────────────────────────────

export type CamDisplayType = 'rotary' | 'linear';

export interface CamContourData {
    points: Array<{
        angle_deg: number;
        s: number;
        x: number;
        y: number;
        pressure_angle: number;
        curvature_radius: number;
    }>;
    max_pressure_angle: number;
    min_curvature_radius: number;
    base_radius: number;
}

export interface LinearCamContourData {
    points: Array<{
        x: number;
        angle_deg: number;
        s: number;
        y_upper: number;
        y_lower: number;
        pressure_angle: number;
        curvature_radius: number;
    }>;
    max_pressure_angle: number;
    min_curvature_radius: number;
    cam_length: number;
    max_displacement: number;
}

interface CamContourChartProps {
    camType: CamDisplayType;
    rotaryData?: CamContourData | null;
    linearData?: LinearCamContourData | null;
    baseRadius: number;
    unitSystem?: UnitSystem;
}

// ─── Helpers ─────────────────────────────────────────────────

const paColor = (pa: number): string => {
    const abs = Math.abs(pa);
    if (abs < 30) return '#10b981';
    if (abs < 40) return '#f59e0b';
    return '#ef4444';
};

// ─── Component ───────────────────────────────────────────────

export const CamContourChart: React.FC<CamContourChartProps> = ({
    camType,
    rotaryData,
    linearData,
    baseRadius,
    unitSystem = DEFAULT_UNITS,
}) => {
    const [showPressureAngle, setShowPressureAngle] = useState(false);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const lu = lengthLabel(unitSystem.length);
    const au = angleLabel(unitSystem.angle);
    const lf = (v: number) => lengthFromInternal(v, unitSystem.length); // mm → display

    const data = camType === 'rotary' ? rotaryData : linearData;
    if (!data || !data.points || data.points.length === 0) {
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <span>No cam contour data</span>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Info Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.4rem 0.75rem',
                marginBottom: '0.5rem',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                flexShrink: 0,
            }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                    {camType === 'rotary' ? '⟲ Rotary Cam' : '⟶ Linear Cam'}
                </span>
                <span style={{ color: paColor(data.max_pressure_angle) }}>
                    μ<sub>max</sub>: <strong>{data.max_pressure_angle.toFixed(1)}{au}</strong>
                </span>
                <span style={{ color: data.min_curvature_radius < 5 ? '#ef4444' : '#94a3b8' }}>
                    ρ<sub>min</sub>: <strong>{lf(data.min_curvature_radius).toFixed(2)}</strong> {lu}
                </span>
                {camType === 'linear' && linearData && (
                    <span style={{ color: '#64748b' }}>
                        L: <strong>{lf(linearData.cam_length).toFixed(0)}</strong> {lu}
                    </span>
                )}
                <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showPressureAngle}
                        onChange={e => setShowPressureAngle(e.target.checked)}
                        style={{ accentColor: '#3b82f6' }}
                    />
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Pressure Angle</span>
                </label>
            </div>

            {/* Canvas */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {camType === 'rotary' && rotaryData ? (
                    <RotaryView data={rotaryData} baseRadius={baseRadius} showPA={showPressureAngle} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} />
                ) : linearData ? (
                    <LinearView data={linearData} showPA={showPressureAngle} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} lu={lu} lf={lf} />
                ) : null}

                {/* Hover tooltip */}
                {hoverIdx !== null && (() => {
                    const pts = camType === 'rotary' ? rotaryData?.points : linearData?.points;
                    if (!pts || !pts[hoverIdx]) return null;
                    const p = pts[hoverIdx];
                    return (
                        <div style={{
                            position: 'absolute', top: 8, right: 8,
                            background: 'rgba(15,23,42,0.92)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '6px', padding: '0.5rem 0.75rem',
                            fontSize: '0.75rem', color: '#e2e8f0',
                            fontVariantNumeric: 'tabular-nums',
                            pointerEvents: 'none',
                        }}>
                            <div style={{ color: '#94a3b8', marginBottom: '0.2rem', fontWeight: 600 }}>
                                φ = {(unitSystem.angle === 'rad' ? convertAngle(p.angle_deg, 'deg', 'rad') : p.angle_deg).toFixed(unitSystem.angle === 'rad' ? 3 : 1)}{au}
                                {camType === 'linear' && 'x' in p && ` | x = ${lf((p as any).x).toFixed(1)} ${lu}`}
                            </div>
                            <div>s = {lf(p.s).toFixed(3)} {lu}</div>
                            <div>μ = <span style={{ color: paColor(p.pressure_angle) }}>{p.pressure_angle.toFixed(2)}{au}</span></div>
                            <div>ρ = {lf(p.curvature_radius).toFixed(2)} {lu}</div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

// ─── Rotary (Disc) Cam SVG ──────────────────────────────────

interface RotaryViewProps {
    data: CamContourData;
    baseRadius: number;
    showPA: boolean;
    hoverIdx: number | null;
    setHoverIdx: (v: number | null) => void;
}

const RotaryView: React.FC<RotaryViewProps> = ({ data, baseRadius, showPA, hoverIdx, setHoverIdx }) => {
    const svg = useMemo(() => {
        const xs = data.points.map(p => p.x);
        const ys = data.points.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const range = Math.max(maxX - minX, maxY - minY) * 1.2;
        const size = 400;
        const s = size / range;
        const ox = cx - range / 2, oy = cy - range / 2;

        // SVG Y-axis is inverted (down = positive), cam Y-axis is math-standard (up = positive)
        const pts = data.points.map(p => ({
            sx: (p.x - ox) * s,
            sy: size - (p.y - oy) * s, // Flip Y
        }));
        let path = `M ${pts[0].sx} ${pts[0].sy}`;
        for (let i = 1; i < pts.length; i++) path += ` L ${pts[i].sx} ${pts[i].sy}`;
        path += ' Z';

        const bcx = (0 - ox) * s;
        const bcy = size - (0 - oy) * s; // Flip Y for center
        const br = baseRadius * s;
        const bPath = `M ${bcx + br} ${bcy} A ${br} ${br} 0 1 1 ${bcx - br} ${bcy} A ${br} ${br} 0 1 1 ${bcx + br} ${bcy}`;

        return { path, basePath: bPath, center: { x: bcx, y: bcy }, pts, s, ox, oy };
    }, [data, baseRadius]);

    return (
        <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%' }}
            onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mx = ((e.clientX - rect.left) / rect.width) * 400;
                const my = ((e.clientY - rect.top) / rect.height) * 400;
                let minD = Infinity, best = -1;
                svg.pts.forEach((p, i) => {
                    const d = (mx - p.sx) ** 2 + (my - p.sy) ** 2;
                    if (d < minD) { minD = d; best = i; }
                });
                setHoverIdx(best >= 0 && Math.sqrt(minD) < 50 ? best : null);
            }}
            onMouseLeave={() => setHoverIdx(null)}
        >
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.1)" rx="8" />
            {/* Center */}
            <line x1={svg.center.x - 8} y1={svg.center.y} x2={svg.center.x + 8} y2={svg.center.y} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
            <line x1={svg.center.x} y1={svg.center.y - 8} x2={svg.center.x} y2={svg.center.y + 8} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
            {/* Base Circle */}
            <path d={svg.basePath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
            {/* Contour */}
            <path d={svg.path} fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
            {/* PA dots */}
            {showPA && svg.pts.filter((_, i) => i % 10 === 0).map((p, i) => (
                <circle key={i} cx={p.sx} cy={p.sy} r={2} fill={paColor(data.points[i * 10]?.pressure_angle ?? 0)} opacity={0.6} />
            ))}
            {/* Hover */}
            {hoverIdx !== null && svg.pts[hoverIdx] && (
                <g>
                    <circle cx={svg.pts[hoverIdx].sx} cy={svg.pts[hoverIdx].sy} r={5} fill="none" stroke="#fff" strokeWidth="1.5" />
                    <circle cx={svg.pts[hoverIdx].sx} cy={svg.pts[hoverIdx].sy} r={2} fill="#3b82f6" />
                </g>
            )}
        </svg>
    );
};

// ─── Linear (Plate) Cam SVG ──────────────────────────────────

interface LinearViewProps {
    data: LinearCamContourData;
    showPA: boolean;
    hoverIdx: number | null;
    setHoverIdx: (v: number | null) => void;
    lu: string;
    lf: (v: number) => number;
}

const LinearView: React.FC<LinearViewProps> = ({ data, showPA, hoverIdx, setHoverIdx, lu, lf }) => {
    const svg = useMemo(() => {
        const pts = data.points;
        const maxY = Math.max(...pts.map(p => p.y_upper), ...pts.map(p => Math.abs(p.y_lower)));
        const pad = 30;
        const w = 800, h = 400;
        const plotW = w - 2 * pad;
        const plotH = h - 2 * pad;
        const yRange = maxY * 1.3;
        const xScale = plotW / data.cam_length;
        const yScale = plotH / yRange;

        // Upper contour path
        let upperPath = `M ${pad + pts[0].x * xScale} ${h - pad - pts[0].y_upper * yScale}`;
        for (let i = 1; i < pts.length; i++) {
            upperPath += ` L ${pad + pts[i].x * xScale} ${h - pad - pts[i].y_upper * yScale}`;
        }

        // Lower contour path (groove)
        let lowerPath = '';
        const hasGroove = pts.some(p => p.y_lower !== 0);
        if (hasGroove) {
            lowerPath = `M ${pad + pts[0].x * xScale} ${h - pad - pts[0].y_lower * yScale}`;
            for (let i = 1; i < pts.length; i++) {
                lowerPath += ` L ${pad + pts[i].x * xScale} ${h - pad - pts[i].y_lower * yScale}`;
            }
        }

        // Baseline (y=0)
        const baseY = h - pad;

        // Screen coordinates for each point
        const screenPts = pts.map(p => ({
            sx: pad + p.x * xScale,
            sy: h - pad - p.y_upper * yScale,
        }));

        return { upperPath, lowerPath, hasGroove, baseY, screenPts, w, h, pad, xScale, yScale };
    }, [data]);

    return (
        <svg viewBox={`0 0 ${svg.w} ${svg.h}`} style={{ width: '100%', height: '100%' }}
            onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mx = ((e.clientX - rect.left) / rect.width) * svg.w;
                let minD = Infinity, best = -1;
                svg.screenPts.forEach((p, i) => {
                    const d = Math.abs(mx - p.sx);
                    if (d < minD) { minD = d; best = i; }
                });
                setHoverIdx(best >= 0 && minD < 20 ? best : null);
            }}
            onMouseLeave={() => setHoverIdx(null)}
        >
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.1)" rx="8" />

            {/* Grid lines */}
            {Array.from({ length: 7 }, (_, i) => {
                const x = svg.pad + (i / 6) * (svg.w - 2 * svg.pad);
                return <line key={`gx-${i}`} x1={x} y1={svg.pad} x2={x} y2={svg.h - svg.pad} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
            })}
            {Array.from({ length: 5 }, (_, i) => {
                const y = svg.pad + (i / 4) * (svg.h - 2 * svg.pad);
                return <line key={`gy-${i}`} x1={svg.pad} y1={y} x2={svg.w - svg.pad} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
            })}

            {/* Baseline */}
            <line x1={svg.pad} y1={svg.baseY} x2={svg.w - svg.pad} y2={svg.baseY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />

            {/* Cam plate outline */}
            <rect x={svg.pad} y={svg.baseY} width={svg.w - 2 * svg.pad} height={4} fill="rgba(255,255,255,0.08)" rx="1" />

            {/* Upper contour */}
            <path d={svg.upperPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" />

            {/* Lower contour (groove) */}
            {svg.hasGroove && (
                <path d={svg.lowerPath} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="6 3" strokeLinejoin="round" />
            )}

            {/* Fill between upper contour and baseline */}
            <path d={`${svg.upperPath} L ${svg.screenPts[svg.screenPts.length - 1].sx} ${svg.baseY} L ${svg.screenPts[0].sx} ${svg.baseY} Z`}
                fill="rgba(59,130,246,0.06)" />

            {/* PA dots */}
            {showPA && svg.screenPts.filter((_, i) => i % 10 === 0).map((p, i) => (
                <circle key={i} cx={p.sx} cy={p.sy} r={2.5}
                    fill={paColor(data.points[i * 10]?.pressure_angle ?? 0)} opacity={0.7} />
            ))}

            {/* Hover line + dot */}
            {hoverIdx !== null && svg.screenPts[hoverIdx] && (
                <g>
                    <line x1={svg.screenPts[hoverIdx].sx} y1={svg.pad} x2={svg.screenPts[hoverIdx].sx} y2={svg.h - svg.pad}
                        stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 3" />
                    <circle cx={svg.screenPts[hoverIdx].sx} cy={svg.screenPts[hoverIdx].sy} r={5} fill="none" stroke="#fff" strokeWidth="1.5" />
                    <circle cx={svg.screenPts[hoverIdx].sx} cy={svg.screenPts[hoverIdx].sy} r={2} fill="#3b82f6" />
                </g>
            )}

            {/* X-axis labels */}
            <text x={svg.pad} y={svg.h - 8} fill="#64748b" fontSize="10" textAnchor="start">0 {lu}</text>
            <text x={svg.w - svg.pad} y={svg.h - 8} fill="#64748b" fontSize="10" textAnchor="end">{lf(data.cam_length).toFixed(1)} {lu}</text>
            <text x={svg.w / 2} y={svg.h - 8} fill="#64748b" fontSize="10" textAnchor="middle">{lf(data.cam_length / 2).toFixed(0)} {lu}</text>

            {/* Y-axis label */}
            <text x={14} y={svg.h / 2} fill="#64748b" fontSize="9" textAnchor="middle" transform={`rotate(-90, 14, ${svg.h / 2})`}>
                displacement ({lu})
            </text>
        </svg>
    );
};
