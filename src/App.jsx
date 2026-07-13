import { useState, useEffect } from 'react';
import { PlaybackProvider, usePlayback } from './context/PlaybackContext';
import Header from './components/Header';
import LiveTiming from './components/LiveTiming';
import TrackMap from './components/TrackMap';
import WeatherPanel from './components/WeatherPanel';
import DriverInfo from './components/DriverInfo';
import LapTimeHistory from './components/LapTimeHistory';
import TelemetryComparison from './components/TelemetryComparison';
import TyreHistory from './components/TyreHistory';
import SectorTimes from './components/SectorTimes';
import SessionInfo from './components/SessionInfo';

import MobileLayout from './components/MobileLayout';

// Responsive layout hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

const DashboardContent = () => {
  const { isLoading, sessionId } = usePlayback();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <div style={{ fontSize: '18px', fontWeight: '600', letterSpacing: '0.5px' }}>
          Loading Real F1 Telemetry Data...
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Session: {sessionId}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header Stat Strip and Play Controls */}
      <Header />
      
      {/* Responsive Layout Shell */}
      {isMobile ? (
        <MobileLayout />
      ) : (
        <main className="dashboard-grid">
          {/* Column 1 (Left): Live Timing, Driver Card, Tyre Stints */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <LiveTiming />
            <DriverInfo />
            <TyreHistory />
          </div>

          {/* Column 2 (Middle): Track Canvas, Lap Pace, Sectors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TrackMap />
            <LapTimeHistory />
            <SectorTimes />
          </div>

          {/* Column 3 (Right): Weather, Telemetry Plotter, Track Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <WeatherPanel />
            <TelemetryComparison />
            <SessionInfo />
          </div>
        </main>
      )}

    </div>
  );
};

function App() {
  return (
    <PlaybackProvider>
      <DashboardContent />
    </PlaybackProvider>
  );
}

export default App;
