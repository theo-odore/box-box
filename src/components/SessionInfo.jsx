import { useEffect, useRef, useMemo } from 'react';
import { usePlayback } from '../context/PlaybackContext';

const SessionInfo = () => {
  const { meta, registry, raceControl } = usePlayback();
  const miniMapRef = useRef(null);

  // Draw a mini track outline in the track stats section
  useEffect(() => {
    const canvas = miniMapRef.current;
    if (!canvas || !meta || !meta.circuit || !meta.circuit.outline) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const { x, y } = meta.circuit.outline;
    if (x.length === 0 || y.length === 0) return;

    const minX = Math.min(...x);
    const maxX = Math.max(...x);
    const minY = Math.min(...y);
    const maxY = Math.max(...y);

    const scale = Math.min((width - 10) / (maxX - minX), (height - 10) / (maxY - minY));
    const padX = (width - (maxX - minX) * scale) / 2;
    const padY = (height - (maxY - minY) * scale) / 2;

    ctx.beginPath();
    ctx.moveTo(padX + (x[0] - minX) * scale, height - (padY + (y[0] - minY) * scale));
    for (let i = 1; i < x.length; i++) {
      ctx.lineTo(padX + (x[i] - minX) * scale, height - (padY + (y[i] - minY) * scale));
    }
    ctx.closePath();

    ctx.strokeStyle = '#e10600'; // F1 red track outline
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [meta]);

  // Dynamic calculations
  const durationText = useMemo(() => {
    if (!registry) return '00:00:00';
    const durationSec = registry.maxTime - registry.minTime;
    const h = Math.floor(durationSec / 3600);
    const m = Math.floor((durationSec % 3600) / 60);
    const s = Math.floor(durationSec % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [registry]);

  const totalDistanceText = useMemo(() => {
    if (!meta || !meta.circuit?.length || !meta.totalLaps) return '-';
    const dist = (meta.circuit.length * meta.totalLaps) / 1000;
    return `${dist.toFixed(3)} km`;
  }, [meta]);

  const safetyCarMessagesCount = useMemo(() => {
    if (!raceControl) return 0;
    // Count safety car deployment messages
    return raceControl.filter(m => {
      const msg = m.message.toUpperCase();
      return (msg.includes('SAFETY CAR') || msg.includes('VIRTUAL SAFETY CAR') || msg.includes('VSC')) && 
             (msg.includes('DEPLOYED') || msg.includes('START'));
    }).length;
  }, [raceControl]);

  const redFlagsCount = useMemo(() => {
    if (!raceControl) return 0;
    return raceControl.filter(m => {
      const msg = m.message.toUpperCase();
      return msg.includes('RED FLAG') || msg.includes('SUSPENDED') || msg.includes('STOPPED');
    }).length;
  }, [raceControl]);

  if (!meta) return null;

  return (
    <div className="dashboard-card session-track-stats-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {/* Session Information */}
      <div style={{ borderRight: '1px solid var(--card-border)', paddingRight: '16px' }}>
        <div className="card-title" style={{ marginBottom: '12px' }}>Session Information</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Session</span>
            <span style={{ fontWeight: '600' }}>{meta.session}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Date</span>
            <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{meta.date}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Circuit</span>
            <span style={{ fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100px' }} title={meta.trackName}>
              {meta.trackName ? meta.trackName.split(' - ')[0] : 'Unknown Circuit'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Duration</span>
            <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{durationText}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total Laps</span>
            <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{meta.totalLaps}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total Distance</span>
            <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{totalDistanceText}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Safety Car Periods</span>
            <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{safetyCarMessagesCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Red Flags</span>
            <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)', color: redFlagsCount > 0 ? 'var(--soft-red)' : 'inherit' }}>
              {redFlagsCount}
            </span>
          </div>
        </div>
      </div>

      {/* Track Stats */}
      <div>
        <div className="card-title" style={{ marginBottom: '12px' }}>Track Stats</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <canvas ref={miniMapRef} width={80} height={80} style={{ backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px' }} />
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Length</span>
              <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{meta.circuit.length} m</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Corners</span>
              <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{meta.circuit.cornersCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>DRS Zones</span>
              <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{meta.circuit.drsZones}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Speed Trap</span>
              <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{meta.circuit.speedTrapSpeed} km/h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionInfo;
