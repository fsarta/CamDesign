import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { SegmentDef } from './SegmentEditor';
import { evaluate_segment } from 'motus_wasm';
import { convertAngle } from '../units';
import { useAppContext } from '../contexts/AppContext';

interface LawComparisonModalProps {
  segment: SegmentDef;
  onClose: () => void;
}

const AVAILABLE_LAWS = [
  'Cycloidal',
  'Polynomial345',
  'Polynomial4567',
  'ModifiedTrapezoidal',
  'ModifiedSine',
  'SimpleHarmonic',
  'ConstantVelocity',
  'ConstantAcceleration',
  'Dwell'
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#64748b'];

export const LawComparisonModal: React.FC<LawComparisonModalProps> = ({ segment, onClose }) => {
  const { unitSystem } = useAppContext();
  const [selectedLaws, setSelectedLaws] = useState<string[]>([segment.law]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);

  const toggleLaw = (law: string) => {
    setSelectedLaws(prev => 
      prev.includes(law) ? prev.filter(l => l !== law) : [...prev, law]
    );
  };

  useEffect(() => {
    if (selectedLaws.length === 0) {
      setComparisonData([]);
      return;
    }

    const resolution = 100;
    
    // Duration in internal units (radians)
    const beta_rad = unitSystem.angle === 'rad' 
      ? segment.phi_end - segment.phi_start
      : convertAngle(segment.phi_end - segment.phi_start, 'deg', 'rad');
      
    // Stroke in display units (easier for user to read)
    const stroke = segment.stroke;

    let mergedData: any[] = Array.from({ length: resolution + 1 }, (_, i) => {
      const tau = i / resolution;
      const angle = segment.phi_start + tau * (segment.phi_end - segment.phi_start);
      return { tau, angle };
    });

    for (const law of selectedLaws) {
      try {
        const testSegment = {
          ...segment,
          law: law === 'Bezier' ? { Bezier: { cx1: 0.25, cy1: 0.1, cx2: 0.25, cy2: 1.0 } } : law,
          name: law,
          color: null,
          bezier_cx1: undefined, bezier_cy1: undefined, bezier_cx2: undefined, bezier_cy2: undefined,
        };

        const result = evaluate_segment(testSegment, resolution);
        
        for (let i = 0; i <= resolution; i++) {
          const norm = result[i];
          const s = stroke * norm.s;
          const v = beta_rad > 0 ? (stroke / beta_rad) * norm.v : 0;
          const a = beta_rad > 0 ? (stroke / (beta_rad * beta_rad)) * norm.a : 0;
          const j = beta_rad > 0 ? (stroke / (beta_rad * beta_rad * beta_rad)) * norm.j : 0;
          
          mergedData[i][`${law}_s`] = s;
          mergedData[i][`${law}_v`] = v;
          mergedData[i][`${law}_a`] = a;
          mergedData[i][`${law}_j`] = j;
        }
      } catch (err) {
        console.error(`Failed to evaluate law ${law}`, err);
      }
    }

    setComparisonData(mergedData);
  }, [segment, selectedLaws, unitSystem]);

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="glass-panel" style={{
        width: '90vw', maxWidth: '1200px', height: '85vh',
        display: 'flex', flexDirection: 'column', backgroundColor: 'var(--surface-bg)'
      }}>
        <div className="panel-header" style={{ justifyContent: 'space-between', padding: '1rem' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Law Comparison: <span style={{ color: 'var(--text-secondary)' }}>{segment.name || 'Segment'}</span>
          </h2>
          <button className="glass-button" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Sidebar for Checkboxes */}
          <div style={{ width: '250px', padding: '1rem', borderRight: '1px solid var(--surface-border)', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Select Laws to Compare</h3>
            {AVAILABLE_LAWS.map((law, idx) => (
              <label key={law} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={selectedLaws.includes(law)}
                  onChange={() => toggleLaw(law)}
                  style={{ accentColor: COLORS[idx % COLORS.length] }}
                />
                <span style={{ fontSize: '0.85rem', color: selectedLaws.includes(law) ? COLORS[idx % COLORS.length] : 'var(--text-primary)' }}>
                  {law}
                </span>
              </label>
            ))}
          </div>

          {/* Charts Area */}
          <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '1rem' }}>
            {['s', 'v', 'a', 'j'].map((metric) => {
              const metricNames = { s: 'Position', v: 'Velocity', a: 'Acceleration', j: 'Jerk' };
              return (
                <div key={metric} style={{ height: '250px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', textAlign: 'center' }}>{metricNames[metric as keyof typeof metricNames]}</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="angle" type="number" domain={[segment.phi_start, segment.phi_end]} stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
                      <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} width={50} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--surface-border)', borderRadius: '8px' }}
                        labelFormatter={(val) => `Angle: ${Number(val).toFixed(2)}°`}
                        formatter={(val: any, name: any) => [Number(val).toFixed(3), (name || '').split('_')[0]]}
                      />
                      <Legend iconType="circle" />
                      {selectedLaws.map((law) => (
                        <Line 
                          key={law} 
                          type="monotone" 
                          dataKey={`${law}_${metric}`} 
                          name={law}
                          stroke={COLORS[AVAILABLE_LAWS.indexOf(law) % COLORS.length]} 
                          dot={false} 
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
