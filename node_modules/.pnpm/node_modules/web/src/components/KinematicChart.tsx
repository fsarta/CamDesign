import React, { useState, useCallback, useMemo } from 'react';
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
}

const CHART_CONFIG = [
    { key: 'position', label: 'Position (s)', color: '#3b82f6', unit: 'mm' },
    { key: 'velocity', label: 'Velocity (v)', color: '#10b981', unit: 'mm/rad' },
    { key: 'acceleration', label: 'Acceleration (a)', color: '#f59e0b', unit: 'mm/rad²' },
    { key: 'jerk', label: 'Jerk (j)', color: '#ef4444', unit: 'mm/rad³' },
] as const;

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

export const KinematicChart: React.FC<KinematicChartProps> = ({
    data,
    layout = 'vertical',
    segmentBoundaries = [],
}) => {
    const [activeData, setActiveData] = useState<Record<string, any> | null>(null);

    // Convert data to Recharts format — use fractional angle for smooth interpolation
    const chartData = useMemo(() => data.map((point, index) => {
        const angle = (index / (Math.max(1, data.length - 1))) * 360;
        return {
            angle: Number(angle.toFixed(1)),
            position: Number(point.s.toFixed(4)),
            velocity: Number(point.v.toFixed(4)),
            acceleration: Number(point.a.toFixed(4)),
            jerk: Number(point.j.toFixed(4)),
        };
    }), [data]);

    // Handle tooltip activation from any chart — updates info bar
    const handleTooltipUpdate = useCallback((state: any) => {
        if (state?.activePayload && state.activePayload.length > 0) {
            // Find corresponding full data at this index
            const activeLabel = state.activeLabel;
            const idx = chartData.findIndex(d => d.angle === activeLabel);
            if (idx >= 0) {
                setActiveData(chartData[idx]);
            }
        }
    }, [chartData]);

    const handleMouseLeave = useCallback(() => {
        setActiveData(null);
    }, []);

    // Unique boundaries (avoid duplicate lines at shared edges)
    const boundaryAngles = useMemo(() => {
        const angles = new Set<number>();
        segmentBoundaries.forEach(b => {
            if (b.phi_start > 0) angles.add(b.phi_start);
            if (b.phi_end < 360) angles.add(b.phi_end);
        });
        return Array.from(angles);
    }, [segmentBoundaries]);

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
                    φ = {activeData !== null ? `${activeData.angle}°` : '—'}
                </span>
                {activeData && CHART_CONFIG.map(cfg => (
                    <span key={cfg.key} style={{ color: cfg.color }}>
                        {cfg.label.split(' ')[0]}:{' '}
                        <strong>{activeData[cfg.key]}</strong>
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
                                    onMouseMove={handleTooltipUpdate}
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

                                    {/* Tooltip with cursor line — syncId synchronizes across charts */}
                                    <Tooltip
                                        content={() => null}
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
