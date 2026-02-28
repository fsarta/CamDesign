import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

export interface MotionPoint {
    s: number;
    v: number;
    a: number;
    j: number;
}

interface KinematicChartProps {
    data: MotionPoint[];
}

export const KinematicChart: React.FC<KinematicChartProps> = ({ data }) => {
    // Convert basic points into a format Recharts likes
    const chartData = data.map((point, index) => {
        // Map index to angle in degrees (0 to 360)
        const angle = (index / (Math.max(1, data.length - 1))) * 360;
        return {
            angle: Math.round(angle),
            position: Number(point.s.toFixed(4)),
            velocity: Number(point.v.toFixed(4)),
            acceleration: Number(point.a.toFixed(4)),
            jerk: Number(point.j.toFixed(4)),
        };
    });

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="glass-panel" style={{ padding: '0.75rem', border: '1px solid rgba(255,255,255,0.2)', minWidth: '100px' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>φ: {label}°</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={`item-${index}`} style={{ margin: '0.15rem 0 0 0', color: entry.color, fontSize: '0.8rem' }}>
                            {entry.name}: {entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const chartConfig = [
        { key: 'position', label: 'Position (s)', color: '#3b82f6' },
        { key: 'velocity', label: 'Velocity (v)', color: '#10b981' },
        { key: 'acceleration', label: 'Acceleration (a)', color: '#f59e0b' },
        { key: 'jerk', label: 'Jerk (j)', color: '#ef4444' },
    ];

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: '0.5rem',
        }}>
            {chartConfig.map(cfg => (
                <div key={cfg.key} style={{ position: 'relative', minHeight: 0, minWidth: 0 }}>
                    <h4 style={{
                        position: 'absolute', top: 4, left: 16, zIndex: 10,
                        fontSize: '0.75rem', color: '#94a3b8', margin: 0,
                    }}>{cfg.label}</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis
                                dataKey="angle"
                                stroke="rgba(255,255,255,0.3)"
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickCount={7}
                            />
                            <YAxis
                                stroke="rgba(255,255,255,0.3)"
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                width={45}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                                type="monotone"
                                dataKey={cfg.key}
                                stroke={cfg.color}
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ))}
        </div>
    );
};
