import React, { useMemo } from 'react';
import type { MotionPoint } from './KinematicChart';
import type { SegmentDef } from './SegmentEditor';

interface ContinuityCheckProps {
  data: MotionPoint[];
  segments: SegmentDef[];
}

interface BoundaryResult {
  angle: number;
  leftName: string;
  rightName: string;
  deltaS: number;
  deltaV: number;
  deltaA: number;
}

const THRESHOLD_S = 0.01;  // mm
const THRESHOLD_V = 0.05;  // mm/rad
const THRESHOLD_A = 0.5;   // mm/rad²

function statusColor(delta: number, threshold: number): string {
  const abs = Math.abs(delta);
  if (abs < threshold) return '#10b981';      // green = OK
  if (abs < threshold * 5) return '#f59e0b';  // yellow = warning
  return '#ef4444';                             // red = discontinuity
}

function statusIcon(delta: number, threshold: number): string {
  const abs = Math.abs(delta);
  if (abs < threshold) return '✓';
  if (abs < threshold * 5) return '⚠';
  return '✗';
}

export const ContinuityCheck: React.FC<ContinuityCheckProps> = ({ data, segments }) => {
  const results = useMemo<BoundaryResult[]>(() => {
    if (data.length === 0 || segments.length < 2) return [];

    const totalPoints = data.length;
    const boundaries: BoundaryResult[] = [];

    for (let i = 0; i < segments.length - 1; i++) {
      const left = segments[i];
      const right = segments[i + 1];
      const angle = left.phi_end;

      // Map angle to data index
      const idx = Math.round((angle / 360) * (totalPoints - 1));
      if (idx <= 0 || idx >= totalPoints) continue;

      const pLeft = data[idx - 1] || data[idx];
      const pRight = data[idx];

      boundaries.push({
        angle,
        leftName: left.name,
        rightName: right.name,
        deltaS: Math.abs(pRight.s - pLeft.s),
        deltaV: Math.abs(pRight.v - pLeft.v),
        deltaA: Math.abs(pRight.a - pLeft.a),
      });
    }

    // Cyclic continuity check (end -> start)
    if (data.length > 0 && segments.length > 0) {
      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];
      
      // If the profile roughly covers a full cycle (e.g. 360 degrees)
      if (Math.abs(lastSegment.phi_end - firstSegment.phi_start - 360) < 1.0) {
        const pFirst = data[0];
        const pLast = data[data.length - 1];
        boundaries.push({
          angle: 360,
          leftName: lastSegment.name,
          rightName: firstSegment.name + ' (Cycle)',
          deltaS: Math.abs(pFirst.s - pLast.s),
          deltaV: Math.abs(pFirst.v - pLast.v),
          deltaA: Math.abs(pFirst.a - pLast.a),
        });
      }
    }
    return boundaries;
  }, [data, segments]);

  if (results.length === 0) return null;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>
        Continuity
      </div>
      {results.map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.2rem 0', fontSize: '0.7rem',
          borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        }}>
          <span style={{ color: 'var(--text-secondary)', minWidth: '35px' }}>{r.angle}°</span>
          <span style={{ color: statusColor(r.deltaS, THRESHOLD_S), fontFamily: 'monospace' }} title={`ΔS = ${r.deltaS.toFixed(4)}`}>
            {statusIcon(r.deltaS, THRESHOLD_S)} C0
          </span>
          <span style={{ color: statusColor(r.deltaV, THRESHOLD_V), fontFamily: 'monospace' }} title={`ΔV = ${r.deltaV.toFixed(4)}`}>
            {statusIcon(r.deltaV, THRESHOLD_V)} C1
          </span>
          <span style={{ color: statusColor(r.deltaA, THRESHOLD_A), fontFamily: 'monospace' }} title={`ΔA = ${r.deltaA.toFixed(4)}`}>
            {statusIcon(r.deltaA, THRESHOLD_A)} C2
          </span>
          <span style={{ color: '#64748b', fontSize: '0.6rem', marginLeft: 'auto' }}>
            {r.leftName}→{r.rightName}
          </span>
        </div>
      ))}
    </div>
  );
};
