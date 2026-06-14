import React from 'react';
import { Activity, AlignJustify, BarChart3, Circle, LayoutGrid, Play } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { KinematicChart } from '../components/KinematicChart';
import { CamContourChart } from '../components/CamContourChart';
import { CamAnimation } from '../components/CamAnimation';
import { DynamicChart } from '../components/DynamicChart';
import { t } from '../i18n';

export const MainView: React.FC = () => {
  const {
    activeTab, setActiveTab, chartLayout, setChartLayout,
    evalResult, dynResult, segmentBoundaries, unitSystem, rpm, locale,
    camType, camContour, linearContour, camBaseRadius
  } = useAppContext();

  return (
    <section className="canvas-area glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Tab Content */}
      <div style={{ flex: 1, padding: '0.5rem 1rem 1rem', minHeight: 0 }}>
        {activeTab === 'kinematic' && (
          evalResult.length > 0 ? (
            <KinematicChart
              data={evalResult}
              layout={chartLayout}
              segmentBoundaries={segmentBoundaries}
              unitSystem={unitSystem}
              rpm={rpm}
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

        {activeTab === 'animation' && (
          <CamAnimation
            camData={camContour}
            profileData={evalResult}
            baseRadius={camBaseRadius}
          />
        )}

        {activeTab === 'dynamics' && (
          dynResult ? (
            <DynamicChart data={dynResult} segmentBoundaries={segmentBoundaries} />
          ) : (
            <div className="chart-placeholder" style={{ height: '100%', margin: 0 }}>
              <Activity size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <h3>Dynamic Analysis</h3>
              <p>Set a non-zero RPM value in the Sidebar to calculate inertial forces.</p>
            </div>
          )
        )}
      </div>
    </section>
  );
};
