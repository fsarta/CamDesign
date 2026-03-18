import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import init, { evaluate_profile, evaluate_cam_contour, evaluate_linear_cam_contour } from 'motus_wasm';
import { Activity, Settings, Play, GitMerge, Layers, LayoutGrid, AlignJustify, Circle, Download, BarChart3, ArrowRight, Ruler } from 'lucide-react';
import { KinematicChart } from './components/KinematicChart';
import type { MotionPoint, ChartLayout, SegmentBoundary } from './components/KinematicChart';
import { CamContourChart } from './components/CamContourChart';
import type { CamContourData, LinearCamContourData, CamDisplayType } from './components/CamContourChart';
import { SegmentEditor } from './components/SegmentEditor';
import type { SegmentDef } from './components/SegmentEditor';
import { fetchProjects } from './api';
import type { Project } from './api';
import type { UnitSystem, LengthUnit, AngleUnit } from './units';
import {
  DEFAULT_UNITS, LENGTH_OPTIONS, ANGLE_OPTIONS,
  convertLength, convertAngle, lengthLabel, lengthFromInternal,
  lengthToInternal,
} from './units';
import './index.css';

type ViewTab = 'kinematic' | 'cam';

// Default composed profile: Rise + Dwell + Return
const DEFAULT_SEGMENTS: SegmentDef[] = [
  {
    id: crypto.randomUUID(),
    name: "Rise",
    law: "Cycloidal",
    phi_start: 0,
    phi_end: 120,
    stroke: 50,
    s_start: 0,
    boundary_conditions: {
      start_velocity: { Fixed: 0.0 }, end_velocity: { Fixed: 0.0 },
      start_acceleration: { Fixed: 0.0 }, end_acceleration: { Fixed: 0.0 },
      start_jerk: "Free", end_jerk: "Free",
    },
    color: '#3b82f6',
    metadata: {}
  },
  {
    id: crypto.randomUUID(),
    name: "Dwell",
    law: "Dwell",
    phi_start: 120,
    phi_end: 180,
    stroke: 0,
    s_start: 50,
    boundary_conditions: {
      start_velocity: { Fixed: 0.0 }, end_velocity: { Fixed: 0.0 },
      start_acceleration: { Fixed: 0.0 }, end_acceleration: { Fixed: 0.0 },
      start_jerk: "Free", end_jerk: "Free",
    },
    color: '#10b981',
    metadata: {}
  },
  {
    id: crypto.randomUUID(),
    name: "Return",
    law: "Polynomial345",
    phi_start: 180,
    phi_end: 360,
    stroke: -50,
    s_start: 50,
    boundary_conditions: {
      start_velocity: { Fixed: 0.0 }, end_velocity: { Fixed: 0.0 },
      start_acceleration: { Fixed: 0.0 }, end_acceleration: { Fixed: 0.0 },
      start_jerk: "Free", end_jerk: "Free",
    },
    color: '#f59e0b',
    metadata: {}
  },
];

// Build WASM profile from UI segments — converts display units → internal (mm, deg)
function buildWasmProfile(segments: SegmentDef[], units: UnitSystem) {
  const wasmSegments = segments.map(seg => {
    let law: any = seg.law;
    if (seg.law === 'Bezier') {
      law = {
        Bezier: {
          cx1: seg.bezier_cx1 ?? 0.25,
          cy1: seg.bezier_cy1 ?? 0.1,
          cx2: seg.bezier_cx2 ?? 0.25,
          cy2: seg.bezier_cy2 ?? 1.0,
        }
      };
    }
    // Convert display→internal
    const phi_start = units.angle === 'rad' ? convertAngle(seg.phi_start, 'rad', 'deg') : seg.phi_start;
    const phi_end = units.angle === 'rad' ? convertAngle(seg.phi_end, 'rad', 'deg') : seg.phi_end;
    const stroke = lengthToInternal(seg.stroke, units.length);
    const s_start = lengthToInternal(seg.s_start, units.length);

    return {
      ...seg,
      phi_start,
      phi_end,
      stroke,
      s_start,
      law,
      name: seg.name || null,
      color: null,
      bezier_cx1: undefined,
      bezier_cy1: undefined,
      bezier_cx2: undefined,
      bezier_cy2: undefined,
    };
  });

  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Interactive Profile",
    segments: wasmSegments,
    total_stroke: Math.max(...wasmSegments.map(s => s.s_start + Math.abs(s.stroke)), 0),
    motion_type: "Rise",
    cycle_angle: 2 * Math.PI,
    resolution: 720,
  };
}

function App() {
  const [wasmReady, setWasmReady] = useState(false);
  const [evalResult, setEvalResult] = useState<MotionPoint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [segments, setSegments] = useState<SegmentDef[]>(DEFAULT_SEGMENTS);
  const [calcTimeMs, setCalcTimeMs] = useState<number>(0);
  const [chartLayout, setChartLayout] = useState<ChartLayout>('vertical');
  const [activeTab, setActiveTab] = useState<ViewTab>('kinematic');

  // Cam parameters
  const [camType, setCamType] = useState<CamDisplayType>('rotary');
  const [camBaseRadius, setCamBaseRadius] = useState(60);
  const [camRollerRadius, setCamRollerRadius] = useState(10);
  const [camOffset, setCamOffset] = useState(0);
  const [camContour, setCamContour] = useState<CamContourData | null>(null);
  // Linear cam params
  const [camLength, setCamLength] = useState(300);
  const [camGrooveDepth, setCamGrooveDepth] = useState(0);
  const [linearContour, setLinearContour] = useState<LinearCamContourData | null>(null);

  // Unit system
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(DEFAULT_UNITS);
  const prevUnitsRef = useRef<UnitSystem>(DEFAULT_UNITS);

  // Auto-convert values when units change
  const handleUnitChange = useCallback((newUnits: UnitSystem) => {
    const prev = prevUnitsRef.current;
    // Convert length-based values
    if (newUnits.length !== prev.length) {
      const cl = (v: number) => convertLength(v, prev.length, newUnits.length);
      setSegments(segs => segs.map(s => ({
        ...s,
        stroke: Number(cl(s.stroke).toFixed(4)),
        s_start: Number(cl(s.s_start).toFixed(4)),
      })));
      setCamBaseRadius(v => Number(cl(v).toFixed(4)));
      setCamRollerRadius(v => Number(cl(v).toFixed(4)));
      setCamOffset(v => Number(cl(v).toFixed(4)));
      setCamLength(v => Number(cl(v).toFixed(4)));
      setCamGrooveDepth(v => Number(cl(v).toFixed(4)));
    }
    // Convert angle-based values
    if (newUnits.angle !== prev.angle) {
      const ca = (v: number) => convertAngle(v, prev.angle, newUnits.angle);
      setSegments(segs => segs.map(s => ({
        ...s,
        phi_start: Number(ca(s.phi_start).toFixed(4)),
        phi_end: Number(ca(s.phi_end).toFixed(4)),
      })));
    }
    prevUnitsRef.current = newUnits;
    setUnitSystem(newUnits);
  }, []);

  // Segment boundaries for chart overlay
  const segmentBoundaries: SegmentBoundary[] = useMemo(() =>
    segments.map(seg => ({
      phi_start: seg.phi_start,
      phi_end: seg.phi_end,
      name: seg.name,
      color: seg.color || '#3b82f6',
    })),
    [segments]
  );

  // Evaluate composed profile in WASM
  const calculateProfile = useCallback(() => {
    if (!wasmReady) return;
    try {
      const profile = buildWasmProfile(segments, unitSystem);

      const t0 = performance.now();
      const result = evaluate_profile(profile, 720);
      const t1 = performance.now();
      setCalcTimeMs(Math.round((t1 - t0) * 100) / 100);
      setEvalResult(result);

      // Convert cam params to internal (mm)
      const iBaseR = lengthToInternal(camBaseRadius, unitSystem.length);
      const iRollerR = lengthToInternal(camRollerRadius, unitSystem.length);
      const iOffset = lengthToInternal(camOffset, unitSystem.length);
      const iLength = lengthToInternal(camLength, unitSystem.length);
      const iGroove = lengthToInternal(camGrooveDepth, unitSystem.length);

      // Calculate both cam types
      try {
        const camProfile = buildWasmProfile(segments, unitSystem);
        const contourResult = evaluate_cam_contour(camProfile, iBaseR, iRollerR, iOffset, 720);
        setCamContour(contourResult as CamContourData);
      } catch (camErr) {
        console.error("Rotary Cam Error:", camErr);
      }
      try {
        const linProfile = buildWasmProfile(segments, unitSystem);
        const linResult = evaluate_linear_cam_contour(linProfile, iLength, iRollerR, iGroove, 720);
        setLinearContour(linResult as LinearCamContourData);
      } catch (linErr) {
        console.error("Linear Cam Error:", linErr);
      }
    } catch (err) {
      console.error("WASM Profile Evaluate Error:", err);
    }
  }, [wasmReady, segments, camBaseRadius, camRollerRadius, camOffset, camLength, camGrooveDepth, unitSystem]);

  // Recalculate when segments or cam params change
  useEffect(() => {
    if (wasmReady) {
      calculateProfile();
    }
  }, [calculateProfile, wasmReady]);

  useEffect(() => {
    fetchProjects().then(data => setProjects(data));
    init().then(() => {
      console.log("WASM Initialized Successfully");
      setWasmReady(true);
    });
  }, []);

  // Export profile as JSON
  const handleExport = useCallback(() => {
    const exportData = {
      version: '1.0',
      application: 'MOTUS NOVA',
      exported_at: new Date().toISOString(),
      profile: {
        name: 'Interactive Profile',
        segments: segments.map(seg => ({
          name: seg.name,
          law: seg.law,
          phi_start: seg.phi_start,
          phi_end: seg.phi_end,
          stroke: seg.stroke,
          s_start: seg.s_start,
          ...(seg.law === 'Bezier' ? {
            bezier_cx1: seg.bezier_cx1,
            bezier_cy1: seg.bezier_cy1,
            bezier_cx2: seg.bezier_cx2,
            bezier_cy2: seg.bezier_cy2,
          } : {}),
        })),
      },
      cam: {
        type: camType,
        base_radius: camBaseRadius,
        roller_radius: camRollerRadius,
        offset: camOffset,
        ...(camType === 'linear' ? {
          cam_length: camLength,
          groove_depth: camGrooveDepth,
        } : {}),
      },
      units: {
        length: unitSystem.length,
        angle: unitSystem.angle,
      },
      diagnostics: evalResult.length > 0 ? {
        max_position: Math.max(...evalResult.map(r => r.s)),
        max_velocity: Math.max(...evalResult.map(r => Math.abs(r.v))),
        max_acceleration: Math.max(...evalResult.map(r => Math.abs(r.a))),
        samples: evalResult.length,
        calc_time_ms: calcTimeMs,
      } : null,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'motus_profile.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [segments, camBaseRadius, camRollerRadius, camOffset, evalResult, calcTimeMs]);

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <header className="top-bar">
        <div className="logo-area">
          <Activity className="logo-icon" size={24} />
          <span>MOTUS NOVA</span>
        </div>

        <div className="actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {projects.length > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Project: <strong>{projects[0].name}</strong>
            </span>
          )}
          <button className="glass-button" onClick={handleExport} title="Export profile as JSON">
            <Download size={15} />
            Export
          </button>
          <button className="glass-button">
            <GitMerge size={15} />
            Draft
          </button>
          <button className="glass-button primary pulse" onClick={calculateProfile} disabled={!wasmReady}>
            <Play size={15} />
            Recalculate
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="main-content">

        {/* Sidebar */}
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
                    className="cam-input" />
                </div>
              </div>

              {/* Rotary-specific params */}
              {camType === 'rotary' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Base R ({lengthLabel(unitSystem.length)})</label>
                    <input type="number" value={camBaseRadius} min={10} max={500} step={1}
                      onChange={e => setCamBaseRadius(parseFloat(e.target.value) || 60)}
                      className="cam-input" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Offset ({lengthLabel(unitSystem.length)})</label>
                    <input type="number" value={camOffset} min={-50} max={50} step={0.5}
                      onChange={e => setCamOffset(parseFloat(e.target.value) || 0)}
                      className="cam-input" />
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
                      className="cam-input" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Groove Depth ({lengthLabel(unitSystem.length)})</label>
                    <input type="number" value={camGrooveDepth} min={0} max={100} step={1}
                      onChange={e => setCamGrooveDepth(parseFloat(e.target.value) || 0)}
                      className="cam-input" />
                  </div>
                </div>
              )}
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
              </div>
            )}
          </div>
        </aside>

        {/* Canvas Area */}
        <section className="canvas-area glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Tab Bar */}
          <div className="panel-header" style={{ padding: '0.5rem 1rem 0', gap: '0' }}>
            <div className="tab-bar">
              <button
                className={`tab-btn ${activeTab === 'kinematic' ? 'active' : ''}`}
                onClick={() => setActiveTab('kinematic')}
              >
                <BarChart3 size={14} /> Kinematic
              </button>
              <button
                className={`tab-btn ${activeTab === 'cam' ? 'active' : ''}`}
                onClick={() => setActiveTab('cam')}
              >
                <Circle size={14} /> Cam Contour
              </button>
            </div>

            {activeTab === 'kinematic' && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                <button
                  className={`layout-toggle-btn ${chartLayout === 'vertical' ? 'active' : ''}`}
                  onClick={() => setChartLayout('vertical')}
                  title="Vertical layout"
                >
                  <AlignJustify size={14} />
                </button>
                <button
                  className={`layout-toggle-btn ${chartLayout === 'grid' ? 'active' : ''}`}
                  onClick={() => setChartLayout('grid')}
                  title="Grid layout"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, padding: '0.5rem 1rem 1rem', minHeight: 0 }}>
            {activeTab === 'kinematic' && (
              evalResult.length > 0 ? (
                <KinematicChart
                  data={evalResult}
                  layout={chartLayout}
                  segmentBoundaries={segmentBoundaries}
                  unitSystem={unitSystem}
                />
              ) : (
                <div className="chart-placeholder" style={{ height: '100%', margin: 0 }}>
                  <Activity size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <h3>Kinematic Visualization Region</h3>
                </div>
              )
            )}

            {activeTab === 'cam' && (
              (camContour || linearContour) ? (
                <CamContourChart
                  camType={camType}
                  rotaryData={camContour}
                  linearData={linearContour}
                  baseRadius={camBaseRadius}
                  unitSystem={unitSystem}
                />
              ) : (
                <div className="chart-placeholder" style={{ height: '100%', margin: 0 }}>
                  <Circle size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <h3>Cam Contour — Waiting for calculation</h3>
                </div>
              )
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;
