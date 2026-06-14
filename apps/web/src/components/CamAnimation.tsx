import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { CamContourData } from './CamContourChart';
import type { MotionPoint } from './KinematicChart';

interface CamAnimationProps {
  camData: CamContourData | null;
  profileData: MotionPoint[];
  baseRadius: number;
  camOffset: number;
  camRollerRadius: number;
}

export const CamAnimation: React.FC<CamAnimationProps> = ({ camData, profileData, baseRadius, camOffset, camRollerRadius }) => {
  const [playing, setPlaying] = useState(false);
  const [angle, setAngle] = useState(0);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Animation loop
  useEffect(() => {
    if (!playing) return;

    const animate = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      setAngle(prev => {
        const next = prev + dt * speed * 60; // degrees per second = speed * 60°/s
        return next >= 360 ? next - 360 : next;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, speed]);

  // Current displacement
  const currentDisplacement = useMemo(() => {
    if (profileData.length === 0) return 0;
    const idx = Math.round((angle / 360) * (profileData.length - 1));
    return profileData[Math.min(idx, profileData.length - 1)]?.s ?? 0;
  }, [angle, profileData]);

  // SVG rendering
  const svg = useMemo(() => {
    if (!camData || camData.points.length === 0) return null;

    const cx = 200, cy = 200;
    const xs = camData.points.map(p => p.x);
    const ys = camData.points.map(p => p.y);
    const maxR = Math.max(Math.max(...xs.map(Math.abs)), Math.max(...ys.map(Math.abs)));
    const scale = 150 / maxR;

    // Cam contour points (with Y flip for SVG)
    const pts = camData.points.map(p => ({
      sx: cx + p.x * scale,
      sy: cy - p.y * scale,
    }));

    let camPath = `M ${pts[0].sx} ${pts[0].sy}`;
    for (let i = 1; i < pts.length; i++) camPath += ` L ${pts[i].sx} ${pts[i].sy}`;
    camPath += ' Z';

    // Base circle
    const br = baseRadius * scale;

    return { camPath, br, scale, cx, cy };
  }, [camData, baseRadius]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAngle(parseFloat(e.target.value));
  }, []);

  if (!svg) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        Recalculate to see animation
      </div>
    );
  }

  // Follower position (Horizontal on the Right)
  const s0 = Math.sqrt(Math.max(0, baseRadius * baseRadius - camOffset * camOffset));
  const alpha_0_rad = s0 > 1e-12 ? Math.atan(camOffset / s0) : 0;
  const alpha_0_deg = alpha_0_rad * 180 / Math.PI;
  
  const followerX = svg.cx + (s0 + currentDisplacement) * svg.scale;
  const followerY = svg.cy + camOffset * svg.scale;
  
  // Roller physical size on screen
  const visualRollerRadius = Math.max(2, camRollerRadius * svg.scale);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.4rem 0.75rem', marginBottom: '0.5rem',
        background: 'rgba(0,0,0,0.25)', borderRadius: '6px',
        fontSize: '0.8rem', flexShrink: 0,
      }}>
        <button
          onClick={() => setPlaying(!playing)}
          style={{
            background: playing ? '#ef4444' : '#10b981',
            color: '#fff', border: 'none', borderRadius: '4px',
            padding: '0.3rem 0.75rem', cursor: 'pointer', fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#94a3b8' }}>
          Speed:
          <input type="range" min={0.1} max={5} step={0.1} value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            style={{ width: '80px', accentColor: '#3b82f6' }} />
          <span style={{ fontVariantNumeric: 'tabular-nums', width: '35px' }}>{speed.toFixed(1)}×</span>
        </label>

        <span style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
          φ = <strong style={{ color: '#e2e8f0' }}>{angle.toFixed(1)}°</strong>
        </span>

        <span style={{ color: '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>
          s = <strong>{currentDisplacement.toFixed(2)}</strong> mm
        </span>

        <input type="range" min={0} max={359.9} step={0.5} value={angle}
          onChange={handleSliderChange}
          style={{ flex: 1, accentColor: '#3b82f6' }} />
      </div>

      {/* Animation canvas */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%' }}>
          <defs>
            <filter id="anim-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#333" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cad-grid)" rx="8" />

          {/* Cam - rotated by current angle */}
          <g transform={`rotate(${angle + alpha_0_deg}, ${svg.cx}, ${svg.cy})`}>
            <path d={svg.camPath} fill="rgba(0, 229, 255, 0.05)" stroke="#00E5FF" strokeWidth="2" strokeLinejoin="round" filter="url(#anim-glow)" />
          </g>

          {/* Base circle (static, for reference) */}
          <circle cx={svg.cx} cy={svg.cy} r={svg.br} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />

          {/* Center mark */}
          <line x1={svg.cx - 6} y1={svg.cy} x2={svg.cx + 6} y2={svg.cy} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
          <line x1={svg.cx} y1={svg.cy - 6} x2={svg.cx} y2={svg.cy + 6} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />

          {/* Follower guide line */}
          <line x1={svg.cx + svg.br} y1={followerY} x2={400} y2={followerY}
            stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3 3" />

          {/* Follower (translating) */}
          <g filter="url(#anim-glow)">
            {/* Follower rod (starts exactly at the roller edge so it doesn't cross inside it) */}
            <line x1={followerX + visualRollerRadius} y1={followerY} x2={followerX + Math.max(60, visualRollerRadius + 20)} y2={followerY}
              stroke="#e6edf3" strokeWidth="3" strokeLinecap="round" />
            {/* Roller */}
            <circle cx={followerX} cy={followerY} r={visualRollerRadius} fill="rgba(255, 255, 255, 0.1)" stroke="#e6edf3" strokeWidth="2" />
          </g>

          {/* Angle arc indicator */}
          {(() => {
            const r = 30;
            const radEnd = -(angle * Math.PI) / 180;
            const ex = svg.cx + r * Math.cos(radEnd);
            const ey = svg.cy + r * Math.sin(radEnd);
            const largeArc = angle > 180 ? 1 : 0;
            return (
              <path
                d={`M ${svg.cx + r} ${svg.cy} A ${r} ${r} 0 ${largeArc} 0 ${ex} ${ey}`}
                fill="none" stroke="#f59e0b" strokeWidth="2" opacity={0.6}
              />
            );
          })()}

          {/* Angle text */}
          <text x={svg.cx + 35} y={svg.cy + 4} fill="#f59e0b" fontSize="10" fontWeight="600">
            {angle.toFixed(0)}°
          </text>
        </svg>
      </div>
    </div>
  );
};
