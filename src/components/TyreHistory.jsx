import { useMemo } from 'react';
import { usePlayback } from '../context/PlaybackContext';

const compoundColors = {
  soft: 'var(--soft-red)',
  medium: 'var(--medium-yellow)',
  hard: 'var(--hard-white)',
  intermediate: 'var(--inter-green)',
  wet: 'var(--wet-blue)',
  unknown: 'var(--unknown-gray)'
};

const TyreHistory = () => {
  const { laps, meta, selectedDriver, currentLap } = usePlayback();

  // Find all laps for selected driver
  const driverLaps = useMemo(() => {
    if (!laps || !selectedDriver) return [];
    return laps[selectedDriver] || [];
  }, [laps, selectedDriver]);

  // Find total laps of the session
  const totalLaps = meta?.totalLaps || 78;

  // Reconstruct stints from laps
  const stints = useMemo(() => {
    if (driverLaps.length === 0) return [];
    
    const list = [];
    let current = {
      stintNumber: 1,
      startLap: driverLaps[0].lapNumber,
      endLap: driverLaps[0].lapNumber,
      compound: driverLaps[0].compound,
      tyreLife: driverLaps[0].tyreLife,
      lapsCount: 1
    };

    for (let i = 1; i < driverLaps.length; i++) {
      const lap = driverLaps[i];
      const prevLap = driverLaps[i - 1];
      
      const isNewStint = lap.compound !== current.compound || prevLap.isPit;
      
      if (isNewStint) {
        list.push(current);
        current = {
          stintNumber: list.length + 1,
          startLap: lap.lapNumber,
          endLap: lap.lapNumber,
          compound: lap.compound,
          tyreLife: lap.tyreLife,
          lapsCount: 1
        };
      } else {
        current.endLap = lap.lapNumber;
        current.lapsCount += 1;
        current.tyreLife = Math.max(current.tyreLife, lap.tyreLife);
      }
    }
    list.push(current);
    return list;
  }, [driverLaps]);

  // Determine which stint is currently active
  const activeStintIndex = useMemo(() => {
    return stints.findIndex(stint => currentLap >= stint.startLap && currentLap <= stint.endLap);
  }, [stints, currentLap]);

  return (
    <div className="dashboard-card tyre-history-card">
      <div className="card-header">
        <h2 className="card-title">Tyre History & Stints</h2>
      </div>

      <div className="table-container">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Stint</th>
              <th>Start Lap</th>
              <th>End Lap</th>
              <th>Tyre</th>
              <th>Compound</th>
              <th>Laps</th>
            </tr>
          </thead>
          <tbody>
            {stints.map((stint, index) => {
              const compKey = stint.compound.toLowerCase();
              return (
                <tr 
                  key={stint.stintNumber}
                  className={activeStintIndex === index ? 'selected' : ''}
                >
                  <td className="mono-cell" style={{ fontWeight: '700' }}>{stint.stintNumber}</td>
                  <td className="mono-cell">{stint.startLap}</td>
                  <td className="mono-cell">{stint.endLap}</td>
                  <td>
                    <span className={`tyre-badge ${compKey}`}>
                      {stint.compound[0]}
                    </span>
                  </td>
                  <td>{stint.compound}</td>
                  <td className="mono-cell">{stint.lapsCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Visual Stint Bar Chart */}
      <div className="stint-timeline-container">
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Stint Timeline (Current Lap: {currentLap}/{totalLaps})
        </div>
        
        <div className="stint-timeline-bar" style={{ position: 'relative' }}>
          {stints.map((stint) => {
            const widthPct = (stint.lapsCount / totalLaps) * 100;
            const compKey = stint.compound.toLowerCase();
            const color = compoundColors[compKey] || compoundColors.unknown;
            
            return (
              <div 
                key={stint.stintNumber}
                className="stint-segment"
                style={{ 
                  width: `${widthPct}%`, 
                  backgroundColor: color,
                  borderRight: '1px solid rgba(0,0,0,0.3)'
                }}
                data-tooltip={`Stint ${stint.stintNumber}: ${stint.compound} (${stint.lapsCount} laps)`}
              />
            );
          })}

          {/* Current lap cursor indicator */}
          {stints.length > 0 && (
            <div 
              style={{
                position: 'absolute',
                left: `${(currentLap / totalLaps) * 100}%`,
                top: '-4px',
                height: '20px',
                width: '2px',
                backgroundColor: 'var(--f1-red)',
                boxShadow: '0 0 4px var(--f1-red)',
                transform: 'translateX(-50%)',
                zIndex: 5,
                pointerEvents: 'none'
              }}
            />
          )}
        </div>

        <div className="stint-timeline-ticks">
          <span>1</span>
          <span>{Math.round(totalLaps / 4)}</span>
          <span>{Math.round(totalLaps / 2)}</span>
          <span>{Math.round((totalLaps * 3) / 4)}</span>
          <span>{totalLaps}</span>
        </div>
      </div>
    </div>
  );
};

export default TyreHistory;
