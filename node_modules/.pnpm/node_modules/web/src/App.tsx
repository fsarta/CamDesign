import { useEffect, useState } from 'react';
import init, { evaluate_segment } from 'motus_wasm';
import { Activity, Settings, Maximize2, Play, GitMerge } from 'lucide-react';
import { KinematicChart } from './components/KinematicChart';
import type { MotionPoint } from './components/KinematicChart';
import { fetchProjects } from './api';
import type { Project } from './api';
import './index.css';

function App() {
  const [wasmReady, setWasmReady] = useState(false);
  const [evalResult, setEvalResult] = useState<MotionPoint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Function to calculate curve
  const calculateProfile = () => {
    try {
      // Mock a simple segment definition based on motus_core segment types
      const segmentDef = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test segment",
        law: "Polynomial345",
        phi_start: 0.0,
        phi_end: 120.0,
        stroke: 100.0,
        s_start: 0.0,
        boundary_conditions: {
          start_velocity: { Fixed: 0.0 },
          end_velocity: { Fixed: 0.0 },
          start_acceleration: { Fixed: 0.0 },
          end_acceleration: { Fixed: 0.0 },
          start_jerk: "Free",
          end_jerk: "Free",
        },
        color: null,
        metadata: {}
      };

      // Pass to WASM - evaluate 100 steps for smooth charting
      const result = evaluate_segment(segmentDef, 100);
      setEvalResult(result);
    } catch (err) {
      console.error("WASM Evaluate Error:", err);
    }
  };

  useEffect(() => {
    // 1. Fetch Backend Data
    fetchProjects().then(data => {
      setProjects(data);
    });

    // 2. Initialize WebAssembly environment
    init().then(() => {
      console.log("WASM Initialized Successfully");
      setWasmReady(true);
      // Auto-calculate on boot
      calculateProfile();
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
              Active Project: <strong>{projects[0].name}</strong>
            </span>
          )}
          <button className="glass-button">
            <GitMerge size={16} />
            Version: Draft
          </button>
          <button className="glass-button primary pulse" onClick={calculateProfile} disabled={!wasmReady}>
            <Play size={16} />
            Calculate Profile
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="main-content">

        {/* Sidebar */}
        <aside className="sidebar glass-panel">
          <div className="panel-body">
            <h2 className="panel-header">
              <Settings size={20} /> Parameters
            </h2>

            <div className="info-card">
              WebAssembly Core: {wasmReady ? <span style={{ color: 'var(--success)' }}>Active</span> : <span style={{ color: 'var(--danger)' }}>Loading...</span>}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Math Diagnostics</h3>
              {evalResult.length > 0 ? (
                <div>
                  <div className="param-row">
                    <span className="param-label">Law</span>
                    <span className="param-value">Polynomial 3-4-5</span>
                  </div>
                  <div className="param-row">
                    <span className="param-label">Max Velocity</span>
                    <span className="param-value">{Math.max(...evalResult.map(r => r.v)).toFixed(3)}</span>
                  </div>
                  <div className="param-row">
                    <span className="param-label">Max Accel</span>
                    <span className="param-value">{Math.max(...evalResult.map(r => r.a)).toFixed(3)}</span>
                  </div>
                  <div className="param-row">
                    <span className="param-label">Samples</span>
                    <span className="param-value">{evalResult.length}</span>
                  </div>
                </div>
              ) : (
                <div className="param-row">
                  <span className="param-label" style={{ color: 'var(--text-secondary)' }}>Awaiting calculation...</span>
                </div>
              )}
            </div>

          </div>
        </aside>

        {/* Math Engine Canvas */}
        <section className="canvas-area glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header" style={{ padding: '1rem 1rem 0' }}>
            Kinematic Visualization
            <div style={{ marginLeft: 'auto' }}>
              <button className="glass-button" style={{ padding: '0.25rem 0.5rem' }}>
                <Maximize2 size={16} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, padding: '1rem', minHeight: 0 }}>
            {evalResult.length > 0 ? (
              <KinematicChart data={evalResult} />
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
