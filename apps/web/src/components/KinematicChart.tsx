import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ResponsiveContainer
} from 'recharts';
import type { UnitSystem } from '../units';
import {
    lengthLabel, angleLabel, velocityLabel, accelerationLabel, jerkLabel,
    displacementFactor, velocityFactor, accelerationFactor, jerkFactor,
    convertAngle, DEFAULT_UNITS,
} from '../units';

export interface MotionPoint {
    s: number;
    v: number;
    a: number;
    j: number;
}

export interface SegmentBoundary {
    phi_start: number;
    phi_end: number;
    name: string;
    color: string;
}

export type ChartLayout = 'vertical' | 'grid';

interface KinematicChartProps {
    data: MotionPoint[];
    layout?: ChartLayout;
    segmentBoundaries?: SegmentBoundary[];
    unitSystem?: UnitSystem;
}

// Chart config is now generated dynamically based on units

// Shared sync ID for Recharts native cursor synchronization
const SYNC_ID = 'motus-kinematic-sync';

// Custom cursor line that renders a smooth vertical line following the mouse
const SyncCursorLine = (props: any) => {
    const { points, height } = props;
    if (!points || points.length === 0) return null;
    const x = points[0].x;
    return (
        <line
            x1={x} y1={0}
            x2={x} y2={height}
            stroke="rgba(255, 255, 255, 0.5)"
            strokeWidth={1}
            strokeDasharray="3 3"
        />
    );
};

// Custom invisible Tooltip content that captures active data for the info bar
const DataCapture = ({ active, payload, label, onCapture }: any) => {
    useEffect(() => {
        if (active && payload && payload.length > 0) {
            onCapture({
                angle: label,
                position: payload[0]?.payload?.position,
                velocity: payload[0]?.payload?.velocity,
                acceleration: payload[0]?.payload?.acceleration,
                jerk: payload[0]?.payload?.jerk,
            });
        }
    }, [active, payload, label, onCapture]);
    return null; // Tooltip renders nothing — info bar handles display
};

export const KinematicChart: React.FC<KinematicChartProps> = ({
    data,
    layout = 'vertical',
    segmentBoundaries = [],
    unitSystem = DEFAULT_UNITS,
}) => {
    const [activeData, setActiveData] = useState<Record<string, any> | null>(null);

    // Dynamic chart config based on current units
    const CHART_CONFIG = useMemo(() => [
        { key: 'position', label: 'Position (s)', color: '#3b82f6', unit: lengthLabel(unitSystem.length) },
        { key: 'velocity', label: 'Velocity (v)', color: '#10b981', unit: velocityLabel(unitSystem) },
        { key: 'acceleration', label: 'Acceleration (a)', color: '#f59e0b', unit: accelerationLabel(unitSystem) },
        { key: 'jerk', label: 'Jerk (j)', color: '#ef4444', unit: jerkLabel(unitSystem) },
    ], [unitSystem]);

    // Stable callback for DataCapture
    const handleCapture = useCallback((d: Record<string, any>) => {
        setActiveData(d);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setActiveData(null);
    }, []);

    // Conversion factors for WASM output (mm, rad) → display units
    const sFactor = displacementFactor(unitSystem);
    const vFactor = velocityFactor(unitSystem);
    const aFactor = accelerationFactor(unitSystem);
    const jFactor = jerkFactor(unitSystem);

    // Convert data to Recharts format with unit conversion
    const chartData = useMemo(() => data.map((point, index) => {
        const angle = (index / (Math.max(1, data.length - 1))) * 360;
        const displayAngle = unitSystem.angle === 'rad'
            ? convertAngle(angle, 'deg', 'rad')
            : angle;
        return {
            angle: Number(displayAngle.toFixed(unitSystem.angle === 'rad' ? 4 : 1)),
            position: Number((point.s * sFactor).toFixed(4)),
            velocity: Number((point.v * vFactor).toFixed(4)),
            acceleration: Number((point.a * aFactor).toFixed(4)),
            jerk: Number((point.j * jFactor).toFixed(4)),
        };
    }), [data, sFactor, vFactor, aFactor, jFactor, unitSystem.angle]);

    const boundaryAngles = useMemo(() => {
        const angles = new Set<number>();
        segmentBoundaries.forEach(b => {
            const start = unitSystem.angle === 'rad' ? convertAngle(b.phi_start, 'deg', 'rad') : b.phi_start;
            const end = unitSystem.angle === 'rad' ? convertAngle(b.phi_end, 'deg', 'rad') : b.phi_end;
            const maxAngle = unitSystem.angle === 'rad' ? convertAngle(360, 'deg', 'rad') : 360;
            if (start > 0) angles.add(Number(start.toFixed(4)));
            if (end < maxAngle) angles.add(Number(end.toFixed(4)));
        });
        return Array.from(angles);
    }, [segmentBoundaries, unitSystem.angle]);

    const isVertical = layout === 'vertical';

    const containerStyle: React.CSSProperties = isVertical
        ? { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '2px' }
        : { width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '0.5rem' };

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* Unified Cursor Info Panel */}
            <div className="cursor-info-bar" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                padding: '0.4rem 0.75rem',
                marginBottom: '0.5rem',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontVariantNumeric: 'tabular-nums',
                minHeight: '28px',
                flexShrink: 0,
            }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                    φ = {activeData !== null ? `${activeData.angle}${angleLabel(unitSystem.angle)}` : '—'}
                </span>
                {activeData && CHART_CONFIG.map(cfg => (
                    <span key={cfg.key} style={{ color: cfg.color }}>
                        {cfg.label.split(' ')[0]}:{' '}
                        <strong>{activeData[cfg.key]?.toFixed?.(3) ?? activeData[cfg.key]}</strong>
                        <span style={{ opacity: 0.5, fontSize: '0.7rem', marginLeft: '2px' }}>{cfg.unit}</span>
                    </span>
                ))}
                {!activeData && (
                    <span style={{ color: '#475569', fontStyle: 'italic' }}>Hover on a chart to see values</span>
                )}
            </div>

            {/* Charts — all share syncId for pixel-perfect cursor sync */}
            <div style={{ ...containerStyle, flex: 1, minHeight: 0 }}>
                {CHART_CONFIG.map((cfg, chartIdx) => {
                    const isLastChart = chartIdx === CHART_CONFIG.length - 1;
                    const showXAxis = isVertical ? isLastChart : true;

                    return (
                        <div key={cfg.key} style={{
                            position: 'relative',
                            minHeight: 0,
                            minWidth: 0,
                            flex: isVertical ? 1 : undefined,
                        }}>
                            {/* Chart Label */}
                            <div style={{
                                position: 'absolute',
                                top: isVertical ? 2 : 4,
                                left: 56,
                                zIndex: 10,
                                fontSize: '0.7rem',
                                color: cfg.color,
                                fontWeight: 600,
                                letterSpacing: '0.5px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                            }}>
                                <div style={{
                                    width: 8, height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: cfg.color,
                                    opacity: 0.6,
                                }} />
                                {cfg.label}
                            </div>

                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={chartData}
                                    syncId={SYNC_ID}
                                    margin={{
                                        top: isVertical ? 16 : 20,
                                        right: 10,
                                        left: 0,
                                        bottom: showXAxis ? 0 : -20,
                                    }}
                                    onMouseLeave={handleMouseLeave}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="rgba(255,255,255,0.06)"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="angle"
                                        stroke="rgba(255,255,255,0.2)"
                                        tick={showXAxis ? { fill: '#64748b', fontSize: 10 } : false}
                                        tickLine={showXAxis}
                                        axisLine={showXAxis}
                                        tickCount={isVertical ? 13 : 7}
                                    />
                                    <YAxis
                                        stroke="rgba(255,255,255,0.2)"
                                        tick={{ fill: '#64748b', fontSize: 9 }}
                                        width={50}
                                        tickFormatter={(v: number) => v.toFixed(1)}
                                    />

                                    {/* Invisible tooltip that captures active data for the info bar */}
                                    <Tooltip
                                        content={<DataCapture onCapture={handleCapture} />}
                                        cursor={<SyncCursorLine />}
                                        isAnimationActive={false}
                                    />

                                    {/* Segment boundary lines */}
                                    {boundaryAngles.map(angle => (
                                        <ReferenceLine
                                            key={`boundary-${angle}`}
                                            x={angle}
                                            stroke="rgba(255,255,255,0.15)"
                                            strokeDasharray="4 4"
                                            strokeWidth={1}
                                        />
                                    ))}

                                    {/* Data line */}
                                    <Line
                                        type="monotone"
                                        dataKey={cfg.key}
                                        stroke={cfg.color}
                                        strokeWidth={isVertical ? 1.5 : 2}
                                        dot={false}
                                        isAnimationActive={false}
                                        activeDot={{
                                            r: 3,
                                            stroke: cfg.color,
                                            strokeWidth: 2,
                                            fill: '#0f172a',
                                        }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
