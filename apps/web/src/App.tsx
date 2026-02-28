import { useEffect, useState, useCallback, useMemo } from 'react';
import init, { evaluate_profile } from 'motus_wasm';
import { Activity, Settings, Play, GitMerge, Layers, LayoutGrid, AlignJustify } from 'lucide-react';
import { KinematicChart } from './components/KinematicChart';
import type { MotionPoint, ChartLayout, SegmentBoundary } from './components/KinematicChart';
import { SegmentEditor } from './components/SegmentEditor';
import type { SegmentDef } from './components/SegmentEditor';
import { fetchProjects } from './api';
import type { Project } from './api';
import './index.css';

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

function App() {
  const [wasmReady, setWasmReady] = useState(false);
  const [evalResult, setEvalResult] = useState<MotionPoint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [segments, setSegments] = useState<SegmentDef[]>(DEFAULT_SEGMENTS);
  const [calcTimeMs, setCalcTimeMs] = useState<number>(0);
  const [chartLayout, setChartLayout] = useState<ChartLayout>('vertical');

  // Convert segments to boundary markers for chart overlay
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
      // Sanitize segments for WASM: Rust expects color: Option<[u8;3]>, not CSS strings
      // Also convert Bezier law string to Rust enum format
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
          // Strip UI-only Bezier fields
          bezier_cx1: undefined,
          bezier_cy1: undefined,
          bezier_cx2: undefined,
          bezier_cy2: undefined,
        };
      });

      const profile = {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Interactive Profile",
        segments: wasmSegments,
        total_stroke: Math.max(...segments.map(s => s.s_start + Math.abs(s.stroke)), 0),
        motion_type: "Rise",
        cycle_angle: 2 * Math.PI,
        resolution: 360,
      };

      const t0 = performance.now();
      const result = evaluate_profile(profile, 720); // Higher resolution for smoother curves
      const t1 = performance.now();
      setCalcTimeMs(Math.round((t1 - t0) * 100) / 100);
      setEvalResult(result);
    } catch (err) {
      console.error("WASM Profile Evaluate Error:", err);
    }
  }, [wasmReady, segments]);

  // Recalculate when segments change
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

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <header className="top-bar">
        <div className="logo-area">
          <Activity className="logo-icon" size={28} />
          <span>MOTUS NOVA</span>
        </div>

        <div className="actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {projects.length > 0 && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Project: <strong>{projects[0].name}</strong>
            </span>
          )}
          <button className="glass-button">
            <GitMerge size={16} />
            Version: Draft
          </button>
          <button className="glass-button primary pulse" onClick={calculateProfile} disabled={!wasmReady}>
            <Play size={16} />
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
              <Layers size={20} /> Motion Profile
            </h2>

            <div className="info-card">
              WASM Engine: {wasmReady ? <span style={{ color: 'var(--success)' }}>Active</span> : <span style={{ color: 'var(--danger)' }}>Loading...</span>}
            </div>

            {/* Segment Editor */}
            <div style={{ marginTop: '1rem' }}>
              <SegmentEditor segments={segments} onSegmentsChange={setSegments} />
            </div>

            {/* Diagnostics */}
            {evalResult.length > 0 && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
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

        {/* Math Engine Canvas */}
        <section className="canvas-area glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header" style={{ padding: '0.75rem 1rem 0' }}>
            Kinematic Visualization — Composed Profile (360°)
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
              <button
                className={`layout-toggle-btn ${chartLayout === 'vertical' ? 'active' : ''}`}
                onClick={() => setChartLayout('vertical')}
                title="Vertical layout (stacked)"
              >
                <AlignJustify size={15} />
              </button>
              <button
                className={`layout-toggle-btn ${chartLayout === 'grid' ? 'active' : ''}`}
                onClick={() => setChartLayout('grid')}
                title="Grid layout (2×2)"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, padding: '0.5rem 1rem 1rem', minHeight: 0 }}>
            {evalResult.length > 0 ? (
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
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;
