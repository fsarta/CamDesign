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
        // Normalizing index to represent tau (0 to 1) roughly
        const tau = index / (Math.max(1, data.length - 1));
        return {
            tau: tau.toFixed(2),
            position: Number(point.s.toFixed(4)),
            velocity: Number(point.v.toFixed(4)),
            acceleration: Number(point.a.toFixed(4)),
            jerk: Number(point.j.toFixed(4)),
        };
    });

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="glass-panel" style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#f8fafc' }}>τ: {label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={`item-${index}`} style={{ margin: '0.25rem 0 0 0', color: entry.color, fontSize: '0.9rem' }}>
                            {entry.name}: {entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Upper Charts: S and V */}
            <div style={{ display: 'flex', flex: 1, gap: '1rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <h4 style={{ position: 'absolute', top: 0, left: 20, zIndex: 10, fontSize: '0.8rem', color: '#94a3b8' }}>Position (s)</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="tau" stroke="rgba(255,255,255,0.3)" tick={{ fill: '#94a3b8' }} />
                            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: '#94a3b8' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="position" stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={true} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                    <h4 style={{ position: 'absolute', top: 0, left: 20, zIndex: 10, fontSize: '0.8rem', color: '#94a3b8' }}>Velocity (v)</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="tau" stroke="rgba(255,255,255,0.3)" tick={{ fill: '#94a3b8' }} />
                            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: '#94a3b8' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="velocity" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={true} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Lower Charts: A and J */}
            <div style={{ display: 'flex', flex: 1, gap: '1rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <h4 style={{ position: 'absolute', top: 0, left: 20, zIndex: 10, fontSize: '0.8rem', color: '#94a3b8' }}>Acceleration (a)</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="tau" stroke="rgba(255,255,255,0.3)" tick={{ fill: '#94a3b8' }} />
                            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: '#94a3b8' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="acceleration" stroke="#f59e0b" strokeWidth={3} dot={false} isAnimationActive={true} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                    <h4 style={{ position: 'absolute', top: 0, left: 20, zIndex: 10, fontSize: '0.8rem', color: '#94a3b8' }}>Jerk (j)</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="tau" stroke="rgba(255,255,255,0.3)" tick={{ fill: '#94a3b8' }} />
                            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: '#94a3b8' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="jerk" stroke="#ef4444" strokeWidth={3} dot={false} isAnimationActive={true} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
};
