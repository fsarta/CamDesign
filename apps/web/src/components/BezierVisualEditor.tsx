import React, { useState, useRef } from 'react';

interface BezierVisualEditorProps {
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  onChange: (cx1: number, cy1: number, cx2: number, cy2: number) => void;
}

export const BezierVisualEditor: React.FC<BezierVisualEditorProps> = ({ cx1, cy1, cx2, cy2, onChange }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<'p1' | 'p2' | null>(null);

  // Convert normalized [0,1] coordinates to SVG space [0, 200]
  // Note: Y is flipped in SVG
  const width = 200;
  const height = 200;
  const padding = 20; // internal padding to allow handles to go slightly outside

  const toSvgX = (x: number) => padding + x * (width - 2 * padding);
  const toSvgY = (y: number) => padding + (1 - y) * (height - 2 * padding);

  const fromSvgX = (x: number) => (x - padding) / (width - 2 * padding);
  const fromSvgY = (y: number) => 1 - (y - padding) / (height - 2 * padding);

  const handlePointerDown = (e: React.PointerEvent, point: 'p1' | 'p2') => {
    e.preventDefault();
    setDragging(point);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Constrain X to [0,1] for proper functions, but Y can overshoot (e.g. bounce)
    let newX = Math.max(0, Math.min(1, fromSvgX(x)));
    let newY = fromSvgY(y);

    if (dragging === 'p1') {
      onChange(newX, newY, cx2, cy2);
    } else {
      onChange(cx1, cy1, newX, newY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragging) {
      (e.target as Element).releasePointerCapture(e.pointerId);
      setDragging(null);
    }
  };

  const p0 = { x: toSvgX(0), y: toSvgY(0) };
  const p1 = { x: toSvgX(cx1), y: toSvgY(cy1) };
  const p2 = { x: toSvgX(cx2), y: toSvgY(cy2) };
  const p3 = { x: toSvgX(1), y: toSvgY(1) };

  // Generate path points for the actual curve to draw a smooth line
  let pathD = `M ${p0.x} ${p0.y} `;
  // SVG has native cubic bezier!
  pathD += `C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
      <div 
        style={{ 
          width: '100%', maxWidth: '250px', aspectRatio: '1/1', 
          background: 'rgba(0,0,0,0.2)', borderRadius: '8px', 
          border: '1px solid rgba(255,255,255,0.1)',
          position: 'relative'
        }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          style={{ cursor: dragging ? 'grabbing' : 'crosshair', touchAction: 'none' }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Grid lines */}
          <line x1={toSvgX(0)} y1={toSvgY(0)} x2={toSvgX(1)} y2={toSvgY(0)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={toSvgX(0)} y1={toSvgY(1)} x2={toSvgX(1)} y2={toSvgY(1)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={toSvgX(0)} y1={toSvgY(0)} x2={toSvgX(0)} y2={toSvgY(1)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={toSvgX(1)} y1={toSvgY(0)} x2={toSvgX(1)} y2={toSvgY(1)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />

          {/* Guide lines (P0-P1, P2-P3) */}
          <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1={p3.x} y1={p3.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="2 2" />

          {/* The Bezier Curve */}
          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" />

          {/* Fixed Points */}
          <circle cx={p0.x} cy={p0.y} r={4} fill="#94a3b8" />
          <circle cx={p3.x} cy={p3.y} r={4} fill="#94a3b8" />

          {/* Control Handles */}
          <circle 
            cx={p1.x} cy={p1.y} r={8} fill="#f59e0b" stroke="#fff" strokeWidth="2" 
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => handlePointerDown(e, 'p1')}
          />
          <circle 
            cx={p2.x} cy={p2.y} r={8} fill="#10b981" stroke="#fff" strokeWidth="2" 
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => handlePointerDown(e, 'p2')}
          />
        </svg>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <label style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 'bold' }}>P1 (x, y)</label>
          <div style={{ display: 'flex', gap: '0.2rem' }}>
            <input type="number" value={cx1.toFixed(3)} step={0.05} min={0} max={1} onChange={e => onChange(parseFloat(e.target.value) || 0, cy1, cx2, cy2)} style={{ width: '50%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 4px', fontSize: '0.75rem', borderRadius: '4px' }} />
            <input type="number" value={cy1.toFixed(3)} step={0.05} onChange={e => onChange(cx1, parseFloat(e.target.value) || 0, cx2, cy2)} style={{ width: '50%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 4px', fontSize: '0.75rem', borderRadius: '4px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <label style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold' }}>P2 (x, y)</label>
          <div style={{ display: 'flex', gap: '0.2rem' }}>
            <input type="number" value={cx2.toFixed(3)} step={0.05} min={0} max={1} onChange={e => onChange(cx1, cy1, parseFloat(e.target.value) || 0, cy2)} style={{ width: '50%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 4px', fontSize: '0.75rem', borderRadius: '4px' }} />
            <input type="number" value={cy2.toFixed(3)} step={0.05} onChange={e => onChange(cx1, cy1, cx2, parseFloat(e.target.value) || 0)} style={{ width: '50%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 4px', fontSize: '0.75rem', borderRadius: '4px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
