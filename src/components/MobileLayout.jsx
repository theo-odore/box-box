import { useState } from 'react';
import LiveTiming from './LiveTiming';
import TrackMap from './TrackMap';
import WeatherPanel from './WeatherPanel';
import TelemetryComparison from './TelemetryComparison';
import TyreHistory from './TyreHistory';
import SectorTimes from './SectorTimes';
import SessionInfo from './SessionInfo';
import DriverInfo from './DriverInfo';
import { Map, ListOrdered, BarChart2, Info } from 'lucide-react';

const MobileLayout = () => {
  const [activeTab, setActiveTab] = useState('map');

  return (
    <div className="mobile-layout-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', paddingBottom: '70px' }}>
      {/* Active Tab Panel */}
      <div className="mobile-tab-content" style={{ minHeight: 'calc(100vh - 280px)' }}>
        {activeTab === 'map' && (
          <div className="mobile-tab-pane animate-fade">
            <TrackMap />
            <div style={{ marginTop: '12px' }}>
              <DriverInfo />
            </div>
          </div>
        )}

        {activeTab === 'timing' && (
          <div className="mobile-tab-pane animate-fade">
            <LiveTiming isMobile={true} />
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="mobile-tab-pane animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TelemetryComparison />
            <SectorTimes isMobile={true} />
            <TyreHistory />
          </div>
        )}

        {activeTab === 'info' && (
          <div className="mobile-tab-pane animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SessionInfo />
            <WeatherPanel />
          </div>
        )}
      </div>

      {/* Bottom Tab Navigation Bar */}
      <nav className="mobile-tab-bar" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--card-bg)',
        borderTop: '1px solid var(--card-border)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '10px 0',
        zIndex: 1000,
        boxShadow: '0 -4px 10px rgba(0, 0, 0, 0.4)'
      }}>
        <button 
          onClick={() => setActiveTab('map')}
          className={`mobile-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'map' ? 'var(--f1-red)' : 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            fontWeight: '600',
            cursor: 'pointer',
            flex: 1,
            transition: 'color 0.2s ease'
          }}
        >
          <Map size={18} />
          <span>Track Map</span>
        </button>

        <button 
          onClick={() => setActiveTab('timing')}
          className={`mobile-tab-btn ${activeTab === 'timing' ? 'active' : ''}`}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'timing' ? 'var(--f1-red)' : 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            fontWeight: '600',
            cursor: 'pointer',
            flex: 1,
            transition: 'color 0.2s ease'
          }}
        >
          <ListOrdered size={18} />
          <span>Timing</span>
        </button>

        <button 
          onClick={() => setActiveTab('analysis')}
          className={`mobile-tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'analysis' ? 'var(--f1-red)' : 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            fontWeight: '600',
            cursor: 'pointer',
            flex: 1,
            transition: 'color 0.2s ease'
          }}
        >
          <BarChart2 size={18} />
          <span>Analysis</span>
        </button>

        <button 
          onClick={() => setActiveTab('info')}
          className={`mobile-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'info' ? 'var(--f1-red)' : 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            fontWeight: '600',
            cursor: 'pointer',
            flex: 1,
            transition: 'color 0.2s ease'
          }}
        >
          <Info size={18} />
          <span>Session Info</span>
        </button>
      </nav>
    </div>
  );
};

export default MobileLayout;
