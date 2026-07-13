import { Check, X } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="data-availability-footer" style={{ marginTop: '16px' }}>
      <div className="stat-label" style={{ fontSize: '11px', fontWeight: '800', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
        Data Available in FastF1
      </div>
      
      <div className="footer-sections">
        {/* Timing Data */}
        <div className="footer-section">
          <div className="footer-section-title">Timing Data</div>
          <ul className="footer-list">
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Lap Times</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Sectors</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Positions</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Intervals</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Pit Stops</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Retirements</li>
          </ul>
        </div>

        {/* Driver Data */}
        <div className="footer-section">
          <div className="footer-section-title">Driver Data</div>
          <ul className="footer-list">
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Driver Info</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Stints</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Tyre Compound</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Tyre Life (Age)</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Team</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Drivers' Points</li>
          </ul>
        </div>

        {/* Telemetry Data */}
        <div className="footer-section">
          <div className="footer-section-title">Telemetry Data</div>
          <ul className="footer-list">
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Speed</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Throttle</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Brake</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> RPM / Gear</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> DRS</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> X, Y, Z Position</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Distance / Time</li>
          </ul>
        </div>

        {/* Weather Data */}
        <div className="footer-section">
          <div className="footer-section-title">Weather Data</div>
          <ul className="footer-list">
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Air Temperature</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Track Temperature</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Humidity</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Pressure</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Wind Speed / Dir</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Rainfall</li>
          </ul>
        </div>

        {/* Session Data */}
        <div className="footer-section">
          <div className="footer-section-title">Session Data</div>
          <ul className="footer-list">
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Session Info</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Track Info</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Results</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Standings</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Race Control</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Flags (SC, VSC)</li>
          </ul>
        </div>

        {/* Track Data */}
        <div className="footer-section">
          <div className="footer-section-title">Track Data</div>
          <ul className="footer-list">
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Track Map</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Corners</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> DRS Zones</li>
            <li className="footer-list-item available"><Check size={10} className="check-icon" /> Speed Trap</li>
          </ul>
        </div>

        {/* Not Available Data */}
        <div className="footer-section" style={{ minWidth: '220px' }}>
          <div className="footer-section-title" style={{ color: '#f87171' }}>Not Available (FastF1 Does Not Provide)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <ul className="footer-list">
              <li className="footer-list-item unavailable"><X size={10} className="cross-icon" /> Tyre Temps</li>
              <li className="footer-list-item unavailable"><X size={10} className="cross-icon" /> Tyre Pressure</li>
              <li className="footer-list-item unavailable"><X size={10} className="cross-icon" /> Brake Temps</li>
              <li className="footer-list-item unavailable"><X size={10} className="cross-icon" /> Fuel Load</li>
              <li className="footer-list-item unavailable"><X size={10} className="cross-icon" /> ERS Data</li>
            </ul>
            <ul className="footer-list">
              <li className="footer-list-item unavailable"><X size={10} className="cross-icon" /> Suspension</li>
              <li className="footer-list-item unavailable"><X size={10} className="cross-icon" /> Car Setup</li>
              <li className="footer-list-item unavailable"><X size={10} className="cross-icon" /> Team Radio</li>
              <li className="footer-list-item unavailable"><X size={10} className="cross-icon" /> Internal Tel</li>
              <li className="footer-list-item unavailable"><X size={10} className="cross-icon" /> Private Data</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
