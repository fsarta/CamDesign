import React, { useMemo, useState } from 'react';

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

interface CamContourChartProps {
    data: CamContourData;
    baseRadius: number;
}

export const CamContourChart: React.FC<CamContourChartProps> = ({ data, baseRadius }) => {
    const [showPressureAngle, setShowPressureAngle] = useState(false);
    const [hoverAngle, setHoverAngle] = useState<number | null>(null);

    // Compute SVG path and viewport
    const { path, basePath, viewBox, center, scale } = useMemo(() => {
        if (data.points.length === 0) {
            return { path: '', basePath: '', viewBox: '0 0 200 200', center: { x: 100, y: 100 }, scale: 1 };
        }

        const xs = data.points.map(p => p.x);
        const ys = data.points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const range = Math.max(rangeX, rangeY) * 1.2;

        const svgSize = 400;
        const s = svgSize / range;
        const vbMinX = cx - range / 2;
        const vbMinY = cy - range / 2;

        // Cam contour path
        const pts = data.points.map(p => ({
            sx: (p.x - vbMinX) * s,
            sy: (p.y - vbMinY) * s,
        }));

        let d = `M ${pts[0].sx} ${pts[0].sy}`;
        for (let i = 1; i < pts.length; i++) {
            d += ` L ${pts[i].sx} ${pts[i].sy}`;
        }
        d += ' Z';

        // Base circle path
        const bcx = (0 - vbMinX) * s;
        const bcy = (0 - vbMinY) * s;
        const br = baseRadius * s;
        const bPath = `M ${bcx + br} ${bcy} A ${br} ${br} 0 1 1 ${bcx - br} ${bcy} A ${br} ${br} 0 1 1 ${bcx + br} ${bcy}`;

        return {
            path: d,
            basePath: bPath,
            viewBox: `0 0 ${svgSize} ${svgSize}`,
            center: { x: bcx, y: bcy },
            scale: s,
        };
    }, [data, baseRadius]);

    // Pressure angle color (green < 30°, yellow 30-40°, red > 40°)
    const paColor = (pa: number) => {
        const abs = Math.abs(pa);
        if (abs < 30) return '#10b981';
        if (abs < 40) return '#f59e0b';
        return '#ef4444';
    };

    const hoveredPoint = useMemo(() => {
        if (hoverAngle === null) return null;
        return data.points.find(p => Math.round(p.angle_deg) === hoverAngle) || null;
    }, [hoverAngle, data.points]);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Cam Info Header */}
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
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Cam Contour</span>
                <span style={{ color: paColor(data.max_pressure_angle) }}>
                    μ<sub>max</sub>: <strong>{data.max_pressure_angle.toFixed(1)}°</strong>
                </span>
                <span style={{ color: data.min_curvature_radius < 5 ? '#ef4444' : '#94a3b8' }}>
                    ρ<sub>min</sub>: <strong>{data.min_curvature_radius.toFixed(2)}</strong> mm
                </span>
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

            {/* SVG Canvas */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                <svg
                    viewBox={viewBox}
                    style={{ width: '100%', height: '100%' }}
                    onMouseMove={e => {
                        const svg = e.currentTarget;
                        const rect = svg.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 400;
                        const y = ((e.clientY - rect.top) / rect.height) * 400;
                        // Find nearest point
                        let minDist = Infinity;
                        let nearest = -1;
                        data.points.forEach((p, i) => {
                            const px = (p.x - 0) * scale + 200;
                            const py = (p.y - 0) * scale + 200;
                            const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
                            if (dist < minDist) {
                                minDist = dist;
                                nearest = i;
                            }
                        });
                        if (nearest >= 0 && minDist < 30) {
                            setHoverAngle(Math.round(data.points[nearest].angle_deg));
                        } else {
                            setHoverAngle(null);
                        }
                    }}
                    onMouseLeave={() => setHoverAngle(null)}
                >
                    {/* Background */}
                    <rect width="100%" height="100%" fill="rgba(0,0,0,0.1)" rx="8" />

                    {/* Center crosshair */}
                    <line x1={center.x - 8} y1={center.y} x2={center.x + 8} y2={center.y}
                        stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
                    <line x1={center.x} y1={center.y - 8} x2={center.x} y2={center.y + 8}
                        stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />

                    {/* Base Circle */}
                    <path d={basePath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />

                    {/* Cam Contour */}
                    <path
                        d={path}
                        fill="rgba(59, 130, 246, 0.08)"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeLinejoin="round"
                    />

                    {/* Pressure angle visualization */}
                    {showPressureAngle && data.points.filter((_, i) => i % 10 === 0).map((p, i) => {
                        const pts = data.points;
                        const idx = pts.indexOf(p);
                        if (idx < 0) return null;
                        const sx = (p.x - (parseFloat(viewBox.split(' ')[0]) || 0) / scale) * scale;
                        const sy = (p.y - (parseFloat(viewBox.split(' ')[1]) || 0) / scale) * scale;
                        return (
                            <circle
                                key={i}
                                cx={sx}
                                cy={sy}
                                r={2}
                                fill={paColor(p.pressure_angle)}
                                opacity={0.6}
                            />
                        );
                    })}

                    {/* Hover point */}
                    {hoveredPoint && (() => {
                        const vb = viewBox.split(' ').map(Number);
                        const sx = (hoveredPoint.x - vb[0] / scale) * scale;
                        const sy = (hoveredPoint.y - vb[1] / scale) * scale;
                        return (
                            <g>
                                <circle cx={sx} cy={sy} r={5} fill="none" stroke="#fff" strokeWidth="1.5" />
                                <circle cx={sx} cy={sy} r={2} fill="#3b82f6" />
                            </g>
                        );
                    })()}
                </svg>

                {/* Hover tooltip */}
                {hoveredPoint && (
                    <div style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'rgba(15,23,42,0.9)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.75rem',
                        color: '#e2e8f0',
                        fontVariantNumeric: 'tabular-nums',
                    }}>
                        <div style={{ color: '#94a3b8', marginBottom: '0.25rem', fontWeight: 600 }}>
                            φ = {hoveredPoint.angle_deg.toFixed(1)}°
                        </div>
                        <div>s = {hoveredPoint.s.toFixed(3)} mm</div>
                        <div>μ = <span style={{ color: paColor(hoveredPoint.pressure_angle) }}>{hoveredPoint.pressure_angle.toFixed(2)}°</span></div>
                        <div>ρ = {hoveredPoint.curvature_radius.toFixed(2)} mm</div>
                    </div>
                )}
            </div>
        </div>
    );
};
