import { useEffect, useState, useCallback, useMemo } from 'react';
import init, { evaluate_profile, evaluate_cam_contour } from 'motus_wasm';
import { Activity, Settings, Play, GitMerge, Layers, LayoutGrid, AlignJustify, Circle, Download, BarChart3 } from 'lucide-react';
import { KinematicChart } from './components/KinematicChart';
import type { MotionPoint, ChartLayout, SegmentBoundary } from './components/KinematicChart';
import { CamContourChart } from './components/CamContourChart';
import type { CamContourData } from './components/CamContourChart';
import { SegmentEditor } from './components/SegmentEditor';
import type { SegmentDef } from './components/SegmentEditor';
import { fetchProjects } from './api';
import type { Project } from './api';
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

// Build WASM profile from UI segments
function buildWasmProfile(segments: SegmentDef[]) {
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
    return {
      ...seg,
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
    total_stroke: Math.max(...segments.map(s => s.s_start + Math.abs(s.stroke)), 0),
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
  const [camBaseRadius, setCamBaseRadius] = useState(60);
  const [camRollerRadius, setCamRollerRadius] = useState(10);
  const [camOffset, setCamOffset] = useState(0);
  const [camContour, setCamContour] = useState<CamContourData | null>(null);

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
      const profile = buildWasmProfile(segments);

      const t0 = performance.now();
      const result = evaluate_profile(profile, 720);
      const t1 = performance.now();
      setCalcTimeMs(Math.round((t1 - t0) * 100) / 100);
      setEvalResult(result);

      // Also calculate cam contour
      try {
        const camProfile = buildWasmProfile(segments);
        const contourResult = evaluate_cam_contour(camProfile, camBaseRadius, camRollerRadius, camOffset, 720);
        setCamContour(contourResult as CamContourData);
      } catch (camErr) {
        console.error("Cam Contour Error:", camErr);
      }
    } catch (err) {
      console.error("WASM Profile Evaluate Error:", err);
    }
  }, [wasmReady, segments, camBaseRadius, camRollerRadius, camOffset]);

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
        base_radius: camBaseRadius,
        roller_radius: camRollerRadius,
        offset: camOffset,
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
              <SegmentEditor segments={segments} onSegmentsChange={setSegments} />
            </div>

            {/* Cam Parameters */}
            <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
                <Circle size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                Cam Geometry
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Base R (mm)</label>
                  <input type="number" value={camBaseRadius} min={10} max={500} step={1}
                    onChange={e => setCamBaseRadius(parseFloat(e.target.value) || 60)}
                    className="cam-input" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Roller R (mm)</label>
                  <input type="number" value={camRollerRadius} min={0} max={100} step={0.5}
                    onChange={e => setCamRollerRadius(parseFloat(e.target.value) || 0)}
                    className="cam-input" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Offset (mm)</label>
                  <input type="number" value={camOffset} min={-50} max={50} step={0.5}
                    onChange={e => setCamOffset(parseFloat(e.target.value) || 0)}
                    className="cam-input" />
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
                  <span className="param-value">{Math.max(...evalResult.map(r => r.s)).toFixed(2)} mm</span>
                </div>
                <div className="param-row">
                  <span className="param-label">Max |Velocity|</span>
                  <span className="param-value">{Math.max(...evalResult.map(r => Math.abs(r.v))).toFixed(3)}</span>
                </div>
                <div className="param-row">
                  <span className="param-label">Max |Accel|</span>
                  <span className="param-value">{Math.max(...evalResult.map(r => Math.abs(r.a))).toFixed(3)}</span>
                </div>
                {camContour && (
                  <>
                    <div className="param-row">
                      <span className="param-label">Pressure ∠ max</span>
                      <span className="param-value" style={{ color: camContour.max_pressure_angle > 30 ? 'var(--warning)' : 'var(--success)' }}>
                        {camContour.max_pressure_angle.toFixed(1)}°
                      </span>
                    </div>
                    <div className="param-row">
                      <span className="param-label">Min Curvature ρ</span>
                      <span className="param-value">{camContour.min_curvature_radius.toFixed(2)} mm</span>
                    </div>
                  </>
                )}
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
                />
              ) : (
                <div className="chart-placeholder" style={{ height: '100%', margin: 0 }}>
                  <Activity size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <h3>Kinematic Visualization Region</h3>
                </div>
              )
            )}

            {activeTab === 'cam' && (
              camContour ? (
                <CamContourChart data={camContour} baseRadius={camBaseRadius} />
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
