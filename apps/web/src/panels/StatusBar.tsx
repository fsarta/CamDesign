import React from 'react';
import { useAppContext } from '../contexts/AppContext';

export const StatusBar: React.FC = () => {
  const { calcTimeMs, wasmReady, unitSystem } = useAppContext();

  return (
    <div style={{
      height: '24px',
      backgroundColor: '#0F1115',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1rem',
      fontSize: '0.65rem',
      color: 'var(--text-secondary)',
      fontFamily: 'monospace',
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <span style={{ color: wasmReady ? 'var(--success)' : 'var(--warning)' }}>
          ● {wasmReady ? 'Engine Ready' : 'Initializing...'}
        </span>
        <span>Solve Time: {calcTimeMs.toFixed(2)} ms</span>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <span>Length: {unitSystem.length}</span>
        <span>Angle: {unitSystem.angle}</span>
        <span>CamDesign v1.0.0</span>
      </div>
    </div>
  );
};
