import { useMemo, useState } from 'react';
import { usePlayback } from '../context/PlaybackContext';
import { formatLapTime } from '../utils/format';

const SectorTimes = ({ isMobile = false }) => {
  const { laps, meta, selectedDriver, compareDriver, selectedLap, standings, currentLap } = usePlayback();
  
  // Mobile sector times view: toggle between sectors and deltas
  const [showDeltas, setShowDeltas] = useState(false);

  const displayLap = currentLap > 0 ? currentLap : Math.max(1, selectedLap);

  const currentLeader = useMemo(() => {
    if (!standings || standings.length === 0) return null;
    return standings[0].driver;
  }, [standings]);

  const displayDrivers = useMemo(() => {
    const list = [];
    if (selectedDriver) list.push(selectedDriver);
    if (compareDriver && !list.includes(compareDriver)) list.push(compareDriver);
    if (currentLeader && !list.includes(currentLeader)) list.push(currentLeader);
    if (meta && list.length < 3) {
      for (const d of Object.keys(meta.drivers)) {
        if (!list.includes(d)) {
          list.push(d);
          if (list.length >= 3) break;
        }
      }
    }
    return list.slice(0, 3);
  }, [selectedDriver, compareDriver, currentLeader, meta]);

  const sectorData = useMemo(() => {
    if (!laps) return [];
    return displayDrivers.map(driver => {
      const driverLaps = laps[driver] || [];
      const lapObj = driverLaps.find(l => l.lapNumber === displayLap);
      return {
        driver,
        s1:      lapObj ? lapObj.sector1  : null,
        s2:      lapObj ? lapObj.sector2  : null,
        s3:      lapObj ? lapObj.sector3  : null,
        lapTime: lapObj ? lapObj.lapTime  : null,
      };
    });
  }, [laps, displayDrivers, displayLap]);

  const refData = sectorData[0];

  const formatSector = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return val.toFixed(3);
  };

  const formatSectorDelta = (val, ref) => {
    if (val == null || ref == null) return '-';
    const diff = val - ref;
    if (diff === 0) return '-';
    return `${diff > 0 ? '+' : ''}${diff.toFixed(3)}`;
  };

  const getDeltaClass = (val, ref) => {
    if (val == null || ref == null) return '';
    const diff = val - ref;
    if (diff > 0) return 'delta-cell positive';
    if (diff < 0) return 'delta-cell negative';
    return '';
  };

  if (isMobile) {
    return (
      <div className="dashboard-card sector-times-card mobile-sectors-view">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">
            Sectors
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: 400 }}>
              Lap {displayLap}
            </span>
          </h2>
          <button
            onClick={() => setShowDeltas(prev => !prev)}
            style={{
              backgroundColor: 'var(--bg-color)',
              border: '1px solid var(--card-border)',
              borderRadius: '4px',
              padding: '4px 8px',
              color: 'var(--text-primary)',
              fontSize: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {showDeltas ? 'View Times' : 'Compare Deltas'}
          </button>
        </div>

        <div className="table-container">
          {!showDeltas ? (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>S1</th>
                  <th>S2</th>
                  <th>S3</th>
                  <th>Lap</th>
                </tr>
              </thead>
              <tbody>
                {sectorData.map((row) => (
                  <tr key={row.driver}>
                    <td>
                      <span
                        className="driver-color-indicator"
                        style={{ backgroundColor: meta?.drivers[row.driver]?.color || '#ffffff' }}
                      />
                      <strong>{row.driver}</strong>
                    </td>
                    <td className="mono-cell">{formatSector(row.s1)}</td>
                    <td className="mono-cell">{formatSector(row.s2)}</td>
                    <td className="mono-cell">{formatSector(row.s3)}</td>
                    <td className="mono-cell">{formatLapTime(row.lapTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', textAlign: 'center' }}>
                Sector delta relative to {selectedDriver}
              </div>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>S1 Δ</th>
                    <th>S2 Δ</th>
                    <th>S3 Δ</th>
                    <th>Lap Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorData.map((row) => (
                    <tr key={row.driver + '_delta'}>
                      <td><strong>{row.driver}</strong></td>
                      <td className={getDeltaClass(row.s1, refData?.s1)}>
                        {formatSectorDelta(row.s1, refData?.s1)}
                      </td>
                      <td className={getDeltaClass(row.s2, refData?.s2)}>
                        {formatSectorDelta(row.s2, refData?.s2)}
                      </td>
                      <td className={getDeltaClass(row.s3, refData?.s3)}>
                        {formatSectorDelta(row.s3, refData?.s3)}
                      </td>
                      <td className={getDeltaClass(row.lapTime, refData?.lapTime)}>
                        {formatSectorDelta(row.lapTime, refData?.lapTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop Standard Tables
  return (
    <div className="dashboard-card sector-times-card">
      <div className="card-header">
        <h2 className="card-title">
          Sector Times
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: 400 }}>
            Lap {displayLap}
            {currentLap > 0 && (
              <span style={{ color: 'var(--f1-red)', marginLeft: '4px' }}>●</span>
            )}
          </span>
        </h2>
      </div>

      <div className="table-container">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Sector 1</th>
              <th>Sector 2</th>
              <th>Sector 3</th>
              <th>Lap Time</th>
            </tr>
          </thead>
          <tbody>
            {sectorData.map((row) => (
              <tr key={row.driver}>
                <td>
                  <span
                    className="driver-color-indicator"
                    style={{ backgroundColor: meta?.drivers[row.driver]?.color || '#ffffff' }}
                  />
                  <strong>{row.driver}</strong>
                </td>
                <td className="mono-cell">{formatSector(row.s1)}</td>
                <td className="mono-cell">{formatSector(row.s2)}</td>
                <td className="mono-cell">{formatSector(row.s3)}</td>
                <td className="mono-cell">{formatLapTime(row.lapTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delta comparison vs. selected driver */}
      <div style={{ marginTop: '12px', borderTop: '1px solid var(--card-border)', paddingTop: '12px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
          Delta to {selectedDriver}
        </div>
        <div className="table-container">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>S1 Δ</th>
                <th>S2 Δ</th>
                <th>S3 Δ</th>
                <th>Lap Δ</th>
              </tr>
            </thead>
            <tbody>
              {sectorData.map((row) => (
                <tr key={row.driver + '_delta'}>
                  <td><strong>{row.driver}</strong></td>
                  <td className={getDeltaClass(row.s1, refData?.s1)}>
                    {formatSectorDelta(row.s1, refData?.s1)}
                  </td>
                  <td className={getDeltaClass(row.s2, refData?.s2)}>
                    {formatSectorDelta(row.s2, refData?.s2)}
                  </td>
                  <td className={getDeltaClass(row.s3, refData?.s3)}>
                    {formatSectorDelta(row.s3, refData?.s3)}
                  </td>
                  <td className={getDeltaClass(row.lapTime, refData?.lapTime)}>
                    {formatSectorDelta(row.lapTime, refData?.lapTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SectorTimes;
