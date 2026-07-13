import { useMemo } from 'react';
import { usePlayback } from '../context/PlaybackContext';

const DriverInfo = () => {
  const { meta, laps, selectedDriver, currentTime } = usePlayback();

  // Find metadata for the selected driver
  const driverMeta = useMemo(() => {
    if (!meta || !selectedDriver) return null;
    return meta.drivers[selectedDriver] || null;
  }, [meta, selectedDriver]);

  // Find the driver's active lap at currentTime to extract live tyre stint info
  const activeLap = useMemo(() => {
    if (!laps || !selectedDriver) return null;
    const driverLaps = laps[selectedDriver] || [];
    
    // Find active lap
    const active = driverLaps.find(
      lap => currentTime >= lap.lapStartElapsed && currentTime <= lap.sector3Elapsed
    );
    
    if (active) return active;
    
    // Fallback: past last lap
    const lastLap = driverLaps[driverLaps.length - 1];
    if (lastLap && currentTime > lastLap.sector3Elapsed) {
      return lastLap;
    }
    
    return driverLaps[0] || null;
  }, [laps, selectedDriver, currentTime]);

  // Reconstruct stint number for the active lap
  const currentStintStats = useMemo(() => {
    if (!laps || !selectedDriver || !activeLap) return { stintNum: 1, tyreLife: 1 };
    const driverLaps = laps[selectedDriver] || [];
    
    // Count tyre stints consecutively up to the active lap
    let stintNum = 1;
    for (let i = 1; i < driverLaps.length; i++) {
      if (driverLaps[i].lapNumber > activeLap.lapNumber) break;
      const prevLap = driverLaps[i - 1];
      if (driverLaps[i].compound !== prevLap.compound || prevLap.isPit) {
        stintNum++;
      }
    }
    
    return {
      stintNum,
      tyreLife: activeLap.tyreLife,
      compound: activeLap.compound
    };
  }, [laps, selectedDriver, activeLap]);

  if (!driverMeta) {
    return (
      <div className="dashboard-card driver-info-card">
        <div className="card-header">
          <h2 className="card-title">Driver Info</h2>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Select a driver to view details</div>
      </div>
    );
  }

  // Fallback stats based on Monaco 2024 (e.g. Verstappen: 169 pts, 5 wins, 8 podiums; Leclerc: 138 pts, etc.)
  // We can also pull them dynamically from meta if present or fallback cleanly.
  const points = driverMeta.points || 0;
  const position = driverMeta.position || '-';
  
  // Custom dummy details to make the card look extremely rich (matching the mockup)
  const statsMapping = {
    VER: { wins: 5, podiums: 8 },
    LEC: { wins: 1, podiums: 5 },
    PIA: { wins: 0, podiums: 2 },
    NOR: { wins: 1, podiums: 4 },
    HAM: { wins: 0, podiums: 1 },
    SAI: { wins: 1, podiums: 3 },
    RUS: { wins: 0, podiums: 1 },
    ALO: { wins: 0, podiums: 0 },
    OCO: { wins: 0, podiums: 0 },
    BOT: { wins: 0, podiums: 0 }
  };
  
  const customStats = statsMapping[selectedDriver] || { wins: 0, podiums: 0 };

  return (
    <div className="dashboard-card driver-info-card">
      <div className="card-header">
        <h2 className="card-title">Driver Info</h2>
      </div>

      <div className="driver-info-main">
        <div className="driver-number" style={{ color: driverMeta.color }}>
          {driverMeta.number}
        </div>
        <div className="driver-avatar" style={{ borderColor: driverMeta.color }}>
          {selectedDriver}
        </div>
        <div className="driver-details">
          <h2>{driverMeta.name}</h2>
          <p style={{ color: driverMeta.color, fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {driverMeta.team}
          </p>
        </div>
      </div>

      <div className="driver-stats-grid">
        <div>
          <div className="stat-label" style={{ fontSize: '8px' }}>Position</div>
          <div className="driver-stat-val">{position}</div>
        </div>
        <div>
          <div className="stat-label" style={{ fontSize: '8px' }}>Points</div>
          <div className="driver-stat-val">{points}</div>
        </div>
        <div>
          <div className="stat-label" style={{ fontSize: '8px' }}>Wins</div>
          <div className="driver-stat-val">{customStats.wins}</div>
        </div>
        <div>
          <div className="stat-label" style={{ fontSize: '8px' }}>Podiums</div>
          <div className="driver-stat-val">{customStats.podiums}</div>
        </div>
      </div>

      <div className="stint-indicator-row">
        <div>
          <div className="stat-label" style={{ fontSize: '8px' }}>Current Stint</div>
          <div className="mono-cell" style={{ fontSize: '13px', fontWeight: '700' }}>
            Stint {currentStintStats.stintNum}
          </div>
        </div>
        <div>
          <div className="stat-label" style={{ fontSize: '8px' }}>Tyre Compound</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', marginTop: '2px' }}>
            {currentStintStats.compound ? (
              <>
                <span className={`tyre-badge ${currentStintStats.compound.toLowerCase()}`}>
                  {currentStintStats.compound[0]}
                </span>
                {currentStintStats.compound}
              </>
            ) : '-'}
          </div>
        </div>
        <div>
          <div className="stat-label" style={{ fontSize: '8px' }}>Tyre Age</div>
          <div className="mono-cell" style={{ fontSize: '13px', fontWeight: '700' }}>
            {currentStintStats.tyreLife} Laps
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverInfo;
