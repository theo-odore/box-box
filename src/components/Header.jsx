import { useMemo, useState } from 'react';
import { usePlayback } from '../context/PlaybackContext';
import { Play, Pause, Share2 } from 'lucide-react';
import { formatSessionClock } from '../utils/format';
import SessionSelector from './SessionSelector';

// ─── Country code lookup for flagcdn.com ────────────────────────────────────
const getCountryCode = (eventName = '') => {
  const n = eventName.toLowerCase();
  if (n.includes('monaco'))                                    return 'mc';
  if (n.includes('british') || n.includes('silverstone'))      return 'gb';
  if (n.includes('italian') || n.includes('monza') || n.includes('imola')) return 'it';
  if (n.includes('spanish') || n.includes('barcelona'))        return 'es';
  if (n.includes('belgian') || n.includes('spa'))              return 'be';
  if (n.includes('dutch') || n.includes('zandvoort'))          return 'nl';
  if (n.includes('austrian') || n.includes('spielberg'))       return 'at';
  if (n.includes('hungarian') || n.includes('budapest'))       return 'hu';
  if (n.includes('singapore'))                                 return 'sg';
  if (n.includes('japanese') || n.includes('suzuka'))          return 'jp';
  if (n.includes('qatar'))                                     return 'qa';
  if (n.includes('abu dhabi') || n.includes('yas'))            return 'ae';
  if (n.includes('saudi') || n.includes('jeddah'))             return 'sa';
  if (n.includes('bahrain'))                                   return 'bh';
  if (n.includes('australian') || n.includes('melbourne'))     return 'au';
  if (n.includes('canadian') || n.includes('montreal'))        return 'ca';
  if (n.includes('mexican') || n.includes('mexico'))           return 'mx';
  if (n.includes('sao paulo') || n.includes('brazil'))         return 'br';
  if (n.includes('las vegas') || n.includes('united states') || n.includes('miami') || n.includes('austin')) return 'us';
  if (n.includes('chinese') || n.includes('shanghai'))         return 'cn';
  if (n.includes('azerbaijani') || n.includes('baku'))         return 'az';
  return 'un';
};

// Approximate local clock from session elapsed time (default 15:00 start)
const formatLocalClock = (elapsedSeconds) => {
  const startSec = 15 * 3600;
  const totalSec = startSec + elapsedSeconds;
  const hrs  = Math.floor(totalSec / 3600) % 24;
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);
  return [
    String(hrs).padStart(2, '0'),
    String(mins).padStart(2, '0'),
    String(secs).padStart(2, '0'),
  ].join(':');
};

const Header = () => {
  const {
    sessionId,
    meta,
    laps,
    raceControl,
    registry,
    currentTime,
    isPlaying,
    speedMultiplier,
    setSpeedMultiplier,
    togglePlay,
    scrubTo,
    currentLap,
  } = usePlayback();

  const [copied, setCopied] = useState(false);

  const totalLaps    = meta?.totalLaps || 78;
  const eventName    = meta?.event     || 'Grand Prix';
  const sessionDate  = meta?.date      || '';
  const sessionType  = meta?.session   || 'Race';
  const countryCode  = meta?.countryCode || getCountryCode(eventName);
  const isPreRace    = currentLap === 0;

  // Lap display — "PRE-RACE" before lap 1, real number once racing begins
  const lapDisplay = isPreRace
    ? 'PRE-RACE'
    : `${currentLap} / ${totalLaps}`;
  const lapPercent = (!isPreRace && totalLaps)
    ? `(${((currentLap / totalLaps) * 100).toFixed(1)}%)`
    : null;

  // Time remaining and progress bar
  const timeRemainingSec = useMemo(() => {
    if (!registry) return 0;
    return Math.max(0, registry.maxTime - currentTime);
  }, [registry, currentTime]);

  const remainingPercent = useMemo(() => {
    if (!registry) return 100;
    const total   = registry.maxTime - registry.minTime;
    const elapsed = currentTime - registry.minTime;
    return Math.max(0, Math.min(100, 100 - (elapsed / total) * 100));
  }, [registry, currentTime]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}&t=${Math.round(currentTime)}`;
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => console.error('Failed to copy replay link:', err));
  };

  // ─── Auto-Detected Key Moments ──────────────────────────────────────────────
  const keyMoments = useMemo(() => {
    if (!laps || !meta || !registry) return [];
    
    const moments = [];
    
    // 1. Race Start (5s before Lap 1 start)
    const allLap1Starts = Object.values(laps)
      .flatMap(driverLaps =>
        driverLaps
          .filter(l => l.lapNumber === 1 && l.lapStartElapsed != null)
          .map(l => l.lapStartElapsed)
      );
    if (allLap1Starts.length > 0) {
      moments.push({
        label: '🚦 Race Start',
        time: Math.max(registry.minTime, Math.min(...allLap1Starts) - 5),
        type: 'start'
      });
    }
    
    // 2. Incident Moments from Race Control Messages (SC, VSC, Red Flag)
    if (raceControl) {
      raceControl.forEach(m => {
        const msg = m.message.toUpperCase();
        if (msg.includes('DEPLOYED') || msg.includes('SUSPENDED') || msg.includes('RED FLAG') || msg.includes('STOPPED')) {
          let label = '';
          let type = '';
          if (msg.includes('SAFETY CAR') && !msg.includes('VIRTUAL')) {
            label = '⚠️ Safety Car';
            type = 'sc';
          } else if (msg.includes('VIRTUAL SAFETY CAR') || msg.includes('VSC')) {
            label = '⚠️ VSC';
            type = 'vsc';
          } else if (msg.includes('RED FLAG') || msg.includes('SUSPENDED')) {
            label = '🟥 Red Flag';
            type = 'red';
          }
          
          if (label) {
            // Find approximate lap
            let lapStr = '';
            // Look for driver names or details in message
            moments.push({
              label,
              time: m.time,
              type
            });
          }
        }
      });
    }

    // 3. Fastest Lap Moment
    let minTime = Infinity;
    let fastestLapObj = null;
    let fastestDriver = '';
    
    Object.entries(laps).forEach(([driver, driverLaps]) => {
      driverLaps.forEach(lap => {
        if (lap.lapTime && lap.lapTime < minTime) {
          minTime = lap.lapTime;
          fastestLapObj = lap;
          fastestDriver = driver;
        }
      });
    });
    
    if (fastestLapObj) {
      moments.push({
        label: `⚡ Fastest Lap: ${fastestDriver}`,
        time: fastestLapObj.lapStartElapsed,
        type: 'fastest'
      });
    }

    // Deduplicate moments by timestamp proximity (within 30 seconds) to avoid duplicate buttons
    const sorted = moments.sort((a, b) => a.time - b.time);
    const filtered = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 || sorted[i].time - sorted[i-1].time > 30 || sorted[i].type !== sorted[i-1].type) {
        filtered.push(sorted[i]);
      }
    }
    
    return filtered.slice(0, 6); // Display max 6 key moments
  }, [laps, meta, raceControl, registry]);

  if (!meta || !registry) return null;

  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {/* ── Top Stats Strip ─────────────────────────────────────────────────── */}
      <div className="dashboard-header">
        <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div className="logo-container">
            <span className="logo-f1">F1 FastF1</span>
            <span className="logo-sub">Data Analytics</span>
          </div>
          <div className="header-title-block" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <SessionSelector />
          </div>
        </div>

        <div className="header-stats">
          {/* Session Info — from meta */}
          <div className="stat-item">
            <span className="stat-label">Session</span>
            <span className="stat-value" style={{ fontSize: '13px', display: 'flex', flexDirection: 'column' }}>
              <strong>{sessionType}</strong>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{eventName}</span>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{sessionDate}</span>
            </span>
          </div>

          {/* Lap Counter — clock-synced via currentLap from context */}
          <div className="stat-item">
            <span className="stat-label">Lap</span>
            <span
              className="stat-value"
              style={{ color: isPreRace ? 'var(--text-muted)' : undefined, fontSize: isPreRace ? '11px' : undefined }}
            >
              {lapDisplay}
              {lapPercent && (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                  {lapPercent}
                </span>
              )}
            </span>
          </div>

          {/* Time Remaining */}
          <div className="stat-item" style={{ width: '100px' }}>
            <span className="stat-label">Time Remaining</span>
            <span className="stat-value" style={{ color: '#a855f7' }}>
              {formatSessionClock(timeRemainingSec)}
            </span>
            <div className="time-remaining-progress">
              <div className="time-remaining-bar" style={{ width: `${remainingPercent}%` }} />
            </div>
          </div>

          {/* Track — from meta */}
          <div className="stat-item">
            <span className="stat-label">Track</span>
            <span className="stat-value" style={{ fontSize: '13px', display: 'flex', alignItems: 'center' }}>
              {countryCode !== 'un' && (
                <img
                  src={`https://flagcdn.com/w20/${countryCode}.png`}
                  className="flag-icon"
                  alt={`${eventName} flag`}
                />
              )}
              {meta.circuit.length > 3337 ? (meta.trackName || eventName) : (meta.trackName || "Circuit de Monaco")}
            </span>
          </div>

          {/* Local Clock */}
          <div className="stat-item">
            <span className="stat-label">Current Time</span>
            <span className="stat-value" style={{ fontSize: '14px' }}>
              {formatLocalClock(currentTime)}
              <span style={{
                fontSize: '9px', color: 'var(--text-muted)', display: 'block',
                textTransform: 'uppercase', textAlign: 'right'
              }}>Local Time</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Playback Control Bar ─────────────────────────────────────────────── */}
      <div className="playback-control-bar">
        <button className="play-btn" onClick={togglePlay}>
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>

        <div className="scrub-slider-container">
          <span className="scrub-time">{formatSessionClock(currentTime)}</span>
          <input
            type="range"
            min={registry.minTime}
            max={registry.maxTime}
            step={0.2}
            value={currentTime}
            onChange={(e) => scrubTo(Number(e.target.value))}
            className="scrub-slider"
          />
          <span className="scrub-time" style={{ textAlign: 'right' }}>
            {formatSessionClock(registry.maxTime)}
          </span>
        </div>

        <div className="playback-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="speed-select">
            {[1, 2, 5, 10, 20].map(mult => (
              <button
                key={mult}
                onClick={() => setSpeedMultiplier(mult)}
                className={`speed-btn ${speedMultiplier === mult ? 'active' : ''}`}
              >
                {mult}x
              </button>
            ))}
          </div>

          <button
            className={`share-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopyLink}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: copied ? '#22c55e' : 'var(--bg-color)',
              border: '1px solid var(--card-border)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.2s ease',
            }}
          >
            <Share2 size={12} />
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* ── Key Moments Quick-Jump Row ───────────────────────────────────────── */}
      {keyMoments.length > 0 && (
        <div 
          className="key-moments-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            padding: '4px 8px',
            backgroundColor: 'rgba(21, 25, 30, 0.4)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.02)',
            marginTop: '2px'
          }}
        >
          <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Jump To:
          </span>
          {keyMoments.map((m, idx) => (
            <button
              key={idx}
              onClick={() => scrubTo(m.time)}
              style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: '500',
                color: m.type === 'fastest' ? '#38bdf8' : (m.type === 'red' ? '#ef4444' : 'var(--text-secondary)'),
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'var(--card-border)';
                e.target.style.borderColor = 'var(--text-muted)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'var(--card-bg)';
                e.target.style.borderColor = 'var(--card-border)';
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};

export default Header;
