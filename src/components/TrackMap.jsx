import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { usePlayback } from '../context/PlaybackContext';
import { Maximize2, Minimize2 } from 'lucide-react';

// ── LiveTiming sidebar (minimal, for fullscreen mode) ──────────────────────
import LiveTiming from './LiveTiming';

// ── proximity threshold (canvas-px): labels closer than this are suppressed
const LABEL_SUPPRESS_PX = 28;

const TrackMap = () => {
  const {
    meta,
    activeChunkData,
    currentTime,
    selectedDriver,
    setSelectedDriver,
    compareDriver,
    standings,
    raceStartElapsed,
  } = usePlayback();

  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const [hoveredDriver, setHoveredDriver]   = useState(null);
  const [canvasSize,    setCanvasSize]      = useState({ width: 500, height: 450 });
  const [isFullscreen,  setIsFullscreen]    = useState(false);

  // ── ESC to exit fullscreen ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // ── Resize Observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = Math.floor(entry.contentRect.height);
        if (w > 0) {
          setCanvasSize({ width: w, height: isFullscreen ? Math.max(h, 400) : Math.floor(w * 0.9) });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [isFullscreen]);

  // ── Pre-compute track bounds ────────────────────────────────────────────────
  const bounds = useMemo(() => {
    if (!meta?.circuit?.outline) return null;
    const { x, y } = meta.circuit.outline;
    if (!x.length || !y.length) return null;
    const minX = Math.min(...x), maxX = Math.max(...x);
    const minY = Math.min(...y), maxY = Math.max(...y);
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
  }, [meta]);

  // ── Grid slots from meta (pre-race snapping) ────────────────────────────────
  const gridSlots = useMemo(() => meta?.gridSlots || {}, [meta]);

  // ── Live delta text ────────────────────────────────────────────────────────
  const liveDeltaText = useMemo(() => {
    if (!selectedDriver || !compareDriver || !standings) return null;
    const a = standings.find(s => s.driver === selectedDriver);
    const b = standings.find(s => s.driver === compareDriver);
    if (!a || !b) return null;
    if (a.retired || b.retired) return 'OUT';
    if (Math.abs(a.lapNumber - b.lapNumber) > 0) {
      const diff = Math.abs(a.lapNumber - b.lapNumber);
      return `+${diff} ${diff === 1 ? 'LAP' : 'LAPS'}`;
    }
    const diff = Math.abs(a.milestoneTime - b.milestoneTime);
    if (diff === 0) return '0.000s';
    return `${diff.toFixed(3)}s`;
  }, [selectedDriver, compareDriver, standings]);

  // ── Leader driver abbreviation ─────────────────────────────────────────────
  const leaderDriver = useMemo(() => {
    if (!standings || !standings.length) return null;
    return standings[0]?.driver || null;
  }, [standings]);

  // ── Main canvas draw ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bounds || !meta) return;

    const ctx     = canvas.getContext('2d');
    const width   = canvas.width;
    const height  = canvas.height;
    const padding = 30;

    ctx.clearRect(0, 0, width, height);

    const scale = Math.min(
      (width  - padding * 2) / bounds.w,
      (height - padding * 2) / bounds.h
    );

    // Centre the track
    const trackRenderW = bounds.w * scale;
    const trackRenderH = bounds.h * scale;
    const offsetX = padding + (width  - padding * 2 - trackRenderW) / 2;
    const offsetY = padding + (height - padding * 2 - trackRenderH) / 2;

    const mapX = (x) => offsetX + (x - bounds.minX) * scale;
    const mapY = (y) => height - (offsetY + (y - bounds.minY) * scale);

    // 1. Track outline
    const outline = meta.circuit.outline;
    if (outline?.x.length) {
      ctx.beginPath();
      ctx.moveTo(mapX(outline.x[0]), mapY(outline.y[0]));
      for (let i = 1; i < outline.x.length; i++) {
        ctx.lineTo(mapX(outline.x[i]), mapY(outline.y[i]));
      }
      ctx.closePath();
      ctx.strokeStyle = '#2b3542';
      ctx.lineWidth   = 6;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.stroke();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }

    // 2. Corner markers
    (meta.circuit.corners || []).forEach(corner => {
      const cx = mapX(corner.x);
      const cy = mapY(corner.y);
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#475569';
      ctx.fill();
      ctx.fillStyle    = '#64748b';
      ctx.font         = '9px var(--font-mono)';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(corner.number, cx, cy - 8);
    });

    // 3. Driver dot computation
    const driverDots = [];

    if (activeChunkData?.drivers) {
      const { timestamps, drivers } = activeChunkData;

      // Binary search for current frame index
      let lo = 0, hi = timestamps.length - 2, idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (timestamps[mid] <= currentTime && currentTime <= timestamps[mid + 1]) {
          idx = mid; break;
        } else if (timestamps[mid + 1] < currentTime) {
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      if (idx !== -1) {
        const t1    = timestamps[idx];
        const t2    = timestamps[idx + 1];
        const ratio = (currentTime - t1) / (t2 - t1);

        Object.keys(drivers).forEach(driver => {
          const drvData   = drivers[driver];

          const x1 = drvData.x[idx], x2 = drvData.x[idx + 1];
          const y1 = drvData.y[idx], y2 = drvData.y[idx + 1];
          let rawX, rawY;

          if (x1 != null && x2 != null && y1 != null && y2 != null) {
            // ── Primary path: interpolate from live telemetry ──────────────
            rawX = x1 + ratio * (x2 - x1);
            rawY = y1 + ratio * (y2 - y1);
          } else if (raceStartElapsed != null && currentTime < raceStartElapsed + 10 && gridSlots[driver]) {
            // ── Fallback: static grid snap (pre-race / lights-out seam) ─────
            rawX = gridSlots[driver][0];
            rawY = gridSlots[driver][1];
          } else {
            return; // no data, skip this driver
          }

          const driverMeta = meta.drivers[driver] || {};
          const isSelected = selectedDriver === driver;
          const isCompare  = compareDriver  === driver;
          const isLeader   = leaderDriver   === driver;

          // Draw ghost trail for selected / compare (telemetry path only)
          if (x1 != null && (isSelected || isCompare)) {
            ctx.beginPath();
            let first = true;
            for (let t = Math.max(0, idx - 12); t <= idx; t++) {
              const tx = drvData.x[t], ty = drvData.y[t];
              if (tx != null && ty != null) {
                const cx = mapX(tx), cy = mapY(ty);
                if (first) { ctx.moveTo(cx, cy); first = false; }
                else        { ctx.lineTo(cx, cy); }
              }
            }
            ctx.strokeStyle  = driverMeta.color || '#ffffff';
            ctx.lineWidth    = isSelected ? 4 : 3;
            ctx.lineCap      = 'round';
            ctx.lineJoin     = 'round';
            ctx.globalAlpha  = 0.35;
            ctx.stroke();
            ctx.globalAlpha  = 1.0;
          }

          driverDots.push({
            driver,
            x: mapX(rawX),
            y: mapY(rawY),
            color:      driverMeta.color || '#ffffff',
            isSelected,
            isCompare,
            isLeader,
            isHovered:  hoveredDriver === driver,
            alwaysShowLabel: isSelected || isCompare || isLeader,
          });
        });
      } else if (raceStartElapsed != null && currentTime < raceStartElapsed + 10) {
        // ── No telemetry bracket at all (pre-race / before first chunk loads): use grid slots
        Object.keys(gridSlots).forEach(driver => {
          const driverMeta = meta.drivers[driver] || {};
          const isSelected = selectedDriver === driver;
          const isCompare  = compareDriver  === driver;
          const isLeader   = leaderDriver   === driver;
          driverDots.push({
            driver,
            x: mapX(gridSlots[driver][0]),
            y: mapY(gridSlots[driver][1]),
            color:           driverMeta.color || '#ffffff',
            isSelected,
            isCompare,
            isLeader,
            isHovered:       hoveredDriver === driver,
            alwaysShowLabel: isSelected || isCompare || isLeader,
          });
        });
      }
    }

    // 4. Proximity label suppression
    // For each dot, decide if its label should be shown.
    // Rules:
    //   - alwaysShowLabel drivers (selected, compare, leader) NEVER have their
    //     label suppressed.
    //   - A regular dot's label IS suppressed if it is within LABEL_SUPPRESS_PX
    //     of ANY other dot (including an alwaysShowLabel one, which is often in
    //     the middle of a cluster).
    const showLabel = new Array(driverDots.length).fill(true);
    for (let i = 0; i < driverDots.length; i++) {
      if (driverDots[i].alwaysShowLabel) continue; // protected — never suppress
      for (let j = 0; j < driverDots.length; j++) {
        if (i === j) continue;
        const dx = driverDots[i].x - driverDots[j].x;
        const dy = driverDots[i].y - driverDots[j].y;
        if (Math.hypot(dx, dy) < LABEL_SUPPRESS_PX) {
          showLabel[i] = false;
          break; // already suppressed, no need to check more
        }
      }
    }

    // 5. Draw dots (selected/hovered on top)
    const sortedDots = driverDots
      .map((dot, i) => ({ ...dot, showLabel: showLabel[i] }))
      .sort((a, b) => {
        if (a.isSelected) return 1;
        if (b.isSelected) return -1;
        if (a.isHovered)  return 1;
        if (b.isHovered)  return -1;
        return 0;
      });

    sortedDots.forEach(dot => {
      const radius = dot.isSelected ? 8 : 6;
      ctx.shadowBlur  = (dot.isSelected || dot.isHovered) ? 10 : 0;
      ctx.shadowColor = dot.color;

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      ctx.fillStyle   = dot.color;
      ctx.fill();
      ctx.lineWidth   = dot.isSelected ? 2.5 : 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.shadowBlur  = 0;

      if (dot.showLabel) {
        ctx.fillStyle    = '#ffffff';
        ctx.font         = dot.isSelected ? 'bold 10px var(--font-sans)' : '9px var(--font-sans)';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(dot.driver, dot.x + radius + 3, dot.y - (dot.isSelected ? 2 : 1));
      } else {
        // Tiny proximity indicator: small white rim dot
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, radius + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
    });

    // 6. Empty-state overlay
    if (activeChunkData && driverDots.length === 0) {
      ctx.fillStyle    = 'rgba(100, 116, 139, 0.7)';
      ctx.font         = '11px var(--font-sans)';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No Telemetry Data Available for this period', width / 2, height - padding - 10);
    }

    canvas.dots = driverDots;
  }, [bounds, meta, activeChunkData, currentTime, selectedDriver, compareDriver,
      hoveredDriver, canvasSize, gridSlots, leaderDriver, raceStartElapsed]);

  // ── Mouse interaction ──────────────────────────────────────────────────────
  const hitTest = useCallback((e, radius = 15) => {
    const canvas = canvasRef.current;
    if (!canvas?.dots) return null;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx     = (e.clientX - rect.left) * scaleX;
    const my     = (e.clientY - rect.top)  * scaleY;
    let found = null, minDist = radius;
    canvas.dots.forEach(dot => {
      const d = Math.hypot(dot.x - mx, dot.y - my);
      if (d < minDist) { minDist = d; found = dot.driver; }
    });
    return found;
  }, []);

  const handleMouseMove   = (e) => { const d = hitTest(e); setHoveredDriver(d); canvasRef.current.style.cursor = d ? 'pointer' : 'default'; };
  const handleMouseLeave  = ()  => setHoveredDriver(null);
  const handleCanvasClick = (e) => { const d = hitTest(e); if (d) setSelectedDriver(d); };

  // ── Fullscreen CSS class ───────────────────────────────────────────────────
  const fsStyle = isFullscreen ? {
    position: 'fixed', inset: 0, zIndex: 9000,
    borderRadius: 0, display: 'flex', flexDirection: 'row',
    overflow: 'hidden',
  } : {};

  return (
    <div className="dashboard-card track-map-card" style={fsStyle}>

      {/* Sidebar leaderboard in fullscreen */}
      {isFullscreen && (
        <div style={{
          width: '220px', flexShrink: 0,
          borderRight: '1px solid var(--card-border)',
          overflowY: 'auto',
          backgroundColor: 'var(--card-bg)',
        }}>
          <LiveTiming isMobile />
        </div>
      )}

      {/* Map column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Card header */}
        <div className="card-header" style={{ flexShrink: 0 }}>
          <h2 className="card-title">Track Map</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="live-badge">
              {activeChunkData ? 'Replay Grid' : 'Loading…'}
            </span>
            <button
              onClick={() => setIsFullscreen(f => !f)}
              title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen track map'}
              style={{
                background: 'transparent', border: '1px solid var(--card-border)',
                borderRadius: '4px', padding: '4px 6px',
                color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--f1-red)'; e.currentTarget.style.color = 'var(--f1-red)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>

        {/* Canvas wrapper */}
        <div
          className="track-map-wrapper"
          ref={containerRef}
          style={{ position: 'relative', flex: 1 }}
        >
          {!activeChunkData && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '8px', color: 'var(--text-muted)', fontSize: '12px', zIndex: 2,
            }}>
              <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
              <span>Loading positions…</span>
            </div>
          )}

          {/* Live Delta HUD */}
          {selectedDriver && compareDriver && liveDeltaText && (
            <div style={{
              position: 'absolute', bottom: '16px', left: isFullscreen ? '16px' : '16px',
              backgroundColor: 'rgba(21, 25, 30, 0.85)',
              backdropFilter: 'blur(4px)',
              border: '1px solid var(--card-border)',
              borderRadius: '6px', padding: '8px 12px',
              display: 'flex', flexDirection: 'column', gap: '4px',
              zIndex: 5, boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            }}>
              <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Head-to-Head Delta
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                <span style={{ color: meta?.drivers[selectedDriver]?.color }}>{selectedDriver}</span>
                <span style={{ color: 'var(--text-muted)' }}>vs</span>
                <span style={{ color: meta?.drivers[compareDriver]?.color }}>{compareDriver}</span>
                <span style={{ color: 'var(--f1-red)', fontFamily: 'var(--font-mono)', marginLeft: '4px' }}>
                  {liveDeltaText}
                </span>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="track-canvas"
            style={{ display: 'block', width: '100%', height: isFullscreen ? '100%' : undefined }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleCanvasClick}
          />
        </div>
      </div>
    </div>
  );
};

export default TrackMap;
