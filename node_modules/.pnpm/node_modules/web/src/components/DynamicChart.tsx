import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea
} from 'recharts';
import type { DynamicResult } from '../contexts/AppContext';
import type { SegmentBoundary } from './KinematicChart';
import { useAppContext } from '../contexts/AppContext';

interface DynamicChartProps {
  data: DynamicResult;
  segmentBoundaries: SegmentBoundary[];
}

export const DynamicChart: React.FC<DynamicChartProps> = ({ data, segmentBoundaries }) => {
  const { rpm } = useAppContext();

  const chartData = useMemo(() => {
    if (!data || !data.points) return [];
    return data.points.map(p => ({
      angle: p.angle_deg,
      totalAxialForce: p.total_axial_force,
      normalForce: p.normal_force,
      camTorque: p.cam_torque,
      hertzPressure: p.hertz_pressure,
    }));
  }, [data]);

  // If RPM is 0, we can't really do dynamic analysis properly (forces are only spring)
  if (rpm === 0) {
    return (
      <div className="chart-placeholder" style={{ height: '100%' }}>
        <h3>Dynamic Analysis Requires RPM &gt; 0</h3>
        <p>Please set the Cam RPM in the Sidebar to compute inertial forces.</p>
      </div>
    );
  }

  const renderBackgroundSegments = () => {
    return null; // Removed to prevent Recharts syncId/ReferenceArea loop bugs
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="label" style={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
            {label.toFixed(1)}°
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color, margin: 0, fontSize: '0.85rem' }}>
              {entry.name}: {Number(entry.value).toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-grid">
      {/* Forces */}
      <div className="chart-container glass-panel">
        <h4 className="chart-title">Forces (N)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="angle" type="number" domain={[0, 360]} ticks={[0, 90, 180, 270, 360]} stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
            <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} width={50} />
            <Tooltip content={<CustomTooltip />} />
            {renderBackgroundSegments()}
            <Line type="monotone" dataKey="totalAxialForce" name="Axial Force" stroke="#00E5FF" dot={false} strokeWidth={2} isAnimationActive={false} filter="url(#glow)" />
            <Line type="monotone" dataKey="normalForce" name="Normal Force" stroke="#8b5cf6" dot={false} strokeWidth={2} isAnimationActive={false} filter="url(#glow)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Torque */}
      <div className="chart-container glass-panel">
        <h4 className="chart-title">Cam Torque (Nm)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="angle" type="number" domain={[0, 360]} ticks={[0, 90, 180, 270, 360]} stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
            <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} width={50} />
            <Tooltip content={<CustomTooltip />} />
            {renderBackgroundSegments()}
            <Line type="monotone" dataKey="camTorque" name="Torque" stroke="#10b981" dot={false} strokeWidth={2} isAnimationActive={false} filter="url(#glow)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Hertz Pressure */}
      <div className="chart-container glass-panel">
        <h4 className="chart-title">Hertz Pressure (MPa)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="angle" type="number" domain={[0, 360]} ticks={[0, 90, 180, 270, 360]} stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
            <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} width={50} />
            <Tooltip content={<CustomTooltip />} />
            {renderBackgroundSegments()}
            <Line type="monotone" dataKey="hertzPressure" name="Contact Pressure" stroke="#f43f5e" dot={false} strokeWidth={2} isAnimationActive={false} filter="url(#glow)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
