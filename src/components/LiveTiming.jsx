import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { usePlayback } from '../context/PlaybackContext';
import { formatLapTime } from '../utils/format';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Helper to format gap/delta (e.g. 2.354 -> "+2.354")
const formatDelta = (deltaSec) => {
  if (deltaSec === null || deltaSec === undefined || isNaN(deltaSec)) return '-';
  if (deltaSec === 0) return 'INTERVAL';
  return `+${deltaSec.toFixed(3)}`;
};

const LiveTiming = ({ isMobile = false }) => {
  const { 
    selectedDriver, 
    setSelectedDriver,
    standings,
    currentTime
  } = usePlayback();

  // State to track which driver row is expanded on mobile
  const [expandedDriver, setExpandedDriver] = useState(null);

  // Refs for tracking row elements to perform FLIP animations
  const rowRefs = useRef({});
  const prevPositions = useRef({});
  const prevTimeRef = useRef(currentTime);
  const skipAnimationRef = useRef(false);

  // Detect time jumps (scrubs/seeks) to skip reorder animations
  useEffect(() => {
    const delta = Math.abs(currentTime - prevTimeRef.current);
    // If the clock jumps by more than 3 seconds in a single update, skip animation
    if (delta > 3) {
      skipAnimationRef.current = true;
    } else {
      skipAnimationRef.current = false;
    }
    prevTimeRef.current = currentTime;
  }, [currentTime]);

  // Capture 'First' positions before React applies DOM updates
  useLayoutEffect(() => {
    const firstPositions = {};
    Object.keys(rowRefs.current).forEach(driver => {
      const el = rowRefs.current[driver];
      if (el) {
        firstPositions[driver] = el.getBoundingClientRect().top;
      }
    });
    
    return () => {
      // Capture positions in cleanup (when state updates but before repaint)
      prevPositions.current = firstPositions;
    };
  }, [standings]);

  // Apply FLIP (First, Last, Invert, Play) transition after paint
  useLayoutEffect(() => {
    if (skipAnimationRef.current) {
      // Clear positions and skip this run
      prevPositions.current = {};
      return;
    }

    Object.keys(rowRefs.current).forEach(driver => {
      const el = rowRefs.current[driver];
      const firstTop = prevPositions.current[driver];
      
      if (el && firstTop !== undefined) {
        const lastTop = el.getBoundingClientRect().top;
        const dy = firstTop - lastTop;
        
        if (dy !== 0) {
          // 1. Invert: Translate the row back to its first position instantly (no transitions)
          el.style.transition = 'none';
          el.style.transform = `translate3d(0, ${dy}px, 0)`;
          
          // Force layout reflow so browser registers the inversion before we play
          el.offsetHeight; 
          
          // 2. Play: Animate the translation back to 0 smoothly
          el.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
          el.style.transform = 'translate3d(0, 0, 0)';
        }
      }
    });
  }, [standings]);

  const handleRowClick = (driver) => {
    setSelectedDriver(driver);
    if (isMobile) {
      setExpandedDriver(prev => prev === driver ? null : driver);
    }
  };

  // Reset refs map when standings structure changes
  useEffect(() => {
    rowRefs.current = {};
  }, [standings]);

  if (isMobile) {
    return (
      <div className="dashboard-card live-timing-card mobile-timing-view">
        <div className="card-header">
          <h2 className="card-title">Live Timing</h2>
          <span className="live-badge">Replay Active</span>
        </div>
        
        <div className="mobile-timing-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
          {standings.map((row) => {
            const isExpanded = expandedDriver === row.driver;
            const isSelected = selectedDriver === row.driver;
            
            return (
              <div 
                key={row.driver}
                ref={el => { if (el) rowRefs.current[row.driver] = el; }}
                className={`mobile-timing-row ${isSelected ? 'selected' : ''}`}
                style={{
                  backgroundColor: isSelected ? 'rgba(225, 6, 0, 0.1)' : 'var(--card-bg)',
                  border: `1px solid ${isSelected ? 'var(--f1-red)' : 'var(--card-border)'}`,
                  borderRadius: '6px',
                  overflow: 'hidden',
                  willChange: 'transform'
                }}
              >
                {/* Header/Summary Row */}
                <div 
                  onClick={() => handleRowClick(row.driver)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ 
                      fontFamily: 'var(--font-mono)', 
                      fontSize: '13px', 
                      fontWeight: '700',
                      width: '20px',
                      color: isSelected ? 'var(--f1-red)' : 'var(--text-primary)'
                    }}>
                      {row.position || '-'}
                    </span>
                    <span 
                      className="driver-color-indicator" 
                      style={{ 
                        backgroundColor: row.color,
                        width: '3px',
                        height: '16px',
                        borderRadius: '2px',
                        display: 'inline-block'
                      }}
                    />
                    <strong style={{ fontSize: '14px', letterSpacing: '0.5px' }}>{row.driver}</strong>
                    {row.tyre !== 'unknown' && (
                      <span className={`tyre-badge ${row.tyre}`} style={{ scale: '0.85' }}>
                        {row.tyre[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {typeof row.gap === 'number' ? formatDelta(row.gap) : row.gap || '-'}
                    </span>
                    {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {/* Expanded Drawer */}
                {isExpanded && (
                  <div 
                    style={{
                      borderTop: '1px solid var(--card-border)',
                      backgroundColor: 'rgba(0,0,0,0.15)',
                      padding: '12px 16px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '10px 20px',
                      fontSize: '11px',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '9px', marginBottom: '2px' }}>Driver / Team</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{row.name}</strong>
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{row.team}</span>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '9px', marginBottom: '2px' }}>Interval Behind</span>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {typeof row.interval === 'number' ? formatDelta(row.interval) : row.interval || '-'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '9px', marginBottom: '2px' }}>Last Lap</span>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {formatLapTime(row.lastLap)}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '9px', marginBottom: '2px' }}>Tyre Details</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {row.tyre.toUpperCase()} (Age: {row.tyreLife} laps)
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '9px', marginBottom: '2px' }}>Pit Stops</span>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{row.pits}</strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '9px', marginBottom: '2px' }}>Grid Position</span>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>P{row.grid}</strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop Standard Table
  return (
    <div className="dashboard-card live-timing-card">
      <div className="card-header">
        <h2 className="card-title">Live Timing</h2>
        <span className="live-badge">Replay Active</span>
      </div>
      <div className="table-container">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th className="timing-pos">Pos</th>
              <th style={{ width: '40px' }}>#</th>
              <th>Driver</th>
              <th>Gap</th>
              <th>Interval</th>
              <th>Last Lap</th>
              <th>Tyre</th>
              <th>Age</th>
              <th>Pit</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr 
                key={row.driver}
                ref={el => { if (el) rowRefs.current[row.driver] = el; }}
                className={selectedDriver === row.driver ? 'selected' : ''}
                onClick={() => handleRowClick(row.driver)}
                style={{ willChange: 'transform' }}
              >
                <td className="timing-pos mono-cell">{row.position || '-'}</td>
                <td className="mono-cell" style={{ color: 'var(--text-secondary)' }}>{row.number}</td>
                <td>
                  <span 
                    className="driver-color-indicator" 
                    style={{ backgroundColor: row.color }}
                  />
                  <strong>{row.driver}</strong>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    {row.team.split(' ')[0]}
                  </span>
                </td>
                <td className="mono-cell">
                  {typeof row.gap === 'number' ? formatDelta(row.gap) : row.gap || '-'}
                </td>
                <td className="mono-cell">
                  {typeof row.interval === 'number' ? formatDelta(row.interval) : row.interval || '-'}
                </td>
                <td className="mono-cell">{formatLapTime(row.lastLap)}</td>
                <td>
                  {row.tyre !== 'unknown' ? (
                    <span className={`tyre-badge ${row.tyre}`}>
                      {row.tyre[0].toUpperCase()}
                    </span>
                  ) : '-'}
                </td>
                <td className="mono-cell">{row.tyreLife || '-'}</td>
                <td className="mono-cell">{row.pits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LiveTiming;
