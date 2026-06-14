import React from 'react';
import { Activity, Download, Moon, Play, Redo2, Sun, Undo2, Upload } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { LOCALE_OPTIONS, t } from '../i18n';
import type { Locale } from '../i18n';
import { exportKinematicsCSV, exportRotaryContourCSV, exportLinearContourCSV, exportContourDXF, exportReportPDF } from '../utils/export';
import { BarChart3, Circle, LayoutGrid, AlignJustify } from 'lucide-react';

export const Topbar: React.FC = () => {
  const {
    locale, setLocale, theme, setTheme,
    segHistory, handleImport, handleExport,
    evalResult, unitSystem, camType, camContour, linearContour,
    calculateProfile, wasmReady,
    activeTab, setActiveTab, chartLayout, setChartLayout
  } = useAppContext();

  return (
    <header className="top-bar" style={{ height: '40px', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'var(--surface-color)' }}>
      <div className="logo-area" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-color)' }}>
        <Activity size={18} />
        <span>CAM DESIGN</span>
      </div>

      {/* View Tabs */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '2px' }}>
        <button className={`tab-btn ${activeTab === 'kinematic' ? 'active' : ''}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', background: activeTab === 'kinematic' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'kinematic' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setActiveTab('kinematic')}>
          <BarChart3 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }}/> Kinematics
        </button>
        <button className={`tab-btn ${activeTab === 'cam' ? 'active' : ''}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', background: activeTab === 'cam' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'cam' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setActiveTab('cam')}>
          <Circle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }}/> Profile
        </button>
        <button className={`tab-btn ${activeTab === 'animation' ? 'active' : ''}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', background: activeTab === 'animation' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'animation' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setActiveTab('animation')}>
          <Play size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }}/> Animation
        </button>
        <button className={`tab-btn ${activeTab === 'dynamics' ? 'active' : ''}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', background: activeTab === 'dynamics' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: activeTab === 'dynamics' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setActiveTab('dynamics')}>
          <Activity size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }}/> Dynamics
        </button>
      </div>

      <div className="actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {activeTab === 'kinematic' && (
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '2px', marginRight: '0.5rem' }}>
            <button className="glass-button" style={{ padding: '0.2rem 0.4rem', border: 'none', background: chartLayout === 'vertical' ? 'rgba(255,255,255,0.1)' : 'transparent' }} onClick={() => setChartLayout('vertical')} title="Vertical layout"><AlignJustify size={14} /></button>
            <button className="glass-button" style={{ padding: '0.2rem 0.4rem', border: 'none', background: chartLayout === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent' }} onClick={() => setChartLayout('grid')} title="Grid layout"><LayoutGrid size={14} /></button>
          </div>
        )}
        {/* Locale selector */}
        <select value={locale} onChange={e => setLocale(e.target.value as Locale)}
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--surface-border)', borderRadius: '4px', color: 'var(--text-primary)', padding: '0.25rem 0.4rem', fontSize: '0.75rem', cursor: 'pointer' }}>
          {LOCALE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Theme toggle */}
        <button className="glass-button" onClick={() => setTheme(th => th === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          style={{ padding: '0.3rem 0.5rem' }}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Undo/Redo */}
        <button className="glass-button" onClick={segHistory.undo} disabled={!segHistory.canUndo}
          title="Undo (Ctrl+Z)" style={{ padding: '0.3rem 0.5rem', opacity: segHistory.canUndo ? 1 : 0.3 }}>
          <Undo2 size={15} />
        </button>
        <button className="glass-button" onClick={segHistory.redo} disabled={!segHistory.canRedo}
          title="Redo (Ctrl+Y)" style={{ padding: '0.3rem 0.5rem', opacity: segHistory.canRedo ? 1 : 0.3 }}>
          <Redo2 size={15} />
        </button>

        <button className="glass-button" onClick={handleImport} title="Import JSON profile (Ctrl+O)">
          <Upload size={15} /> {t('app.import', locale)}
        </button>
        
        {/* Export Dropdown / Group */}
        <div style={{ display: 'flex', gap: '0.2rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem', borderRadius: '6px' }}>
          <button className="glass-button" onClick={handleExport} title="Export Profile JSON (Ctrl+S)">
            <Download size={15} /> JSON
          </button>
          <button className="glass-button" onClick={() => exportKinematicsCSV(evalResult, unitSystem)} title="Export Kinematics CSV" disabled={evalResult.length === 0}>
            CSV
          </button>
          <button className="glass-button" onClick={() => {
            if (camType === 'rotary' && camContour) exportRotaryContourCSV(camContour, unitSystem);
            if (camType === 'linear' && linearContour) exportLinearContourCSV(linearContour, unitSystem);
          }} title="Export Cam Contour CSV" disabled={(camType === 'rotary' && !camContour) || (camType === 'linear' && !linearContour)}>
            Contour
          </button>
          <button className="glass-button" onClick={() => {
            if (camType === 'rotary' && camContour) exportContourDXF(camContour, unitSystem);
            else alert("DXF export is currently supported for Rotary Cams.");
          }} title="Export DXF" disabled={camType !== 'rotary' || !camContour}>
            DXF
          </button>
          <button className="glass-button" onClick={exportReportPDF} title="Generate PDF Report">
            PDF Report
          </button>
        </div>
        <button className="glass-button primary pulse" onClick={calculateProfile} disabled={!wasmReady}>
          <Play size={15} /> {t('app.recalculate', locale)}
        </button>
      </div>
    </header>
  );
};
