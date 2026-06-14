import React from 'react';
import { Activity, ArrowRight, Circle, Gauge, Layers, Ruler, Settings } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { SegmentEditor } from '../components/SegmentEditor';
import { ContinuityCheck } from '../components/ContinuityCheck';
import { lengthLabel, lengthFromInternal, LENGTH_OPTIONS, ANGLE_OPTIONS } from '../units';
import type { LengthUnit, AngleUnit } from '../units';
import { t } from '../i18n';

export const Sidebar: React.FC = () => {
  const {
    wasmReady, segments, setSegments, unitSystem, handleUnitChange,
    camType, setCamType, camBaseRadius, setCamBaseRadius,
    camRollerRadius, setCamRollerRadius, camOffset, setCamOffset,
    camLength, setCamLength, camGrooveDepth, setCamGrooveDepth,
    equivMass, setEquivMass, springPreload, setSpringPreload,
    springStiffness, setSpringStiffness, damping, setDamping, 
    externalForce, setExternalForce, camThickness, setCamThickness,
    camMaterial, setCamMaterial, rollerMaterial, setRollerMaterial, materials,
    evalResult, camContour, linearContour, calcTimeMs,
    rpm, setRpm, locale
  } = useAppContext();

  return (
    <aside className="sidebar glass-panel">
      <div className="panel-body" style={{ overflowY: 'auto' }}>
        <h2 className="panel-header">
          <Layers size={18} /> Motion Profile
        </h2>

        <div className="info-card">
          WASM: {wasmReady ? <span style={{ color: 'var(--success)' }}>Active</span> : <span style={{ color: 'var(--danger)' }}>Loading...</span>}
        </div>

        {/* Segment Editor */}
        <div style={{ marginTop: '0.75rem' }}>
          <SegmentEditor segments={segments} onSegmentsChange={setSegments} unitSystem={unitSystem} />
        </div>

        {/* Cam Parameters */}
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
            {camType === 'rotary' ? <Circle size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} /> : <ArrowRight size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />}
            Cam Geometry
          </h3>

          {/* Cam Type Toggle */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '5px', padding: '2px' }}>
            <button className={`tab-btn ${camType === 'rotary' ? 'active' : ''}`}
              onClick={() => setCamType('rotary')} style={{ flex: 1, justifyContent: 'center' }}>
              <Circle size={12} /> Rotary
            </button>
            <button className={`tab-btn ${camType === 'linear' ? 'active' : ''}`}
              onClick={() => setCamType('linear')} style={{ flex: 1, justifyContent: 'center' }}>
              <ArrowRight size={12} /> Linear
            </button>
          </div>

          {/* Shared: Roller Radius */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
            <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Roller R ({lengthLabel(unitSystem.length)})</label>
              <input type="number" value={camRollerRadius} min={0} max={100} step={0.5}
                onChange={e => setCamRollerRadius(parseFloat(e.target.value) || 0)}
                className="cad-input" />
            </div>
          </div>

          {/* Rotary-specific params */}
          {camType === 'rotary' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Base R ({lengthLabel(unitSystem.length)})</label>
                <input type="number" value={camBaseRadius} min={10} max={500} step={1}
                  onChange={e => setCamBaseRadius(parseFloat(e.target.value) || 60)}
                  className="cad-input" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Offset ({lengthLabel(unitSystem.length)})</label>
                <input type="number" value={camOffset} min={-50} max={50} step={0.5}
                  onChange={e => setCamOffset(parseFloat(e.target.value) || 0)}
                  className="cad-input" />
              </div>
            </div>
          )}

          {/* Linear-specific params */}
          {camType === 'linear' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Cam Length ({lengthLabel(unitSystem.length)})</label>
                <input type="number" value={camLength} min={50} max={2000} step={10}
                  onChange={e => setCamLength(parseFloat(e.target.value) || 300)}
                  className="cad-input" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Groove Depth ({lengthLabel(unitSystem.length)})</label>
                <input type="number" value={camGrooveDepth} min={0} max={100} step={1}
                  onChange={e => setCamGrooveDepth(parseFloat(e.target.value) || 0)}
                  className="cad-input" />
              </div>
            </div>
          )}
        </div>

        {/* Dynamics Parameters */}
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
            <Activity size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
            Dynamics
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Eq. Mass (kg)</label>
              <input type="number" value={equivMass} min={0} step={0.5}
                onChange={e => setEquivMass(parseFloat(e.target.value) || 0)}
                className="cad-input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Thickness ({lengthLabel(unitSystem.length)})</label>
              <input type="number" value={camThickness} min={1} step={1}
                onChange={e => setCamThickness(parseFloat(e.target.value) || 20)}
                className="cad-input" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Preload (N)</label>
              <input type="number" value={springPreload} step={10}
                onChange={e => setSpringPreload(parseFloat(e.target.value) || 0)}
                className="cad-input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Stiffness (N/{lengthLabel(unitSystem.length)})</label>
              <input type="number" value={springStiffness} min={0} step={0.5}
                onChange={e => setSpringStiffness(parseFloat(e.target.value) || 0)}
                className="cad-input" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.4rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Damping (Ns/m)</label>
              <input type="number" value={damping} min={0} step={1}
                onChange={e => setDamping(parseFloat(e.target.value) || 0)}
                className="cad-input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Ext. Force (N)</label>
              <input type="number" value={externalForce} step={10}
                onChange={e => setExternalForce(parseFloat(e.target.value) || 0)}
                className="cad-input" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.4rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Cam Material</label>
              <select value={camMaterial} onChange={e => setCamMaterial(e.target.value)} className="cad-input" style={{ appearance: 'none', padding: '0.2rem' }}>
                {Object.keys(materials).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Roller Material</label>
              <select value={rollerMaterial} onChange={e => setRollerMaterial(e.target.value)} className="cad-input" style={{ appearance: 'none', padding: '0.2rem' }}>
                {Object.keys(materials).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Unit System Selector */}
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
            <Ruler size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
            Units
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Length</label>
              <select value={unitSystem.length}
                onChange={e => handleUnitChange({ ...unitSystem, length: e.target.value as LengthUnit })}
                style={{ padding: '0.3rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#e6edf3' }}>
                {LENGTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Angle</label>
              <select value={unitSystem.angle}
                onChange={e => handleUnitChange({ ...unitSystem, angle: e.target.value as AngleUnit })}
                style={{ padding: '0.3rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#e6edf3' }}>
                {ANGLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Diagnostics */}
        {evalResult.length > 0 && (
          <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
            <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
              <Settings size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
              Diagnostics
            </h3>
            <div className="param-row">
              <span className="param-label">Segments</span>
              <span className="param-value">{segments.length}</span>
            </div>
            <div className="param-row">
              <span className="param-label">Max Position</span>
              <span className="param-value">{lengthFromInternal(Math.max(...evalResult.map(r => r.s)), unitSystem.length).toFixed(2)} {lengthLabel(unitSystem.length)}</span>
            </div>
            <div className="param-row">
              <span className="param-label">Max |Velocity|</span>
              <span className="param-value">{Math.max(...evalResult.map(r => Math.abs(r.v))).toFixed(3)}</span>
            </div>
            <div className="param-row">
              <span className="param-label">Max |Accel|</span>
              <span className="param-value">{Math.max(...evalResult.map(r => Math.abs(r.a))).toFixed(3)}</span>
            </div>
            {(camContour || linearContour) && (() => {
              const cd = camType === 'rotary' ? camContour : linearContour;
              if (!cd) return null;
              return <>
                <div className="param-row">
                  <span className="param-label">Cam Type</span>
                  <span className="param-value">{camType === 'rotary' ? '⟲ Rotary' : '⟶ Linear'}</span>
                </div>
                <div className="param-row">
                  <span className="param-label">Pressure ∠ max</span>
                  <span className="param-value" style={{ color: cd.max_pressure_angle > 30 ? 'var(--warning)' : 'var(--success)' }}>
                    {cd.max_pressure_angle.toFixed(1)}°
                  </span>
                </div>
                <div className="param-row">
                  <span className="param-label">Min Curvature ρ</span>
                  <span className="param-value">{lengthFromInternal(cd.min_curvature_radius, unitSystem.length).toFixed(2)} {lengthLabel(unitSystem.length)}</span>
                </div>
              </>;
            })()}

            <div className="param-row">
              <span className="param-label">Calc Time</span>
              <span className="param-value">{calcTimeMs} ms</span>
            </div>
            <div className="param-row">
              <span className="param-label">Samples</span>
              <span className="param-value">{evalResult.length}</span>
            </div>

            {/* Continuity Check */}
            <ContinuityCheck data={evalResult} segments={segments} />
          </div>
        )}

        {/* RPM / Time Domain */}
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
            <Gauge size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
            {t('sidebar.rpm', locale)}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input type="number" value={rpm} min={0} max={10000} step={10}
              onChange={e => setRpm(parseFloat(e.target.value) || 0)}
              className="cam-input" style={{ width: '80px' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>RPM</span>
            {rpm > 0 && (
              <span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: 'auto' }}>
                ω = {(2 * Math.PI * rpm / 60).toFixed(2)} rad/s
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
